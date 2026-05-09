/* ai.js — OpenAI-compatible Chat Completions proxy. Used by the
   /api/ai/* routes to stream chat, suggest shell commands, and
   summarise log output. No SDK dependency — native fetch for
   streaming, existing axios dep for non-streaming. */

const axios = require('axios');
const system = require('./system');
const docker = require('./docker');
const media  = require('./media');

const SYSTEM_CHAT = `You are the NAS Terminal AI assistant — a Linux server
co-pilot. The user is running a self-hosted media server (Emby, Radarr, Sonarr,
SABnzbd) inside Docker on a systemd-based distro. Default to terse, accurate
answers. When suggesting commands, use code fences. Never invent file paths or
service names; ask if unsure. A live system snapshot may be provided as a
separate system message; when it's present, prefer it over guessing.`;

const SYSTEM_SHELL = `You translate natural-language intents into safe shell
commands for a Linux NAS. Respond with a JSON object matching this schema:
{ "command": string, "explanation": string (≤200 chars), "danger": "safe"|"caution"|"destructive" }.
Mark anything that writes to disk, kills processes, or touches network state
as "caution" or "destructive". Never use sudo unless the intent explicitly
asks. If the intent is ambiguous, return command:"" and explain in the
explanation field.`;

const SYSTEM_LOGS = `You are a Linux log analyst. The user pastes journalctl
or service log output. Produce: 1) a one-paragraph summary of what's happening,
2) a bulleted list of warnings or errors with the offending line included
verbatim, 3) one or two suggested next steps. Keep it under 300 words total.`;

const SHELL_SCHEMA = {
  name: 'shell_suggestion',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      command:     { type: 'string' },
      explanation: { type: 'string' },
      danger:      { type: 'string', enum: ['safe', 'caution', 'destructive'] },
    },
    required: ['command', 'explanation', 'danger'],
  },
};

function endpoint(config) {
  const base = (config.ai && config.ai.baseUrl) || 'https://api.openai.com/v1';
  return base.replace(/\/+$/, '') + '/chat/completions';
}

function authHeaders(config) {
  const headers = { 'content-type': 'application/json' };
  const key = config.ai && config.ai.apiKey;
  if (key) headers['authorization'] = `Bearer ${key}`;
  return headers;
}

function isConfigured(config) {
  // Local servers (Ollama, llama.cpp) often need no apiKey — only baseUrl.
  // Treat AI as enabled whenever EITHER is set.
  return !!(config.ai && (config.ai.apiKey || config.ai.baseUrl));
}

async function buildContextSnapshot() {
  // Best-effort. Failures degrade silently — chat still works, just without
  // live context.
  const snapshot = {};
  const [stats, containers] = await Promise.allSettled([
    system.getStats(),
    docker.getContainers(),
  ]);
  if (stats.status === 'fulfilled') snapshot.stats = stats.value;
  if (containers.status === 'fulfilled') snapshot.containers = containers.value;
  return snapshot;
}

function formatContextMessage(snapshot) {
  if (!snapshot || (!snapshot.stats && !snapshot.containers)) return null;
  const lines = ['<live-snapshot>'];
  if (snapshot.stats) {
    const s = snapshot.stats;
    if (s.cpu)     lines.push(`CPU:     ${s.cpu.percent}%`);
    if (s.ram)     lines.push(`RAM:     ${Math.round(100 * s.ram.used / s.ram.total)}% (${(s.ram.used / 1e9).toFixed(1)}/${(s.ram.total / 1e9).toFixed(1)} GB)`);
    if (s.disk)    lines.push(`DISK /:  ${Math.round(100 * s.disk.used / s.disk.total)}% (${(s.disk.used / 1e9).toFixed(0)}/${(s.disk.total / 1e9).toFixed(0)} GB)`);
    if (s.network) lines.push(`NETWORK: rx ${(s.network.rxBytesPerSec / 1024).toFixed(1)} kB/s, tx ${(s.network.txBytesPerSec / 1024).toFixed(1)} kB/s`);
    if (s.uptime)  lines.push(`UPTIME:  ${s.uptime.formatted}`);
    if (s.load)    lines.push(`LOAD:    ${s.load.one.toFixed(2)} ${s.load.five.toFixed(2)} ${s.load.fifteen.toFixed(2)}`);
  }
  if (snapshot.containers && snapshot.containers.length) {
    lines.push(`CONTAINERS (${snapshot.containers.length}):`);
    for (const c of snapshot.containers.slice(0, 32)) {
      lines.push(`  - ${c.name} [${c.state}] ${c.image}`);
    }
  }
  lines.push('</live-snapshot>');
  return lines.join('\n');
}

// ── Read-only tools the model may call during chat ─────────────────────────
const CHAT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'getSystemStats',
      description: 'Return current CPU/RAM/disk/network/uptime/load averages.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getProcesses',
      description: 'Return the top-20 processes by CPU as {user, pid, cpu, mem, cmd}.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listContainers',
      description: 'Return all Docker containers as {id, name, image, status, state}.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'containerLogs',
      description: 'Return the last 100 log lines for a container by name or id.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          nameOrId: { type: 'string', description: 'Container name (e.g. "emby") or short id.' },
        },
        required: ['nameOrId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mediaStatus',
      description: 'Return a summary for a media service (emby | radarr | sonarr).',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          service: { type: 'string', enum: ['emby', 'radarr', 'sonarr'] },
        },
        required: ['service'],
      },
    },
  },
];

async function executeTool(name, args, config) {
  switch (name) {
    case 'getSystemStats':
      return await system.getStats();
    case 'getProcesses':
      return await system.getProcesses();
    case 'listContainers':
      return await docker.getContainers();
    case 'containerLogs': {
      const list = await docker.getContainers();
      const target = list.find(c => c.name === args.nameOrId || c.id === args.nameOrId
                                  || c.id.startsWith(args.nameOrId));
      if (!target) throw new Error(`container "${args.nameOrId}" not found`);
      const logs = await docker.getLogs(target.id);
      // Limit to last 100 lines / 8KB to keep a single tool result bounded.
      const lines = logs.split('\n').slice(-100).join('\n');
      return { name: target.name, id: target.id, logs: lines.slice(-8192) };
    }
    case 'mediaStatus': {
      const fn = ({ emby: media.getEmbyData, radarr: media.getRadarrData, sonarr: media.getSonarrData })[args.service];
      if (!fn) throw new Error(`unknown service "${args.service}"`);
      return await fn(config);
    }
    default:
      throw new Error(`unknown tool "${name}"`);
  }
}

// Yields raw upstream {choice, usage} events parsed out of the SSE stream.
async function* streamRawSSE(config, body) {
  const res = await fetch(endpoint(config), {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`upstream HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      if (payload === '[DONE]') return;
      let evt;
      try { evt = JSON.parse(payload); } catch (_) { continue; }
      yield evt;
    }
  }
}

async function* streamChat(config, messages, opts) {
  const sysMessages = [{ role: 'system', content: SYSTEM_CHAT }];
  if (opts && opts.includeContext) {
    try {
      const snapshot = await buildContextSnapshot();
      const block = formatContextMessage(snapshot);
      if (block) sysMessages.push({ role: 'system', content: block });
    } catch (_) { /* context optional */ }
  }

  const useTools = !(opts && opts.useTools === false);
  const maxIterations = (opts && opts.maxIterations) || 5;
  const history = [...sysMessages, ...messages];
  let lastUsage = null;

  for (let iter = 0; iter < maxIterations; iter++) {
    const body = {
      model:    (config.ai && config.ai.chatModel) || 'gpt-4o-mini',
      messages: history,
      stream:   true,
    };
    if (useTools) body.tools = CHAT_TOOLS;

    let assistantContent = '';
    const toolCalls = []; // [{id, name, arguments}]
    let finishReason = null;

    for await (const evt of streamRawSSE(config, body)) {
      if (evt.usage) lastUsage = evt.usage;
      const choice = evt.choices && evt.choices[0];
      if (!choice) continue;
      const delta = choice.delta || {};
      if (delta.content) {
        assistantContent += delta.content;
        yield { delta: delta.content };
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index || 0;
          if (!toolCalls[idx]) toolCalls[idx] = { id: '', name: '', arguments: '' };
          if (tc.id) toolCalls[idx].id = tc.id;
          if (tc.function && tc.function.name) toolCalls[idx].name += tc.function.name;
          if (tc.function && typeof tc.function.arguments === 'string') {
            toolCalls[idx].arguments += tc.function.arguments;
          }
        }
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }

    if (finishReason !== 'tool_calls' || toolCalls.length === 0) {
      yield { done: true, usage: lastUsage };
      return;
    }

    // Echo assistant turn back into history with the tool_calls array verbatim.
    history.push({
      role: 'assistant',
      content: assistantContent || null,
      tool_calls: toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments || '{}' },
      })),
    });

    // Execute each tool serially, surface progress to the frontend, append results.
    for (const tc of toolCalls) {
      yield { tool_call_start: { id: tc.id, name: tc.name, arguments: tc.arguments } };
      let result, ok = true;
      try {
        const args = tc.arguments ? JSON.parse(tc.arguments) : {};
        result = await executeTool(tc.name, args, config);
      } catch (err) {
        result = { error: err.message };
        ok = false;
      }
      yield { tool_call_result: { id: tc.id, name: tc.name, ok } };
      history.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result).slice(0, 16384),
      });
    }
  }

  // Hit the iteration cap without a clean end — tell the frontend, then close.
  yield { error: `tool-call loop exceeded ${maxIterations} iterations` };
  yield { done: true, usage: lastUsage };
}

async function* streamLogAnalysis(config, lines) {
  yield* streamCompletions(config, {
    model:    (config.ai && config.ai.logModel) || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_LOGS },
      { role: 'user',   content: lines.join('\n').slice(0, 50_000) },
    ],
    stream: true,
  });
}

async function suggestShell(config, intent) {
  const body = {
    model:    (config.ai && config.ai.shellModel) || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_SHELL },
      { role: 'user',   content: intent },
    ],
    response_format: { type: 'json_schema', json_schema: SHELL_SCHEMA },
    temperature: 0,
  };
  const res = await axios.post(endpoint(config), body, {
    headers: authHeaders(config),
    timeout: 20000,
  });
  const text = (res.data && res.data.choices && res.data.choices[0]
                && res.data.choices[0].message && res.data.choices[0].message.content) || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI returned no JSON');
  let parsed;
  try { parsed = JSON.parse(match[0]); }
  catch (_) { throw new Error('AI returned malformed shell suggestion'); }
  if (typeof parsed.command !== 'string' || typeof parsed.explanation !== 'string'
      || !['safe', 'caution', 'destructive'].includes(parsed.danger)) {
    throw new Error('AI returned malformed shell suggestion');
  }
  return parsed;
}

// Internal — converts an OpenAI-compat SSE stream into our envelope.
async function* streamCompletions(config, body) {
  const res = await fetch(endpoint(config), {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`upstream HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let usage = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      if (payload === '[DONE]') { yield { done: true, usage }; return; }
      let evt;
      try { evt = JSON.parse(payload); } catch (_) { continue; }
      const delta = evt.choices && evt.choices[0] && evt.choices[0].delta && evt.choices[0].delta.content;
      if (delta) yield { delta };
      if (evt.usage) usage = evt.usage;
    }
  }
  yield { done: true, usage };
}

module.exports = {
  isConfigured, streamChat, suggestShell, streamLogAnalysis,
  _internals: { endpoint, authHeaders, SHELL_SCHEMA, executeTool, CHAT_TOOLS, formatContextMessage },
};

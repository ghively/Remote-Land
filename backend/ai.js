/* ai.js — AI proxy with pluggable providers.
   Public surface:
     isConfigured(config)
     streamChat(config, messages, opts)        — async iterator
     suggestShell(config, intent)              — Promise<{command,explanation,danger}>
     streamLogAnalysis(config, lines)          — async iterator

   Two providers are supported and dispatched by config.ai.provider
   (or auto-detected from baseUrl):
     - openai    : OpenAI-compatible Chat Completions schema. Default.
                   Works with any provider that speaks that API — OpenAI,
                   Ollama, LiteLLM proxies, etc.
     - anthropic : Native Anthropic Messages API. Talks directly to
                   api.anthropic.com without a translation proxy.

   Both providers stream identically-shaped envelope events back to the
   caller: {delta}, {tool_call_start}, {tool_call_result}, {done, usage},
   {error}. The server.js SSE writer is unaware of which provider produced
   them. */

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

// Default model triples per provider. Picked so a user with a fresh API
// key gets a working setup without having to tune three fields.
const DEFAULT_MODELS = {
  openai:    { chat: 'gpt-4o',                       shell: 'gpt-4o',                       logs: 'gpt-4o' },
  anthropic: { chat: 'claude-sonnet-4-6',            shell: 'claude-haiku-4-5-20251001',    logs: 'claude-opus-4-7' },
};

function providerOf(config) {
  const explicit = ((config.ai && config.ai.provider) || '').toLowerCase();
  if (explicit === 'anthropic' || explicit === 'openai') return explicit;
  const url = (config.ai && config.ai.baseUrl) || '';
  if (/anthropic\.com/i.test(url)) return 'anthropic';
  return 'openai';
}

function modelFor(config, kind) {
  const p = providerOf(config);
  const explicit = config.ai && config.ai[`${kind}Model`];
  return explicit || DEFAULT_MODELS[p][kind];
}

function isConfigured(config) {
  // Local servers (Ollama, llama.cpp) often need no apiKey — only baseUrl.
  // Treat AI as enabled whenever EITHER is set.
  return !!(config.ai && (config.ai.apiKey || config.ai.baseUrl));
}

// ── OpenAI: endpoint + headers ─────────────────────────────────────────────
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

// ── Anthropic: endpoint + headers ──────────────────────────────────────────
function anthropicEndpoint(config) {
  let base = (config.ai && config.ai.baseUrl) || 'https://api.anthropic.com';
  base = base.replace(/\/+$/, '');
  // Allow either "https://api.anthropic.com" or "...com/v1" in baseUrl.
  if (!/\/v1$/.test(base)) base += '/v1';
  return base + '/messages';
}

function anthropicHeaders(config) {
  const headers = {
    'content-type':      'application/json',
    'anthropic-version': '2023-06-01',
  };
  const key = config.ai && config.ai.apiKey;
  if (key) headers['x-api-key'] = key;
  return headers;
}

// ── Shared: live-context snapshot ───────────────────────────────────────────
async function buildContextSnapshot() {
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

// ── Read-only tools the model may call during chat (OpenAI format) ──────────
const CHAT_TOOLS = [
  { type: 'function', function: { name: 'getSystemStats',
      description: 'Return current CPU/RAM/disk/network/uptime/load averages.',
      parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'getProcesses',
      description: 'Return the top-20 processes by CPU as {user, pid, cpu, mem, cmd}.',
      parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'listContainers',
      description: 'Return all Docker containers as {id, name, image, status, state}.',
      parameters: { type: 'object', properties: {}, additionalProperties: false } } },
  { type: 'function', function: { name: 'containerLogs',
      description: 'Return the last 100 log lines for a container by name or id.',
      parameters: {
        type: 'object', additionalProperties: false,
        properties: { nameOrId: { type: 'string', description: 'Container name (e.g. "emby") or short id.' } },
        required: ['nameOrId'],
      } } },
  { type: 'function', function: { name: 'mediaStatus',
      description: 'Return a summary for a media service (emby | radarr | sonarr).',
      parameters: {
        type: 'object', additionalProperties: false,
        properties: { service: { type: 'string', enum: ['emby', 'radarr', 'sonarr'] } },
        required: ['service'],
      } } },
];

// Anthropic uses a flat tool shape.
function toAnthropicTools(openaiTools) {
  return openaiTools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

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

class UpstreamError extends Error {
  constructor(status, retryAfter) {
    super(`upstream HTTP ${status}`);
    this.name = 'UpstreamError';
    this.status = status;
    if (retryAfter) this.retryAfter = retryAfter;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// OPENAI PROVIDER
// ════════════════════════════════════════════════════════════════════════════

async function* openaiStreamRawSSE(config, body) {
  const res = await fetch(endpoint(config), {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    await res.text().catch(() => '');
    throw new UpstreamError(res.status, res.headers && res.headers.get && res.headers.get('retry-after'));
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

async function* openaiStreamChat(config, messages, opts) {
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
      model:    modelFor(config, 'chat'),
      messages: history,
      stream:   true,
    };
    if (useTools) body.tools = CHAT_TOOLS;

    let assistantContent = '';
    const toolCalls = [];
    let finishReason = null;

    for await (const evt of openaiStreamRawSSE(config, body)) {
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

    history.push({
      role: 'assistant',
      content: assistantContent || null,
      tool_calls: toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments || '{}' },
      })),
    });

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

  yield { error: `tool-call loop exceeded ${maxIterations} iterations` };
  yield { done: true, usage: lastUsage };
}

async function* openaiStreamCompletions(config, body) {
  const res = await fetch(endpoint(config), {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    await res.text().catch(() => '');
    throw new UpstreamError(res.status, res.headers && res.headers.get && res.headers.get('retry-after'));
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

async function openaiSuggestShell(config, intent) {
  const body = {
    model:    modelFor(config, 'shell'),
    messages: [
      { role: 'system', content: SYSTEM_SHELL },
      { role: 'user',   content: intent },
    ],
    response_format: { type: 'json_schema', json_schema: SHELL_SCHEMA },
    temperature: 0,
  };
  let res;
  try {
    res = await axios.post(endpoint(config), body, {
      headers: authHeaders(config),
      timeout: 20000,
    });
  } catch (err) {
    if (err.response) {
      const ra = err.response.headers && err.response.headers['retry-after'];
      throw new UpstreamError(err.response.status, ra);
    }
    throw err;
  }
  const text = (res.data && res.data.choices && res.data.choices[0]
                && res.data.choices[0].message && res.data.choices[0].message.content) || '';
  return parseShellSuggestion(text);
}

function parseShellSuggestion(text) {
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

// ════════════════════════════════════════════════════════════════════════════
// ANTHROPIC PROVIDER
// ════════════════════════════════════════════════════════════════════════════

// Convert OpenAI-style {role:'system'|'user'|'assistant'|'tool', content, tool_calls?}
// messages into Anthropic's {system, messages: [{role:'user'|'assistant', content}]}
// shape. System prompts are merged. Tool turns become tool_result content blocks
// inside a user message; assistant tool_calls become tool_use content blocks.
function toAnthropicMessages(openaiMessages) {
  const systemParts = [];
  const out = [];
  for (const m of openaiMessages) {
    if (m.role === 'system') {
      if (m.content) systemParts.push(m.content);
      continue;
    }
    if (m.role === 'tool') {
      const block = { type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content };
      const last = out[out.length - 1];
      if (last && last.role === 'user' && Array.isArray(last.content)) {
        last.content.push(block);
      } else {
        out.push({ role: 'user', content: [block] });
      }
      continue;
    }
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const blocks = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.tool_calls) {
        let input = {};
        try { input = JSON.parse(tc.function.arguments || '{}'); } catch (_) {}
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
      }
      out.push({ role: 'assistant', content: blocks });
      continue;
    }
    out.push({ role: m.role, content: m.content });
  }
  return { system: systemParts.join('\n\n') || undefined, messages: out };
}

async function* anthropicStreamRawSSE(config, body) {
  const res = await fetch(anthropicEndpoint(config), {
    method: 'POST',
    headers: anthropicHeaders(config),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    await res.text().catch(() => '');
    throw new UpstreamError(res.status, res.headers && res.headers.get && res.headers.get('retry-after'));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let event = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const raw of lines) {
      const line = raw.replace(/\r$/, '');
      if (line === '') { event = ''; continue; }
      if (line.startsWith('event:')) { event = line.slice(6).trim(); continue; }
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let evt;
      try { evt = JSON.parse(payload); } catch (_) { continue; }
      yield { type: event || evt.type, data: evt };
    }
  }
}

async function* anthropicStreamChat(config, messages, opts) {
  const ctxBlocks = [SYSTEM_CHAT];
  if (opts && opts.includeContext) {
    try {
      const snapshot = await buildContextSnapshot();
      const block = formatContextMessage(snapshot);
      if (block) ctxBlocks.push(block);
    } catch (_) { /* context optional */ }
  }

  const useTools = !(opts && opts.useTools === false);
  const maxIterations = (opts && opts.maxIterations) || 5;
  // History stays in OpenAI shape internally; we convert per request so the
  // tool-loop bookkeeping is identical to the OpenAI path.
  const history = [
    ...ctxBlocks.map(c => ({ role: 'system', content: c })),
    ...messages,
  ];
  let lastUsage = null;

  for (let iter = 0; iter < maxIterations; iter++) {
    const { system: sys, messages: anthroMsgs } = toAnthropicMessages(history);
    const body = {
      model:      modelFor(config, 'chat'),
      max_tokens: (config.ai && config.ai.maxTokens) || 4096,
      messages:   anthroMsgs,
      stream:     true,
    };
    if (sys) body.system = sys;
    if (useTools) body.tools = toAnthropicTools(CHAT_TOOLS);

    let assistantText = '';
    // Per-index tool_use accumulators: [{id, name, partialJson}]
    const blocks = [];
    let stopReason = null;

    for await (const ev of anthropicStreamRawSSE(config, body)) {
      const { type, data } = ev;
      if (type === 'content_block_start') {
        const cb = data.content_block || {};
        blocks[data.index] = cb.type === 'tool_use'
          ? { kind: 'tool_use', id: cb.id, name: cb.name, partialJson: '' }
          : { kind: 'text', text: '' };
      } else if (type === 'content_block_delta') {
        const d = data.delta || {};
        const b = blocks[data.index];
        if (!b) continue;
        if (d.type === 'text_delta' && b.kind === 'text') {
          b.text += d.text;
          assistantText += d.text;
          yield { delta: d.text };
        } else if (d.type === 'input_json_delta' && b.kind === 'tool_use') {
          b.partialJson += d.partial_json || '';
        }
      } else if (type === 'message_delta') {
        if (data.usage) lastUsage = { ...lastUsage, ...data.usage };
        if (data.delta && data.delta.stop_reason) stopReason = data.delta.stop_reason;
      } else if (type === 'message_stop') {
        // terminal
      } else if (type === 'error') {
        const msg = (data.error && data.error.message) || 'anthropic error';
        throw new Error(msg);
      }
    }

    const toolUses = blocks.filter(Boolean).filter(b => b.kind === 'tool_use');
    if (stopReason !== 'tool_use' || toolUses.length === 0) {
      yield { done: true, usage: lastUsage };
      return;
    }

    // Echo assistant turn into history.
    history.push({
      role: 'assistant',
      content: assistantText || null,
      tool_calls: toolUses.map(tu => ({
        id: tu.id,
        type: 'function',
        function: { name: tu.name, arguments: tu.partialJson || '{}' },
      })),
    });

    for (const tu of toolUses) {
      yield { tool_call_start: { id: tu.id, name: tu.name, arguments: tu.partialJson } };
      let result, ok = true;
      try {
        const args = tu.partialJson ? JSON.parse(tu.partialJson) : {};
        result = await executeTool(tu.name, args, config);
      } catch (err) {
        result = { error: err.message };
        ok = false;
      }
      yield { tool_call_result: { id: tu.id, name: tu.name, ok } };
      history.push({
        role: 'tool',
        tool_call_id: tu.id,
        content: JSON.stringify(result).slice(0, 16384),
      });
    }
  }

  yield { error: `tool-call loop exceeded ${maxIterations} iterations` };
  yield { done: true, usage: lastUsage };
}

async function* anthropicStreamLogAnalysis(config, lines) {
  const body = {
    model:      modelFor(config, 'logs'),
    max_tokens: (config.ai && config.ai.maxTokens) || 2048,
    system:     SYSTEM_LOGS,
    messages:   [{ role: 'user', content: lines.join('\n').slice(0, 50_000) }],
    stream:     true,
  };
  let usage = null;
  for await (const ev of anthropicStreamRawSSE(config, body)) {
    const { type, data } = ev;
    if (type === 'content_block_delta' && data.delta && data.delta.type === 'text_delta') {
      yield { delta: data.delta.text };
    } else if (type === 'message_delta' && data.usage) {
      usage = { ...usage, ...data.usage };
    } else if (type === 'error') {
      throw new Error((data.error && data.error.message) || 'anthropic error');
    }
  }
  yield { done: true, usage };
}

// Anthropic doesn't have json_schema response_format. We get strict output
// by forcing a tool call against a tool whose input_schema IS the desired
// shape. The tool never actually executes — we just read its input back.
const ANTHROPIC_SHELL_TOOL = {
  name:        'submit_shell_suggestion',
  description: 'Submit a structured shell command suggestion to the user.',
  input_schema: SHELL_SCHEMA.schema,
};

async function anthropicSuggestShell(config, intent) {
  const body = {
    model:      modelFor(config, 'shell'),
    max_tokens: (config.ai && config.ai.maxTokens) || 1024,
    system:     SYSTEM_SHELL,
    messages:   [{ role: 'user', content: intent }],
    tools:      [ANTHROPIC_SHELL_TOOL],
    tool_choice: { type: 'tool', name: ANTHROPIC_SHELL_TOOL.name },
  };
  let res;
  try {
    res = await axios.post(anthropicEndpoint(config), body, {
      headers: anthropicHeaders(config),
      timeout: 20000,
    });
  } catch (err) {
    if (err.response) {
      const ra = err.response.headers && err.response.headers['retry-after'];
      throw new UpstreamError(err.response.status, ra);
    }
    throw err;
  }
  const blocks = (res.data && res.data.content) || [];
  const toolUse = blocks.find(b => b.type === 'tool_use');
  if (toolUse && toolUse.input && typeof toolUse.input === 'object') {
    // Validate the shape the same way the openai path does.
    return parseShellSuggestion(JSON.stringify(toolUse.input));
  }
  // Fallback: scrape any text content for JSON.
  const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n');
  return parseShellSuggestion(text);
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC DISPATCHERS
// ════════════════════════════════════════════════════════════════════════════

async function* streamChat(config, messages, opts) {
  if (providerOf(config) === 'anthropic') {
    yield* anthropicStreamChat(config, messages, opts);
  } else {
    yield* openaiStreamChat(config, messages, opts);
  }
}

async function* streamLogAnalysis(config, lines) {
  if (providerOf(config) === 'anthropic') {
    yield* anthropicStreamLogAnalysis(config, lines);
  } else {
    yield* openaiStreamCompletions(config, {
      model:    modelFor(config, 'logs'),
      messages: [
        { role: 'system', content: SYSTEM_LOGS },
        { role: 'user',   content: lines.join('\n').slice(0, 50_000) },
      ],
      stream: true,
    });
  }
}

async function suggestShell(config, intent) {
  if (providerOf(config) === 'anthropic') return anthropicSuggestShell(config, intent);
  return openaiSuggestShell(config, intent);
}

module.exports = {
  isConfigured, streamChat, suggestShell, streamLogAnalysis, UpstreamError,
  providerOf,
  _internals: {
    endpoint, authHeaders, anthropicEndpoint, anthropicHeaders,
    SHELL_SCHEMA, executeTool, CHAT_TOOLS, formatContextMessage,
    toAnthropicMessages, toAnthropicTools, modelFor,
  },
};

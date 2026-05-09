/* ai.js — OpenAI-compatible Chat Completions proxy. Used by the
   /api/ai/* routes to stream chat, suggest shell commands, and
   summarise log output. No SDK dependency — native fetch for
   streaming, existing axios dep for non-streaming. */

const axios = require('axios');
const system = require('./system');
const docker = require('./docker');

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

async function* streamChat(config, messages, opts) {
  const sysMessages = [{ role: 'system', content: SYSTEM_CHAT }];
  if (opts && opts.includeContext) {
    try {
      const snapshot = await buildContextSnapshot();
      const block = formatContextMessage(snapshot);
      if (block) sysMessages.push({ role: 'system', content: block });
    } catch (_) { /* context optional */ }
  }
  yield* streamCompletions(config, {
    model:    (config.ai && config.ai.chatModel) || 'gpt-4o-mini',
    messages: [...sysMessages, ...messages],
    stream:   true,
  });
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
  _internals: { endpoint, authHeaders, SHELL_SCHEMA },
};

# NAS Terminal — Sub-project 4: AI Features

**Date:** 2026-05-09
**Status:** Draft
**Author:** Gene Hively

---

## Overview

Add an LLM-powered assistant layer to NAS Terminal. The backend talks to
**any OpenAI-compatible Chat Completions endpoint** — OpenAI, Azure
OpenAI, OpenRouter, Together, Groq, vLLM, LM Studio, Ollama,
llama.cpp's `server`, text-generation-webui, etc. — so users can run
this against a hosted provider, a self-hosted GPU box, or a CPU-only
local model. The browser never sees the upstream key. Three user-facing
features land in v1:

1. A streaming chat panel.
2. A natural-language→shell command translator wired into the App
   Launcher.
3. A one-click log analyzer on the existing `LogViewer`.

A fourth feature (inline command suggestions inside the terminal pane)
is deferred — see Non-Goals.

---

## Project Decomposition

| # | Sub-project | Status |
|---|-------------|--------|
| 1 | Project Foundation | ✅ Complete |
| 2 | Backend Server Agent | ✅ Complete |
| 3 | Frontend / Backend Wiring | ✅ Complete |
| 4 | **AI Features** ← this spec | Draft |

---

## Goals

1. A chat panel (`AIChat`) that streams responses with the server's
   identity available as system context.
2. A launcher mode `ai shell` that turns "find the largest log file
   under /var/log" into a paste-ready shell command, with an explicit
   confirmation step before anything reaches the terminal.
3. A `[ANALYZE]` button on `LogViewer` that ships the visible (filtered)
   log lines to the LLM and renders a summary inline.
4. The upstream API key lives only in `backend/config.json`. The browser
   never sees it.
5. Streaming responses everywhere the user is waiting on text. The
   browser sees tokens within ~1s of asking when running against a hosted
   endpoint; local models gate on hardware.
6. Demo mode (`apiKey === '__demo__'`) keeps working — AI features are
   visibly disabled with a clear `[ AI REQUIRES BACKEND ]` notice.

---

## Non-Goals (for this sub-project)

- **Inline terminal command suggestions.** Hooking into xterm.js's input
  pipeline to surface ghost-text completions requires terminal-side work
  (cursor management, tab-acceptance, debounced calls) that's out of
  scope for v1. The launcher mode covers the same intent at a coarser
  granularity.
- **Tool use / agentic execution.** The LLM does not get to run
  commands. The user always copies/pastes or explicitly confirms. This
  keeps the blast radius small for v1; tool calling is a future
  iteration.
- **Multi-conversation history.** One chat session per panel, in-memory,
  cleared when the panel closes. No persistence, no search, no rename.
- **File uploads.** Out of scope. Users can paste text into the chat.
- **Embeddings, RAG, vector store.** All prompts are short enough to fit
  in a single request.
- **Per-user rate limiting.** The single shared backend API key implies
  a single user; upstream provider's tier limits apply.
- **Provider-specific extensions.** Anthropic's `cache_control` /
  `thinking`, OpenAI's `reasoning_effort`, Groq's response timing —
  none of those are used. We stick to the lowest-common-denominator
  Chat Completions schema. If you point this at a provider with extra
  features, those features simply aren't exercised.

---

## Architecture

```
Browser                                Backend (Express)         Upstream provider
  │                                      │                         (OpenAI-compat)
  ├─ POST /api/ai/chat       ─────────▶  ├─ ai.js                    │
  │   { messages: [...] }                │   POST {baseUrl}/chat/    │
  │   accept: text/event-stream          │     completions ────────▶ │
  │                                      │   (stream: true)          │
  ◀─ SSE: {"delta":"Hi"} ────────────────┤                            │
  ◀─ SSE: {"delta":" there"}             │                            │
  ◀─ SSE: {"done":true,"usage":...}      │                            │
  │                                      │                            │
  ├─ POST /api/ai/shell      ─────────▶  ├─ ai.js                    │
  │   { intent: "find largest..." }      │   non-streaming;           │
  │                                      │   response_format=         │
  │                                      │     json_schema            │
  ◀─ { command, explanation, danger }    │                            │
  │                                      │                            │
  └─ POST /api/ai/analyze-logs ───────▶  ├─ ai.js → stream summary   │
  ◀─ SSE: {"delta":"..."} ...            │                            │
```

All three frontend-facing endpoints require `x-api-key` (the existing
backend API key from Sub-project 2). The upstream key lives in
`config.json` under `ai.apiKey`. The backend forwards a properly-shaped
Chat Completions request and converts the upstream SSE chunks into the
simpler envelope our frontend expects.

**Streaming model.** Server-Sent Events (`text/event-stream`) for chat
and log analysis. NL→shell uses one-shot non-streaming because the
output is short and structured.

**Model choice.** Configurable per-feature in `config.json`. Sensible
defaults are placeholder strings the operator must override —
`gpt-4o-mini` works on OpenAI/Azure/OpenRouter; `llama3.1:8b` works on
Ollama; etc. We ship no opinion about which model is best.

**Structured output for NL→shell.** OpenAI's `response_format =
{ type: "json_schema", json_schema: {...} }` is honored by OpenAI 4o+,
Azure, OpenRouter, vLLM, llama.cpp's grammar-constrained mode, and most
recent local servers. For endpoints that ignore it, we fall back to
parsing the first `{...}` block out of the response text. Either way,
the backend validates the parsed JSON before returning — malformed
output becomes a 502.

---

## Backend Module — `backend/ai.js`

New module mirroring `system.js` / `media.js`. **No SDK** — we use the
existing `axios` dep (already in `package.json` for Sub-project 2's
media proxy) for non-streaming calls and `fetch` (Node 18+) for
streaming. This keeps the install footprint identical and avoids tying
ourselves to a single provider's client library.

```js
const axios = require('axios');

const SYSTEM_CHAT = `You are the NAS Terminal AI assistant — a Linux server
co-pilot. The user is running a self-hosted media server (Emby, Radarr, Sonarr,
SABnzbd) inside Docker on a systemd-based distro. Default to terse, accurate
answers. When suggesting commands, use code fences. Never invent file paths or
service names; ask if unsure.`;

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
  // We treat the feature as enabled whenever EITHER is set.
  return !!(config.ai && (config.ai.apiKey || config.ai.baseUrl));
}

async function* streamChat(config, messages) {
  const body = {
    model:    (config.ai && config.ai.chatModel) || 'gpt-4o-mini',
    messages: [{ role: 'system', content: SYSTEM_CHAT }, ...messages],
    stream:   true,
  };
  yield* streamCompletions(config, body);
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
  const text = res.data?.choices?.[0]?.message?.content || '';
  // Most providers honor response_format. For ones that don't, scrape the
  // first JSON object out of the text.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI returned no JSON');
  const parsed = JSON.parse(match[0]);
  // Light validation; the schema is strict on supported providers.
  if (typeof parsed.command !== 'string' || typeof parsed.explanation !== 'string'
      || !['safe', 'caution', 'destructive'].includes(parsed.danger)) {
    throw new Error('AI returned malformed shell suggestion');
  }
  return parsed;
}

async function* streamLogAnalysis(config, lines) {
  const body = {
    model:    (config.ai && config.ai.logModel) || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_LOGS },
      { role: 'user',   content: lines.join('\n').slice(0, 50_000) },
    ],
    stream: true,
  };
  yield* streamCompletions(config, body);
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
      try { evt = JSON.parse(payload); } catch { continue; }
      const delta = evt.choices?.[0]?.delta?.content;
      if (delta) yield { delta };
      if (evt.usage) usage = evt.usage;  // Some providers send usage in the final chunk
    }
  }
  yield { done: true, usage };
}

module.exports = { isConfigured, streamChat, suggestShell, streamLogAnalysis };
```

**Why fetch + axios, not the `openai` npm SDK:** `axios` is already a
backend dep. The OpenAI Chat Completions wire format is small and
stable — hand-rolling it costs ~30 lines and removes any ambiguity
about which "OpenAI-compatible" features we depend on. Adding the
`openai` SDK would also pull in tokenizer code, retry wrappers, and
type stubs we don't need.

---

## REST + SSE Endpoints

Added to `backend/server.js` after the existing media routes. All
require the existing `x-api-key` middleware.

### `POST /api/ai/chat` — streamed chat

Request:
```json
{ "messages": [{ "role": "user", "content": "What does my Docker uptime look like?" }] }
```

Response: `text/event-stream`. Each event is a single-line `data:` JSON
object. Terminal event has `done: true` and (when the provider supplies
it) `usage`.

```
data: {"delta":"Your Emby"}
data: {"delta":" container has"}
data: {"delta":" been up 2 days."}
data: {"done":true,"usage":{"prompt_tokens":420,"completion_tokens":18}}
```

The route handler is a thin wrapper around `streamChat`:

```js
app.post('/api/ai/chat', auth, async (req, res) => {
  if (!ai.isConfigured(config)) return res.status(503).json({ error: 'AI not configured' });
  if (!Array.isArray(req.body.messages) || !req.body.messages.length) {
    return res.status(400).json({ error: 'messages required' });
  }
  res.setHeader('content-type', 'text/event-stream');
  res.setHeader('cache-control', 'no-cache');
  res.setHeader('connection', 'keep-alive');
  try {
    for await (const event of ai.streamChat(config, req.body.messages)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
});
```

### `POST /api/ai/shell` — NL→shell translator

Request:
```json
{ "intent": "find the largest log file under /var/log" }
```

Response (JSON):
```json
{
  "command": "find /var/log -type f -printf '%s %p\\n' | sort -nr | head -1",
  "explanation": "Lists files under /var/log by size, descending; prints the largest.",
  "danger": "safe"
}
```

### `POST /api/ai/analyze-logs` — streamed log summary

Request:
```json
{ "lines": ["May  9 03:14:21 nas sshd[1234]: Accepted publickey...", "..."] }
```

Response: SSE, same envelope as `/api/ai/chat`.

### Error handling

| Failure | Backend behaviour |
|---|---|
| `ai.apiKey` and `ai.baseUrl` both unset | `503 { "error": "AI not configured" }` |
| Upstream 401 / 403 | `502 { "error": "AI auth failed" }`; do not echo upstream message |
| Upstream 429 | Pass through `429` with `retry-after` if upstream provided one |
| Upstream 5xx / network error | `502 { "error": "AI temporarily unavailable" }` |
| `suggestShell` fails to parse JSON | `502 { "error": "AI returned malformed response" }` |
| Empty `messages` / empty `intent` / no `lines` | `400` with descriptive message |

Mid-stream errors surface as a final `data: {"error":"..."}` event
followed by `data: [DONE]` and a normal stream end. The frontend
renders the partial text plus a red error banner.

### Config additions

`backend/config.example.json` gains an `ai` block:

```json
{
  "ai": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKey":  "sk-... (leave blank for local servers that don't require auth)",
    "chatModel":  "gpt-4o-mini",
    "shellModel": "gpt-4o-mini",
    "logModel":   "gpt-4o-mini"
  }
}
```

The `baseUrl` is concatenated with `/chat/completions` — supply the
provider's prefix exactly. Reference values:

| Provider                       | `baseUrl`                                        |
|--------------------------------|---------------------------------------------------|
| OpenAI                         | `https://api.openai.com/v1`                       |
| Azure OpenAI                   | `https://<resource>.openai.azure.com/openai/v1`   |
| OpenRouter                     | `https://openrouter.ai/api/v1`                    |
| Groq                           | `https://api.groq.com/openai/v1`                  |
| Together                       | `https://api.together.xyz/v1`                     |
| Ollama (local)                 | `http://localhost:11434/v1`                       |
| LM Studio (local)              | `http://localhost:1234/v1`                        |
| llama.cpp `server` (local)     | `http://localhost:8080/v1`                        |
| vLLM (local)                   | `http://localhost:8000/v1`                        |

A blank `apiKey` is fine for local servers (Ollama et al.). The backend
treats AI as enabled whenever **either** `apiKey` or `baseUrl` is set.

### Health surface

Extend `GET /api/health` (still no auth) to include:

```json
{ "status": "ok", "ai": "configured" }
```

`ai` is `"configured"` when `ai.isConfigured(config)` returns true,
`"disabled"` otherwise. The frontend uses this to gate AI UI.

---

## Frontend — `frontend/aiClient.js`

Plain JS, loaded before the JSX bundles (matches `api.js`). Exposes
`window.makeAiClient(host, apiKey)`.

```js
function makeAiClient(host, apiKey) {
  const base = `http://${host}:3001`;
  const auth = { 'x-api-key': apiKey };

  async function* streamSSE(path, body, signal) {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
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
        if (!payload || payload === '[DONE]') continue;
        try { yield JSON.parse(payload); } catch (_) {}
      }
    }
  }

  return {
    chat:        (messages, signal) => streamSSE('/api/ai/chat', { messages }, signal),
    shell:       async (intent) => {
      const res = await fetch(`${base}/api/ai/shell`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ intent }),
      });
      if (!res.ok) throw new Error(`shell: HTTP ${res.status}`);
      return res.json();
    },
    analyzeLogs: (lines, signal) => streamSSE('/api/ai/analyze-logs', { lines }, signal),
  };
}
window.makeAiClient = makeAiClient;
```

`BackendContext` gains an `ai` field that resolves to `null` in demo
mode or when the health probe reports `ai: "disabled"`, otherwise
returns the client. The provider's heartbeat already calls
`/api/health`, so detecting AI availability is just reading the new
field on that response.

---

## UI Components

### `AIChatPanel.jsx`

A new pane registered as window type `aichat` and a launcher entry
`[AI] AI Chat — LLM assistant`. Messages list at top, scroll-anchored;
input box at bottom; `[CLEAR]` and `[STOP]` in the toolbar.

Behaviour:
- One in-memory `messages` array. User sends → append user message,
  call `ai.chat(messages, signal)`, append empty assistant message,
  append each `delta` to it as it streams.
- `[STOP]` aborts the in-flight stream via the `AbortController` whose
  signal was passed into `chat()`.
- Code fences in assistant text render in a monospace block with a
  `[COPY]` button. No syntax highlighting in v1.
- Prompt + completion token counts displayed dimly under the last
  assistant message after the stream completes (when `usage` is
  provided by the upstream).
- Demo mode + AI-disabled mode both render the panel as a placeholder
  with `[ AI REQUIRES BACKEND ]` and disable inputs.

### `AppLauncher` — new mode `ai`

Adds a fourth tab next to `windows | webapps | run`. Keyboard-accessible
via the leading `?` prefix in the launcher input (matches the existing
`>` for run-command). Typing `? find the largest log file` triggers
`ai.shell(...)` and shows:

```
> find /var/log -type f -printf '%s %p\n' | sort -nr | head -1
[CAUTION] Lists files under /var/log by size, descending; prints the largest.

[ COPY ]   [ INSERT INTO TERMINAL ]
```

`[INSERT INTO TERMINAL]` finds the most-recently-active `terminal`
window, focuses it, and sends the command text via the existing
WebSocket as if the user typed it (no automatic `\n` — the user hits
Enter themselves). For `danger: "destructive"`, the button is replaced
with `[ COPY ONLY ]` and a warning explaining why insertion is blocked.

### `LogViewer` — `[ANALYZE]` button

A new button in the toolbar next to `[CLEAR]`. Disabled in demo mode or
when AI is disabled. On click:

1. Captures the currently visible (filtered) lines.
2. Opens a side panel inside the same window.
3. Streams `ai.analyzeLogs(lines)` into the panel; markdown-style render
   (paragraphs, `*` bullets, no library).
4. Shows token usage on completion when available.

Edge cases:
- `lines.length > 500` → confirms "Analyze 500 most recent lines?"
- `lines.length === 0` → button is disabled.

---

## Streaming Implementation Notes

- Backend uses native `fetch` with `ReadableStream` reader. Node 18+
  ships fetch globally; the existing backend's `package.json` already
  targets Node 18+.
- Each upstream `data: {...}` chunk that contains a `choices[0].delta.
  content` becomes one outbound SSE event. Multiple deltas can arrive
  in a single ~100-byte chunk; the line-split handles that on both
  ends.
- The frontend's reader yields to the React render loop on every chunk
  by virtue of being inside an async generator (the `for await` in the
  consuming effect cooperatively releases the microtask queue).
- `AbortController` is wired through `fetch` so `[STOP]` cancels both
  the request and any pending `read()` immediately.

---

## Cost Awareness

Cost is a function of the operator's chosen provider. With OpenAI
`gpt-4o-mini` at $0.15/$0.60 per 1M tokens, a typical 10-turn chat
(~5K input + 2K output) costs ~$0.002. Same workload on a local Ollama
model is free in dollar terms but bound by GPU/CPU time. No code
changes assume any specific pricing; the operator picks based on their
deployment.

The backend logs `usage` from upstream responses (when supplied) to
stderr (captured by journald). Future iteration could surface this in
a usage panel.

---

## Test Plan

This sub-project spans backend + frontend. Backend gets unit tests
that mock `fetch` and `axios`; frontend is manual.

### Backend (Jest)

| # | Test | Expectation |
|---|------|------|
| 1 | `streamChat` parses upstream SSE into envelope | mocked `fetch` body emits 3 chunks → 3 deltas + done |
| 2 | `streamChat` propagates upstream HTTP errors | mocked `fetch` returns 500 → throws with status in message |
| 3 | `streamChat` surfaces auth failures distinctly | mocked 401 → handler returns 502 `AI auth failed` |
| 4 | `suggestShell` parses `response_format=json_schema` reply | mocked `axios.post` → returns valid object |
| 5 | `suggestShell` falls back to scraping JSON from text | mocked reply with prose around `{...}` → still parses |
| 6 | `suggestShell` rejects malformed output | mocked reply with bad enum → throws |
| 7 | `streamLogAnalysis` truncates input at 50KB | input array of 1MB collapses to 50KB before send |
| 8 | `POST /api/ai/chat` requires `x-api-key` | 401 without header |
| 9 | `POST /api/ai/chat` returns 503 if AI unconfigured | both keys blank → 503 `AI not configured` |
| 10 | `isConfigured` is true with apiKey-only, baseUrl-only, both | covers Ollama-style local servers |
| 11 | Health endpoint reports `ai:'configured'` / `'disabled'` | both branches verified |

### Frontend (manual)

| # | Step | Expected |
|---|---|---|
| 1 | Demo mode: open AI Chat | Placeholder panel; input disabled |
| 2 | Live mode without AI config: open AI Chat | Same placeholder; backend health says `ai:'disabled'` |
| 3 | Live mode with OpenAI config: send "what's my CPU doing?" | Tokens stream in <1s; usage line appears at end |
| 4 | Click `[STOP]` mid-stream | Output halts within ~100ms; partial text retained |
| 5 | Send 10 messages | Conversation context grows; assistant references earlier turns |
| 6 | Live mode with Ollama config (no apiKey): send a message | Streams from local model |
| 7 | Launcher: type `? find largest log file under /var/log` | Returns command, explanation, danger pill |
| 8 | `[INSERT INTO TERMINAL]` with `danger: "safe"` | Active terminal focuses, command appears at prompt, no automatic Enter |
| 9 | `[INSERT INTO TERMINAL]` for `rm -rf /` (`danger: "destructive"`) | Insert button replaced with `[COPY ONLY]` |
| 10 | LogViewer with 200 visible lines, click `[ANALYZE]` | Side panel opens, summary streams in, completes |
| 11 | LogViewer empty | `[ANALYZE]` disabled |

---

## Success Criteria

- [ ] `backend/ai.js` exposes `isConfigured`, `streamChat`, `suggestShell`, `streamLogAnalysis`
- [ ] `POST /api/ai/chat` streams SSE; first byte within ~1s when pointed at a hosted provider
- [ ] `POST /api/ai/shell` returns JSON matching the `{command, explanation, danger}` schema
- [ ] `POST /api/ai/analyze-logs` streams SSE
- [ ] All AI routes require `x-api-key`; 503 when AI unconfigured
- [ ] `GET /api/health` reports `ai: "configured"` or `"disabled"`
- [ ] `frontend/aiClient.js` exposes `window.makeAiClient(host, apiKey)`
- [ ] `BackendContext.ai` is `null` in demo mode or when AI disabled, otherwise the client
- [ ] AI Chat panel renders streaming text with `[STOP]` and `[CLEAR]`
- [ ] Launcher `?` mode returns shell suggestions; `[INSERT INTO TERMINAL]` works on safe/caution; replaced with `[COPY ONLY]` on destructive
- [ ] LogViewer `[ANALYZE]` button streams a summary into a side panel
- [ ] Upstream API key never appears in browser sessionStorage, localStorage, or network responses
- [ ] Demo mode preserves the existing offline experience (AI features disabled but UI doesn't crash)
- [ ] Backend unit tests mock the network and pass against the OpenAI Chat Completions wire format
- [ ] No SDK dependency added — backend uses existing `axios` + native `fetch` only

---

## Open Questions

1. **System prompt context — how much "live" data to inject?** The chat
   is more useful if it knows what containers are running, what services
   are loaded, etc. v1 keeps the system prompt static. Future work could
   prepend a small context block built from `/api/system/stats` +
   `/api/docker/containers` on every turn.
2. **Conversation persistence?** v1 forgets when the panel closes. A
   `/api/ai/conversations` endpoint with SQLite-backed storage would
   let users resume — but that's a real feature with privacy/retention
   implications. Defer.
3. **Provider-specific knobs?** Some providers expose useful extras
   (Anthropic's caching, OpenAI's reasoning effort, Groq's speed
   settings). v1 ignores them all to stay portable. A pass-through
   `extra` block in `config.json` could later opt into provider-specific
   request fields.
4. **Tool calling?** The OpenAI tool-calling schema is supported by most
   providers. Letting the model call backend tools (`/api/system/*`,
   `/api/docker/*`) would unlock real agentic features but is a much
   bigger change in scope. Track separately.

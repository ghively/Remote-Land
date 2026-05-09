# NAS Terminal Sub-project 4 — AI Features Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Backend tasks are TDD — write a failing test, then the implementation. Frontend tasks are no-build, no-npm — verification is manual against a running backend with `ai` configured (or demo mode for offline dev).

**Goal:** Wire NAS Terminal to any OpenAI-compatible Chat Completions endpoint (OpenAI, OpenRouter, Ollama, vLLM, etc.) so the user gets a streaming chat panel, a natural-language→shell launcher mode, and a one-click log analyzer. Upstream API key stays in `backend/config.json` and never reaches the browser.

**Spec:** `docs/superpowers/specs/2026-05-09-ai-features-design.md`

**Architecture summary:** New `backend/ai.js` module talks to `${ai.baseUrl}/chat/completions` via native `fetch` (streaming) + existing `axios` (non-streaming). Three Express routes proxy to it. Frontend gets `aiClient.js` + an `ai` field on `BackendContext`. Three new UI surfaces — `AIChatPanel`, launcher `?` mode, `LogViewer [ANALYZE]`. No SDK dep added.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `backend/config.example.json` | Add `ai` block with `baseUrl`/`apiKey`/model fields |
| Create | `backend/ai.js` | Chat / shell / log-analysis core |
| Create | `backend/__tests__/ai.test.js` | Mocked-fetch + mocked-axios unit tests |
| Modify | `backend/server.js` | `/api/ai/{chat,shell,analyze-logs}` routes; extend `/api/health` with `ai` |
| Modify | `backend/__tests__/server.test.js` | Auth + 503-when-unconfigured + health field tests |
| Modify | `backend/README.md` | Document the new `ai` config block + provider URLs table |
| Create | `frontend/aiClient.js` | Plain JS — `window.makeAiClient(host, apiKey)` |
| Modify | `frontend/BackendContext.jsx` | Expose `ai` client; read `aiEnabled` from health probe |
| Modify | `frontend/NAS Terminal.html` | Load `aiClient.js` + new JSX file |
| Create | `frontend/AIChatPanel.jsx` | Streaming chat UI |
| Modify | `frontend/AppLauncher.jsx` | `?`-prefix AI shell mode |
| Modify | `frontend/SystemPanels.jsx` | `[ANALYZE]` button + side panel inside `LogViewer` |
| Modify | `frontend/NASTerminal.jsx` | Register `aichat` window type; insert-into-terminal hook |

No new npm dependencies. Native `fetch` is on Node 18+ (already required by the existing backend).

---

### Task 1: Backend scaffolding — config + module skeleton

**Files:**
- Modify: `backend/config.example.json`
- Create: `backend/ai.js` (skeleton with `isConfigured` only)

- [ ] **Step 1: Add `ai` block to `config.example.json`**

  Append a sibling of the existing `media` object:

  ```json
  "ai": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKey":  "",
    "chatModel":  "gpt-4o-mini",
    "shellModel": "gpt-4o-mini",
    "logModel":   "gpt-4o-mini"
  }
  ```

- [ ] **Step 2: Create `backend/ai.js` with the helpers + skeleton exports**

  ```js
  /* ai.js — OpenAI-compatible Chat Completions proxy. Used by the
     /api/ai/* routes to stream chat, suggest shell commands, and
     summarise log output. No SDK dependency. */

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
    return !!(config.ai && (config.ai.apiKey || config.ai.baseUrl));
  }

  // Implementations land in Tasks 2-4.
  async function* streamChat()        { throw new Error('not implemented'); }
  async function   suggestShell()     { throw new Error('not implemented'); }
  async function* streamLogAnalysis() { throw new Error('not implemented'); }

  module.exports = {
    isConfigured, streamChat, suggestShell, streamLogAnalysis,
    // exported for tests:
    _internals: { endpoint, authHeaders, SHELL_SCHEMA },
  };
  ```

- [ ] **Step 3: Smoke test `isConfigured`**

  Inline node:
  ```bash
  cd backend && node -e "const ai=require('./ai'); console.log(
    ai.isConfigured({}),
    ai.isConfigured({ai:{}}),
    ai.isConfigured({ai:{apiKey:'x'}}),
    ai.isConfigured({ai:{baseUrl:'http://localhost:11434/v1'}})
  );"
  ```
  Expected: `false false true true`.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/config.example.json backend/ai.js
  git commit --no-gpg-sign -m "feat(backend): scaffold ai.js + ai config block"
  ```

---

### Task 2: `streamChat` + `streamLogAnalysis` (TDD with mocked fetch)

Both share the same SSE-parsing core. Implement once, expose twice.

**Files:**
- Create: `backend/__tests__/ai.test.js`
- Modify: `backend/ai.js`

- [ ] **Step 1: Write failing tests**

  Create `backend/__tests__/ai.test.js`:

  ```js
  const ai = require('../ai');

  // Helper: build a fake fetch Response with a streamable body.
  function fakeStreamResponse(chunks, opts = {}) {
    const encoder = new TextEncoder();
    let i = 0;
    const reader = {
      read: async () => {
        if (i >= chunks.length) return { value: undefined, done: true };
        return { value: encoder.encode(chunks[i++]), done: false };
      },
    };
    return {
      ok: opts.ok !== false,
      status: opts.status || 200,
      body: { getReader: () => reader },
      text: async () => chunks.join(''),
    };
  }

  describe('streamChat', () => {
    afterEach(() => { delete global.fetch; });

    test('parses upstream SSE chunks into envelope events', async () => {
      global.fetch = jest.fn().mockResolvedValue(fakeStreamResponse([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":10,"completion_tokens":2}}\n\n',
        'data: [DONE]\n\n',
      ]));

      const events = [];
      for await (const ev of ai.streamChat({ ai: { apiKey: 'k' } }, [{ role: 'user', content: 'hi' }])) {
        events.push(ev);
      }

      expect(events).toEqual([
        { delta: 'Hello' },
        { delta: ' world' },
        { done: true, usage: { prompt_tokens: 10, completion_tokens: 2 } },
      ]);
    });

    test('throws on upstream HTTP error', async () => {
      global.fetch = jest.fn().mockResolvedValue(fakeStreamResponse(['oops'], { ok: false, status: 500 }));
      const gen = ai.streamChat({ ai: { apiKey: 'k' } }, [{ role: 'user', content: 'hi' }]);
      await expect(gen.next()).rejects.toThrow(/HTTP 500/);
    });

    test('handles deltas split across read chunks', async () => {
      // SSE line spans two reads — the parser must buffer.
      global.fetch = jest.fn().mockResolvedValue(fakeStreamResponse([
        'data: {"choices":[{"delta":{"content":"He',
        'llo"}}]}\n\ndata: [DONE]\n\n',
      ]));
      const events = [];
      for await (const ev of ai.streamChat({ ai: { apiKey: 'k' } }, [{ role: 'user', content: 'hi' }])) {
        events.push(ev);
      }
      expect(events).toEqual([{ delta: 'Hello' }, { done: true, usage: null }]);
    });
  });

  describe('streamLogAnalysis', () => {
    afterEach(() => { delete global.fetch; });

    test('truncates input to 50KB before sending', async () => {
      const captured = {};
      global.fetch = jest.fn().mockImplementation((_url, init) => {
        captured.body = JSON.parse(init.body);
        return Promise.resolve(fakeStreamResponse(['data: [DONE]\n\n']));
      });
      const huge = Array(60_000).fill('x').map((_, i) => `line${i}`);  // ~600KB
      // eslint-disable-next-line no-empty
      for await (const _ of ai.streamLogAnalysis({ ai: { apiKey: 'k' } }, huge)) {}

      const userMsg = captured.body.messages.find(m => m.role === 'user').content;
      expect(userMsg.length).toBeLessThanOrEqual(50_000);
    });
  });
  ```

- [ ] **Step 2: Run tests — verify they fail**

  ```bash
  cd backend && npm test -- --testPathPattern=ai
  ```
  Expected: FAIL — `not implemented`.

- [ ] **Step 3: Replace stubs with full implementations**

  In `backend/ai.js`, replace the two `async function*` stubs with:

  ```js
  async function* streamChat(config, messages) {
    yield* streamCompletions(config, {
      model:    (config.ai && config.ai.chatModel) || 'gpt-4o-mini',
      messages: [{ role: 'system', content: SYSTEM_CHAT }, ...messages],
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
        if (evt.usage) usage = evt.usage;
      }
    }
    yield { done: true, usage };
  }
  ```

- [ ] **Step 4: Run tests — verify they pass**

  ```bash
  cd backend && npm test -- --testPathPattern=ai
  ```
  Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add backend/ai.js backend/__tests__/ai.test.js
  git commit --no-gpg-sign -m "feat(backend): streamChat + streamLogAnalysis via OpenAI-compat SSE"
  ```

---

### Task 3: `suggestShell` (TDD with mocked axios)

**Files:**
- Modify: `backend/__tests__/ai.test.js`
- Modify: `backend/ai.js`

- [ ] **Step 1: Add failing tests**

  Append to `backend/__tests__/ai.test.js`:

  ```js
  jest.mock('axios');
  const axios = require('axios');

  describe('suggestShell', () => {
    afterEach(() => jest.clearAllMocks());

    function mockReply(text) {
      axios.post.mockResolvedValue({
        data: { choices: [{ message: { content: text } }] },
      });
    }

    test('parses a clean json_schema reply', async () => {
      mockReply('{"command":"ls","explanation":"List","danger":"safe"}');
      const out = await ai.suggestShell({ ai: { apiKey: 'k' } }, 'list files');
      expect(out).toEqual({ command: 'ls', explanation: 'List', danger: 'safe' });
    });

    test('falls back to scraping JSON from prose', async () => {
      mockReply('Sure! Here is the command: {"command":"ls","explanation":"List","danger":"safe"} as requested.');
      const out = await ai.suggestShell({ ai: { apiKey: 'k' } }, 'list files');
      expect(out.command).toBe('ls');
    });

    test('rejects malformed output', async () => {
      mockReply('{"command":"ls","explanation":"x","danger":"sketchy"}');  // bad enum
      await expect(ai.suggestShell({ ai: { apiKey: 'k' } }, 'list')).rejects.toThrow(/malformed/);
    });

    test('rejects when no JSON is present', async () => {
      mockReply('I refuse.');
      await expect(ai.suggestShell({ ai: { apiKey: 'k' } }, 'rm -rf /')).rejects.toThrow(/no JSON/);
    });
  });
  ```

- [ ] **Step 2: Run tests — verify they fail**

  ```bash
  cd backend && npm test -- --testPathPattern=ai
  ```
  Expected: FAIL — `not implemented`.

- [ ] **Step 3: Implement `suggestShell`**

  In `backend/ai.js`, replace the stub with:

  ```js
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
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI returned no JSON');
    let parsed;
    try { parsed = JSON.parse(match[0]); }
    catch { throw new Error('AI returned malformed shell suggestion'); }
    if (typeof parsed.command !== 'string' || typeof parsed.explanation !== 'string'
        || !['safe', 'caution', 'destructive'].includes(parsed.danger)) {
      throw new Error('AI returned malformed shell suggestion');
    }
    return parsed;
  }
  ```

- [ ] **Step 4: Run full backend test suite**

  ```bash
  cd backend && npm test
  ```
  Expected: PASS — all existing tests + 4 new `suggestShell` tests + 4 stream tests.

- [ ] **Step 5: Commit**

  ```bash
  git add backend/ai.js backend/__tests__/ai.test.js
  git commit --no-gpg-sign -m "feat(backend): suggestShell via OpenAI structured outputs"
  ```

---

### Task 4: Express routes — `/api/ai/{chat,shell,analyze-logs}` + health field

**Files:**
- Modify: `backend/server.js`
- Modify: `backend/__tests__/server.test.js`

- [ ] **Step 1: Add failing route tests**

  Append to `backend/__tests__/server.test.js`:

  ```js
  // ai mock — lives at the top of the test file alongside other module mocks
  jest.mock('../ai', () => ({
    isConfigured: jest.fn(() => false),  // overridden per-test
    streamChat:        jest.fn(),
    suggestShell:      jest.fn(),
    streamLogAnalysis: jest.fn(),
  }));
  const ai = require('../ai');

  describe('/api/ai routes', () => {
    afterEach(() => jest.clearAllMocks());

    test('GET /api/health reports ai:"disabled" when unconfigured', async () => {
      ai.isConfigured.mockReturnValue(false);
      const res = await request(app).get('/api/health');
      expect(res.body).toEqual({ status: 'ok', ai: 'disabled' });
    });

    test('GET /api/health reports ai:"configured" when configured', async () => {
      ai.isConfigured.mockReturnValue(true);
      const res = await request(app).get('/api/health');
      expect(res.body).toEqual({ status: 'ok', ai: 'configured' });
    });

    test('POST /api/ai/chat requires x-api-key', async () => {
      const res = await request(app).post('/api/ai/chat').send({ messages: [] });
      expect(res.status).toBe(401);
    });

    test('POST /api/ai/chat returns 503 when AI unconfigured', async () => {
      ai.isConfigured.mockReturnValue(false);
      const res = await request(app)
        .post('/api/ai/chat')
        .set('x-api-key', testConfig.apiKey)
        .send({ messages: [{ role: 'user', content: 'hi' }] });
      expect(res.status).toBe(503);
    });

    test('POST /api/ai/chat 400s on empty messages', async () => {
      ai.isConfigured.mockReturnValue(true);
      const res = await request(app)
        .post('/api/ai/chat')
        .set('x-api-key', testConfig.apiKey)
        .send({ messages: [] });
      expect(res.status).toBe(400);
    });

    test('POST /api/ai/shell returns parsed object', async () => {
      ai.isConfigured.mockReturnValue(true);
      ai.suggestShell.mockResolvedValue({ command: 'ls', explanation: 'x', danger: 'safe' });
      const res = await request(app)
        .post('/api/ai/shell')
        .set('x-api-key', testConfig.apiKey)
        .send({ intent: 'list files' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ command: 'ls', explanation: 'x', danger: 'safe' });
    });

    test('POST /api/ai/shell maps upstream errors to 502', async () => {
      ai.isConfigured.mockReturnValue(true);
      ai.suggestShell.mockRejectedValue(new Error('AI returned malformed shell suggestion'));
      const res = await request(app)
        .post('/api/ai/shell')
        .set('x-api-key', testConfig.apiKey)
        .send({ intent: 'list files' });
      expect(res.status).toBe(502);
    });
  });
  ```

- [ ] **Step 2: Run tests — verify they fail**

  ```bash
  cd backend && npm test -- --testPathPattern=server
  ```
  Expected: FAIL — `/api/ai/*` 404 / health response shape mismatch.

- [ ] **Step 3: Wire the routes in `backend/server.js`**

  At the top, add `const ai = require('./ai');` next to the other module imports.

  Replace the `/api/health` handler:
  ```js
  app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', ai: ai.isConfigured(config) ? 'configured' : 'disabled' })
  );
  ```

  After the existing `/api/media/*` routes, add:

  ```js
  app.post('/api/ai/chat', auth, async (req, res) => {
    if (!ai.isConfigured(config)) return res.status(503).json({ error: 'AI not configured' });
    if (!Array.isArray(req.body.messages) || req.body.messages.length === 0) {
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

  app.post('/api/ai/shell', auth, async (req, res) => {
    if (!ai.isConfigured(config)) return res.status(503).json({ error: 'AI not configured' });
    if (typeof req.body.intent !== 'string' || !req.body.intent.trim()) {
      return res.status(400).json({ error: 'intent required' });
    }
    try {
      res.json(await ai.suggestShell(config, req.body.intent));
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post('/api/ai/analyze-logs', auth, async (req, res) => {
    if (!ai.isConfigured(config)) return res.status(503).json({ error: 'AI not configured' });
    if (!Array.isArray(req.body.lines) || req.body.lines.length === 0) {
      return res.status(400).json({ error: 'lines required' });
    }
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache');
    res.setHeader('connection', 'keep-alive');
    try {
      for await (const event of ai.streamLogAnalysis(config, req.body.lines)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  });
  ```

- [ ] **Step 4: Run tests — verify they pass**

  ```bash
  cd backend && npm test
  ```
  Expected: full suite green.

- [ ] **Step 5: Smoke test against a real provider (manual, on Linux)**

  Add a real `apiKey` to `backend/config.json` (OpenAI, OpenRouter, or local Ollama). Then:

  ```bash
  node server.js &
  KEY=$(jq -r .apiKey config.json)
  curl -N -H "x-api-key: $KEY" -H "content-type: application/json" \
    -d '{"messages":[{"role":"user","content":"say hi"}]}' \
    http://localhost:3001/api/ai/chat
  kill %1
  ```
  Expected: stream of `data: {"delta":"..."}` lines ending in `data: [DONE]`.

- [ ] **Step 6: Commit**

  ```bash
  git add backend/server.js backend/__tests__/server.test.js
  git commit --no-gpg-sign -m "feat(backend): /api/ai/{chat,shell,analyze-logs} routes + health AI flag"
  ```

---

### Task 5: Backend README + final backend push

**Files:**
- Modify: `backend/README.md`

- [ ] **Step 1: Append AI section to `backend/README.md`**

  ```md
  ## AI features

  Set `ai.baseUrl` and `ai.apiKey` in `config.json` to enable the chat panel,
  NL→shell launcher mode, and log analyzer. The backend talks to any
  OpenAI-compatible Chat Completions endpoint.

  | Provider                       | `baseUrl`                                        |
  |--------------------------------|---------------------------------------------------|
  | OpenAI                         | `https://api.openai.com/v1`                       |
  | OpenRouter                     | `https://openrouter.ai/api/v1`                    |
  | Groq                           | `https://api.groq.com/openai/v1`                  |
  | Together                       | `https://api.together.xyz/v1`                     |
  | Ollama (local)                 | `http://localhost:11434/v1`                       |
  | LM Studio (local)              | `http://localhost:1234/v1`                        |
  | llama.cpp `server` (local)     | `http://localhost:8080/v1`                        |
  | vLLM (local)                   | `http://localhost:8000/v1`                        |

  Local servers (Ollama, LM Studio, llama.cpp) typically don't need an `apiKey`
  — leave it blank. AI is treated as enabled whenever `apiKey` *or* `baseUrl`
  is set. Per-feature model overrides: `chatModel`, `shellModel`, `logModel`.

  Routes (all behind `x-api-key`):
  - `POST /api/ai/chat` — SSE-streamed chat completion
  - `POST /api/ai/shell` — `{intent}` → `{command, explanation, danger}`
  - `POST /api/ai/analyze-logs` — SSE-streamed summary of pasted log lines

  `GET /api/health` exposes `ai: "configured" | "disabled"` (no auth).
  ```

- [ ] **Step 2: Push backend changes**

  ```bash
  git add backend/README.md
  git commit --no-gpg-sign -m "docs(backend): document ai config + provider URLs"
  git push -u origin claude/review-remaining-tasks-F1ad6
  ```

---

### Task 6: Frontend `aiClient.js` + `BackendContext` extension

**Files:**
- Create: `frontend/aiClient.js`
- Modify: `frontend/BackendContext.jsx`
- Modify: `frontend/NAS Terminal.html`

- [ ] **Step 1: Create `frontend/aiClient.js`**

  Plain JS, exposed as `window.makeAiClient`.

  ```js
  /* aiClient.js — Streaming/non-streaming wrappers for /api/ai/*. */
  (function () {
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
        analyzeLogs: (lines, signal)    => streamSSE('/api/ai/analyze-logs', { lines }, signal),
        shell:       async (intent) => {
          const res = await fetch(`${base}/api/ai/shell`, {
            method: 'POST',
            headers: { ...auth, 'content-type': 'application/json' },
            body: JSON.stringify({ intent }),
          });
          if (!res.ok) throw new Error(`shell: HTTP ${res.status}`);
          return res.json();
        },
      };
    }

    window.makeAiClient = makeAiClient;
  })();
  ```

- [ ] **Step 2: Add `aiClient.js` to the HTML load order**

  In `frontend/NAS Terminal.html`, after the existing `<script src="api.js"></script>`:

  ```html
  <script src="aiClient.js"></script>
  ```

- [ ] **Step 3: Extend `BackendContext.jsx` with the AI client**

  In `frontend/BackendContext.jsx`, the heartbeat already calls `api.health()`. Capture the returned object so we know whether AI is enabled, and build the `ai` client when so.

  Inside the heartbeat effect, change:
  ```jsx
  await api.health();
  if (alive) { setStatus('online'); setLastError(null); }
  ```
  to:
  ```jsx
  const h = await api.health();
  if (alive) {
    setStatus('online');
    setLastError(null);
    setAiEnabled(h && h.ai === 'configured');
  }
  ```

  Add `const [aiEnabled, setAiEnabled] = React.useState(false);` near the existing `useState`s. Build the AI client memoized on `(host, apiKey, aiEnabled)`:

  ```jsx
  const ai = React.useMemo(
    () => (apiKey === '__demo__' || !aiEnabled ? null : window.makeAiClient(host, apiKey)),
    [host, apiKey, aiEnabled]
  );
  ```

  Add `ai, aiEnabled` to the context `value` object and to the demo fallback returned by `useBackend`:

  ```jsx
  const value = React.useMemo(
    () => ({ host, apiKey, api, ai, status, lastError, isDemo: apiKey === '__demo__', aiEnabled }),
    [host, apiKey, api, ai, status, lastError, aiEnabled]
  );

  // …in the demo fallback…
  return {
    host: 'nas.local', apiKey: '__demo__', api: null, ai: null,
    status: 'demo', lastError: null, isDemo: true, aiEnabled: false,
  };
  ```

- [ ] **Step 4: Manual smoke**

  Open the page in two configurations:
  | Config | Expected console output |
  |---|---|
  | Demo (blank API key) | `useBackend().ai === null`, `aiEnabled === false` |
  | Live, backend without `ai.apiKey` | `ai === null`, `aiEnabled === false` |
  | Live, backend with `ai.apiKey` | `typeof ai.chat === 'function'`, `aiEnabled === true` |

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/aiClient.js frontend/BackendContext.jsx "frontend/NAS Terminal.html"
  git commit --no-gpg-sign -m "feat(frontend): aiClient + BackendContext.ai/aiEnabled"
  ```

---

### Task 7: `AIChatPanel.jsx` — streaming chat window

**Files:**
- Create: `frontend/AIChatPanel.jsx`
- Modify: `frontend/NAS Terminal.html`
- Modify: `frontend/NASTerminal.jsx`
- Modify: `frontend/AppLauncher.jsx`

- [ ] **Step 1: Create `frontend/AIChatPanel.jsx`**

  ```jsx
  /* AIChatPanel.jsx — Streaming AI chat. Uses BackendContext.ai. */
  function AIChatPanel() {
    const { ai, isDemo, aiEnabled } = useBackend();
    const [messages, setMessages] = useState([]);  // [{role,content,usage?}]
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const abortRef = useRef(null);
    const listRef = useRef(null);

    useEffect(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [messages]);

    if (isDemo || !aiEnabled || !ai) {
      return (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: '0.85rem',
                      display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div style={{ color: 'var(--neon-cyan)', letterSpacing: 2 }}>[ AI REQUIRES BACKEND ]</div>
          <div>{isDemo
            ? '> Demo mode — log in with a real API key to enable AI.'
            : '> Set ai.apiKey or ai.baseUrl in backend/config.json.'}</div>
        </div>
      );
    }

    const send = async () => {
      const text = input.trim();
      if (!text || streaming) return;
      const next = [...messages, { role: 'user', content: text }, { role: 'assistant', content: '' }];
      setMessages(next);
      setInput('');
      setStreaming(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        for await (const ev of ai.chat(next.slice(0, -1), ctrl.signal)) {
          if (ev.delta) {
            setMessages(m => {
              const last = m[m.length - 1];
              return [...m.slice(0, -1), { ...last, content: last.content + ev.delta }];
            });
          } else if (ev.error) {
            setMessages(m => {
              const last = m[m.length - 1];
              return [...m.slice(0, -1), { ...last, content: last.content + `\n[error: ${ev.error}]`, error: true }];
            });
          } else if (ev.done && ev.usage) {
            setMessages(m => {
              const last = m[m.length - 1];
              return [...m.slice(0, -1), { ...last, usage: ev.usage }];
            });
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setMessages(m => {
            const last = m[m.length - 1];
            return [...m.slice(0, -1), { ...last, content: last.content + `\n[error: ${err.message}]`, error: true }];
          });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    };

    const stop  = () => abortRef.current && abortRef.current.abort();
    const clear = () => { stop(); setMessages([]); };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 6, padding: '6px 10px',
                      borderBottom: '1px solid rgba(0,255,0,0.1)', background: 'rgba(0,0,0,0.5)', flexShrink: 0 }}>
          <span style={{ color: 'var(--neon-cyan)', fontSize: '0.75rem', letterSpacing: 2,
                         textShadow: 'var(--bloom-cyan)' }}>[AI_CHAT]</span>
          <span style={{ flex: 1 }} />
          <button className="cmd-btn-sm" onClick={stop} disabled={!streaming}>[STOP]</button>
          <button className="cmd-btn-sm" onClick={clear} disabled={messages.length === 0}>[CLEAR]</button>
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex',
                                    flexDirection: 'column', gap: 10, fontSize: '0.85rem', lineHeight: 1.6 }}>
          {messages.length === 0 && (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>
              &gt; Ask anything about the server.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: '0.7rem', letterSpacing: 2,
                            color: m.role === 'user' ? 'var(--neon-purple)' : 'var(--neon-green)' }}>
                {m.role === 'user' ? '> USER' : '> ASSISTANT'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: m.error ? '#ff5f56' : 'var(--text-primary)',
                            fontFamily: 'var(--font-mono)' }}>
                {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
              </div>
              {m.usage && (
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                  in: {m.usage.prompt_tokens ?? '?'}  out: {m.usage.completion_tokens ?? '?'}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid rgba(0,255,0,0.1)', flexShrink: 0 }}>
          <input className="logview-filter" style={{ flex: 1 }}
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="$ ask..." disabled={streaming} />
          <button className="cmd-btn" onClick={send} disabled={streaming || !input.trim()}>
            {streaming ? '[ ... ]' : '[ SEND ]'}
          </button>
        </div>
      </div>
    );
  }

  window.AIChatPanel = AIChatPanel;
  ```

- [ ] **Step 2: Add to HTML load order**

  In `NAS Terminal.html`, before `NASTerminal.jsx`:

  ```html
  <script type="text/babel" src="AIChatPanel.jsx"></script>
  ```

- [ ] **Step 3: Register `aichat` window type**

  In `frontend/NASTerminal.jsx`:

  - In `WIN_DEFAULTS`, add: `aichat: { w: 600, h: 540, title: '[AI_CHAT]' },`
  - In `renderWindowContent` switch, add:
    ```jsx
    case 'aichat': return <AIChatPanel />;
    ```

- [ ] **Step 4: Add launcher entry**

  In `frontend/AppLauncher.jsx`'s `PANEL_APPS`:
  ```js
  { id: 'aichat',    name: 'AI Chat',    desc: 'LLM assistant',      icon: '[AI]', cat: 'SYSTEM' },
  ```

  In `WMDesktop.handleLaunch` in `NASTerminal.jsx`, the `apicfg`/`settings` branch already covers id-based dispatch — add:
  ```js
  if (app.id === 'aichat') { spawnWindow('aichat', app); notify('> OPENING AI CHAT', 'ok'); return; }
  ```

- [ ] **Step 5: Manual smoke**

  | Step | Expected |
  |---|---|
  | Demo mode → open AI Chat | Placeholder; input disabled |
  | Live without `ai.apiKey` → open AI Chat | Same placeholder |
  | Live with `ai.apiKey` → send "hi" | Tokens stream within ~1s; usage line appears at end |
  | `[STOP]` mid-stream | Output halts; partial text retained |
  | `[CLEAR]` | Messages cleared |

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/AIChatPanel.jsx "frontend/NAS Terminal.html" frontend/NASTerminal.jsx frontend/AppLauncher.jsx
  git commit --no-gpg-sign -m "feat(frontend): AI chat panel with streaming + abort"
  ```

---

### Task 8: Launcher AI shell mode (`?` prefix)

**Files:**
- Modify: `frontend/AppLauncher.jsx`
- Modify: `frontend/NASTerminal.jsx` (insert-into-terminal hook)

- [ ] **Step 1: Add an `ai` mode to `AppLauncher.jsx`**

  Find the existing mode tabs (`windows | webapps | run`) and add a fourth: `ai`. The launcher input already supports prefix-driven mode switching (`>` for run); add `?` for ai.

  Inside the `AppLauncher` component, when input starts with `?`, set `mode='ai'` and the suffix becomes the intent. Render an "AI shell" results panel:

  ```jsx
  // …state additions…
  const [aiResult, setAiResult]   = useState(null);   // {command, explanation, danger}
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]     = useState(null);
  const { ai, aiEnabled, isDemo } = useBackend();

  const askAI = async (intent) => {
    if (!ai) return;
    setAiLoading(true); setAiResult(null); setAiError(null);
    try {
      const out = await ai.shell(intent);
      setAiResult(out);
    } catch (err) {
      setAiError(err.message);
    } finally { setAiLoading(false); }
  };
  ```

  In the keydown handler, when `mode === 'ai'` and `Enter` is pressed:
  ```jsx
  if (mode === 'ai' && e.key === 'Enter') {
    e.preventDefault();
    askAI(query.replace(/^\?\s*/, ''));
    return;
  }
  ```

  In the results render area, when `mode === 'ai'`:
  ```jsx
  {mode === 'ai' && (
    <div style={{ padding: 16, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
      {(isDemo || !aiEnabled) && (
        <div style={{ color: 'var(--text-dim)' }}>
          &gt; AI requires backend (set ai.apiKey or ai.baseUrl in backend/config.json).
        </div>
      )}
      {aiEnabled && aiLoading && <div style={{ color: 'var(--text-dim)' }}>&gt; thinking...</div>}
      {aiError && <div style={{ color: '#ff5f56' }}>&gt; error: {aiError}</div>}
      {aiResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px 12px', border: '1px solid rgba(0,255,0,0.2)', borderRadius: 4 }}>
            <code style={{ color: 'var(--neon-green)' }}>{aiResult.command || '(no command)'}</code>
          </div>
          <div style={{ color: aiResult.danger === 'destructive' ? '#ff5f56'
                          : aiResult.danger === 'caution' ? '#ffbd2e' : 'var(--neon-green)',
                        fontSize: '0.75rem', letterSpacing: 2 }}>
            [{aiResult.danger.toUpperCase()}]
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
            {aiResult.explanation}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="cmd-btn-sm" onClick={() => navigator.clipboard.writeText(aiResult.command)}>[COPY]</button>
            {aiResult.danger !== 'destructive' && aiResult.command && (
              <button className="cmd-btn-sm cyan" onClick={() => {
                window.dispatchEvent(new CustomEvent('nas:insert-into-terminal', { detail: aiResult.command }));
                onClose();
              }}>[INSERT INTO TERMINAL]</button>
            )}
            {aiResult.danger === 'destructive' && (
              <span style={{ color: '#ff5f56', fontSize: '0.7rem', alignSelf: 'center' }}>
                destructive — copy only
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )}
  ```

- [ ] **Step 2: Wire insert-into-terminal in `WMDesktop`**

  In `frontend/NASTerminal.jsx`, inside `WMDesktop`, add an effect that listens for the custom event and routes the command into the most-recently-active terminal session's WebSocket. The PTY layer in `TerminalPane.jsx` already runs xterm.js + WS — expose a global writer via a window event handler.

  In `WSTerminalSession` (TerminalPane.jsx), expose the WebSocket via a registry:
  ```jsx
  // Inside WSTerminalSession useEffect, after the WS opens:
  window.__nasTerminalSinks = window.__nasTerminalSinks || new Set();
  const sink = (text) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'input', data: text }));
  };
  window.__nasTerminalSinks.add(sink);
  return () => {
    window.__nasTerminalSinks.delete(sink);
    ro.disconnect(); ws.close(); term.dispose();
  };
  ```

  In `WMDesktop`, listen for the custom event:
  ```jsx
  useEffect(() => {
    const onInsert = (e) => {
      const sinks = window.__nasTerminalSinks;
      if (!sinks || sinks.size === 0) {
        notify('> NO ACTIVE TERMINAL', 'warn');
        return;
      }
      // Pick the last-registered sink (most recent terminal opened).
      const sink = Array.from(sinks).pop();
      sink(e.detail);
      notify('> COMMAND INSERTED — PRESS ENTER TO RUN', 'ok');
    };
    window.addEventListener('nas:insert-into-terminal', onInsert);
    return () => window.removeEventListener('nas:insert-into-terminal', onInsert);
  }, [notify]);
  ```

- [ ] **Step 3: Manual smoke**

  | Step | Expected |
  |---|---|
  | Open launcher, type `? list largest log files under /var/log` | Returns command + danger pill within ~1s |
  | `[INSERT INTO TERMINAL]` (safe/caution) | Active terminal focuses, command appears at prompt, no Enter sent |
  | Result with `danger: "destructive"` | `[INSERT INTO TERMINAL]` replaced with "destructive — copy only" |
  | Demo mode | Renders the disabled placeholder |

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/AppLauncher.jsx frontend/NASTerminal.jsx frontend/TerminalPane.jsx
  git commit --no-gpg-sign -m "feat(frontend): launcher ? mode for AI shell + insert-into-terminal"
  ```

---

### Task 9: LogViewer `[ANALYZE]` button

**Files:**
- Modify: `frontend/SystemPanels.jsx`

- [ ] **Step 1: Add side-panel state + button to `LogViewer`**

  In `frontend/SystemPanels.jsx`, find `LogViewer`. Pull `useBackend`:
  ```jsx
  const { ai, aiEnabled, isDemo } = useBackend();
  const [analysis, setAnalysis] = useState(null);   // { text, error, usage, streaming }
  const abortRef = useRef(null);
  ```

  Add a button next to `[CLEAR]` in the toolbar (note `filtered.length` — the variable already exists in scope and reflects the visible/filtered set):
  ```jsx
  <Btn label="[ANALYZE]" cls={analysis ? 'cyan' : ''}
       disabled={isDemo || !aiEnabled || filtered.length === 0}
       onClick={() => analyze()} />
  ```

  Implement `analyze`:
  ```jsx
  const analyze = async () => {
    if (!ai) return;
    if (analysis && analysis.streaming) return;
    let lines = filtered.map(l => `${l.ts} ${l.svc}: ${l.msg}`);
    if (lines.length > 500) {
      if (!confirm(`Analyze the 500 most recent lines? (out of ${lines.length})`)) return;
      lines = lines.slice(-500);
    }
    setAnalysis({ text: '', streaming: true });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      for await (const ev of ai.analyzeLogs(lines, ctrl.signal)) {
        if (ev.delta)         setAnalysis(a => ({ ...a, text: (a?.text || '') + ev.delta }));
        else if (ev.error)    setAnalysis(a => ({ ...a, text: a.text + `\n[error: ${ev.error}]`, error: true }));
        else if (ev.done)     setAnalysis(a => ({ ...a, streaming: false, usage: ev.usage }));
      }
    } catch (err) {
      if (err.name !== 'AbortError') setAnalysis(a => ({ ...(a || {}), text: ((a && a.text) || '') + `\n[error: ${err.message}]`, error: true, streaming: false }));
    } finally { abortRef.current = null; setAnalysis(a => ({ ...(a || {}), streaming: false })); }
  };
  ```

  Render the side panel below the toolbar (above the log body) when `analysis` is non-null:
  ```jsx
  {analysis && (
    <div style={{ borderBottom: '1px solid rgba(0,255,0,0.1)', padding: '10px 12px',
                  background: 'rgba(0,0,0,0.4)', maxHeight: 220, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ color: 'var(--neon-cyan)', letterSpacing: 2, fontSize: '0.75rem' }}>
          [LOG_ANALYSIS]{analysis.streaming ? ' …streaming…' : ''}
        </span>
        <span style={{ flex: 1 }} />
        {analysis.streaming && <Btn label="[STOP]" onClick={() => abortRef.current && abortRef.current.abort()} />}
        <Btn label="[CLOSE]" onClick={() => { abortRef.current && abortRef.current.abort(); setAnalysis(null); }} />
      </div>
      <div style={{ whiteSpace: 'pre-wrap', color: analysis.error ? '#ff5f56' : 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)', fontSize: '0.78rem', lineHeight: 1.6 }}>
        {analysis.text || (analysis.streaming ? '> thinking...' : '')}
      </div>
      {analysis.usage && (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: 6 }}>
          in: {analysis.usage.prompt_tokens ?? '?'}  out: {analysis.usage.completion_tokens ?? '?'}
        </div>
      )}
    </div>
  )}
  ```

- [ ] **Step 2: Manual smoke**

  | Step | Expected |
  |---|---|
  | Demo mode | `[ANALYZE]` disabled |
  | Live with AI, empty filter result | `[ANALYZE]` disabled |
  | Live with AI, ~50 lines visible | Click `[ANALYZE]` → side panel streams summary |
  | Click `[STOP]` mid-stream | Output halts |
  | Click `[CLOSE]` | Side panel disappears |
  | Visible lines > 500 | Browser confirm prompt |

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/SystemPanels.jsx
  git commit --no-gpg-sign -m "feat(frontend): LogViewer [ANALYZE] streams AI summary into side panel"
  ```

---

### Task 10: Roadmap update + final push

- [ ] **Step 1: Mark Sub-project 4 complete in `CLAUDE.md` and `README.md`**

  Both files have the same roadmap table. Change the `AI Features` row to `✅ Complete`.

- [ ] **Step 2: Final verification**

  Walk the spec's success criteria. Anything that fails → fix in a focused commit.

- [ ] **Step 3: Push**

  ```bash
  git add CLAUDE.md README.md
  git commit --no-gpg-sign -m "docs: mark Sub-project 4 complete in roadmap"
  git push -u origin claude/review-remaining-tasks-F1ad6
  ```

---

## Self-Review

**Spec coverage:**

| Spec success criterion | Task |
|---|---|
| `backend/ai.js` exposes `isConfigured`, `streamChat`, `suggestShell`, `streamLogAnalysis` | Tasks 1-3 |
| `POST /api/ai/chat` SSE streaming | Task 4 |
| `POST /api/ai/shell` JSON output | Task 4 |
| `POST /api/ai/analyze-logs` SSE | Task 4 |
| Auth + 503 when unconfigured | Task 4 |
| Health endpoint reports `ai` | Task 4 |
| `frontend/aiClient.js` exposes `makeAiClient` | Task 6 |
| `BackendContext.ai` is `null` in demo / when disabled | Task 6 |
| AI Chat panel with `[STOP]` / `[CLEAR]` | Task 7 |
| Launcher `?` mode + `[INSERT INTO TERMINAL]` + destructive guard | Task 8 |
| LogViewer `[ANALYZE]` | Task 9 |
| Upstream key never in browser storage | All tasks (key only in `config.json`; only `x-api-key` from session reaches the network) |
| Demo mode preserved | Tasks 6-9 (every UI gates on `aiEnabled && !isDemo`) |
| Backend tests with mocked network | Tasks 2-4 |
| No SDK dep added | All tasks (only existing `axios` + native `fetch`) |

**Risk flags:**
- Native `fetch` in Node requires Node 18+. The existing backend already targets that — no regression.
- `navigator.clipboard.writeText` is the standard clipboard API; it requires a secure context. The frontend runs from a `file://` URL, which is treated as secure for clipboard purposes in Chrome/Firefox. Worst case: copy silently fails; user can select-and-copy manually.
- `window.__nasTerminalSinks` is global state outside React. Picking "the last-registered sink" approximates "most recent terminal" but isn't perfect — a buried-but-recently-focused terminal would lose. Acceptable for v1; revisit if it feels wrong.
- Insert-into-terminal sends raw text via the WebSocket. The PTY echoes it back. The user must press Enter — we don't append `\n` so a malformed suggestion can be edited before running.
- `confirm()` is a synchronous browser dialog inside an async function. Works but blocks the page; acceptable here because it's user-initiated.

**Out of scope, deliberately:**
- Tool calling (Claude/OpenAI tool-use) — flagged in spec § Open Questions.
- Conversation persistence — same.
- Live system context injected into chat — same.
- Inline xterm.js completions — spec § Non-Goals.

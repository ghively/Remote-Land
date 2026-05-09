/* aiClient.js — Streaming + non-streaming wrappers for /api/ai/*.
   Plain JS so it loads before Babel and the JSX bundles. Exposes
   window.makeAiClient(host, apiKey) which returns {chat, shell,
   analyzeLogs}. chat / analyzeLogs are async generators yielding
   {delta} | {error} | {done, usage} envelopes. */
(function () {
  const PORT = 3001;

  function makeAiClient(host, apiKey) {
    const base = `http://${host}:${PORT}`;
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
      chat: (messages, signal, opts) => {
        const body = { messages };
        if (opts && typeof opts.includeContext === 'boolean') body.includeContext = opts.includeContext;
        if (opts && typeof opts.useTools       === 'boolean') body.useTools       = opts.useTools;
        return streamSSE('/api/ai/chat', body, signal);
      },
      analyzeLogs: (lines, signal)    => streamSSE('/api/ai/analyze-logs', { lines }, signal),
      shell:       async (intent) => {
        const res = await fetch(`${base}/api/ai/shell`, {
          method: 'POST',
          headers: { ...auth, 'content-type': 'application/json' },
          body: JSON.stringify({ intent }),
        });
        if (!res.ok) {
          let msg = `shell: HTTP ${res.status}`;
          try { const body = await res.json(); if (body && body.error) msg = body.error; } catch (_) {}
          throw new Error(msg);
        }
        return res.json();
      },
    };
  }

  window.makeAiClient = makeAiClient;
})();

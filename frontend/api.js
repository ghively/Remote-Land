/* api.js — REST client factory for the NAS Terminal backend agent.
   Plain JS so it loads before Babel and the JSX bundles. Exposes
   window.makeApi(host, apiKey) which returns a typed client. */
(function () {
  const PORT = 3001;

  function makeApi(host, apiKey) {
    const base = `http://${host}:${PORT}`;
    const auth = { 'x-api-key': apiKey };

    const withTimeout = (ms) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), ms);
      return { signal: ctrl.signal, done: () => clearTimeout(timer) };
    };

    const get = async (path, opts) => {
      const t = withTimeout((opts && opts.timeout) || 5000);
      try {
        const res = await fetch(`${base}${path}`, { headers: auth, signal: t.signal });
        if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
        const ct = res.headers.get('content-type') || '';
        return ct.includes('json') ? res.json() : res.text();
      } finally { t.done(); }
    };

    const post = async (path, body) => {
      const t = withTimeout(5000);
      try {
        const res = await fetch(`${base}${path}`, {
          method: 'POST',
          headers: { ...auth, 'content-type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
          signal: t.signal,
        });
        if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
        const ct = res.headers.get('content-type') || '';
        return ct.includes('json') ? res.json() : res.text();
      } finally { t.done(); }
    };

    const health = async () => {
      const t = withTimeout(3000);
      try {
        const res = await fetch(`${base}/api/health`, { signal: t.signal });
        if (!res.ok) throw new Error(`health: HTTP ${res.status}`);
        return res.json();
      } finally { t.done(); }
    };

    return {
      host, apiKey,
      health,
      systemStats:    () => get('/api/system/stats'),
      processes:      () => get('/api/system/processes'),
      containers:     () => get('/api/docker/containers'),
      startContainer: (id) => post(`/api/docker/${id}/start`),
      stopContainer:  (id) => post(`/api/docker/${id}/stop`),
      containerLogs:  (id) => get(`/api/docker/${id}/logs`, { timeout: 10000 }),
      emby:           () => get('/api/media/emby'),
      radarr:         () => get('/api/media/radarr'),
      sonarr:         () => get('/api/media/sonarr'),
      terminalUrl:    () => `ws://${host}:${PORT}/terminal?token=${encodeURIComponent(apiKey)}`,
    };
  }

  window.makeApi = makeApi;
})();

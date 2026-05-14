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

    // Composite signal: AbortSignal.any() if available (Node 20 / modern
    // browsers), else fall back to chaining via event listeners.
    const composeSignal = (extSignal, ownSignal) => {
      if (!extSignal) return ownSignal;
      if (AbortSignal && typeof AbortSignal.any === 'function') {
        return AbortSignal.any([extSignal, ownSignal]);
      }
      const ctrl = new AbortController();
      const abort = () => ctrl.abort();
      if (extSignal.aborted) abort();
      else extSignal.addEventListener('abort', abort, { once: true });
      ownSignal.addEventListener('abort', abort, { once: true });
      return ctrl.signal;
    };

    const get = async (path, opts) => {
      const t = withTimeout((opts && opts.timeout) || 5000);
      const signal = composeSignal(opts && opts.signal, t.signal);
      try {
        const res = await fetch(`${base}${path}`, { headers: auth, signal });
        if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
        const ct = res.headers.get('content-type') || '';
        return ct.includes('json') ? res.json() : res.text();
      } finally { t.done(); }
    };

    const del = async (path) => {
      const t = withTimeout(5000);
      try {
        const res = await fetch(`${base}${path}`, { method: 'DELETE', headers: auth, signal: t.signal });
        if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
        const ct = res.headers.get('content-type') || '';
        return ct.includes('json') ? res.json() : res.text();
      } finally { t.done(); }
    };

    const put = async (path, body) => {
      const t = withTimeout(5000);
      try {
        const res = await fetch(`${base}${path}`, {
          method: 'PUT',
          headers: { ...auth, 'content-type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
          signal: t.signal,
        });
        if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
        const ct = res.headers.get('content-type') || '';
        return ct.includes('json') ? res.json() : res.text();
      } finally { t.done(); }
    };

    const post = async (path, body, opts) => {
      const t = withTimeout((opts && opts.timeout) || 5000);
      const signal = composeSignal(opts && opts.signal, t.signal);
      try {
        const res = await fetch(`${base}${path}`, {
          method: 'POST',
          headers: { ...auth, 'content-type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
          signal,
        });
        if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
        const ct = res.headers.get('content-type') || '';
        return ct.includes('json') ? res.json() : res.text();
      } finally { t.done(); }
    };

    const health = async (opts) => {
      const t = withTimeout((opts && opts.timeout) || 3000);
      const signal = composeSignal(opts && opts.signal, t.signal);
      try {
        const res = await fetch(`${base}/api/health`, { signal });
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
      startContainer:   (id) => post(`/api/docker/${id}/start`),
      stopContainer:    (id) => post(`/api/docker/${id}/stop`),
      restartContainer: (id) => post(`/api/docker/${id}/restart`),
      containerLogs:    (id) => get(`/api/docker/${id}/logs`, { timeout: 10000 }),
      emby:           () => get('/api/media/emby'),
      radarr:         () => get('/api/media/radarr'),
      sonarr:         () => get('/api/media/sonarr'),

      // ── Files ──
      listDir:    (p) => get(`/api/files/list?path=${encodeURIComponent(p)}`),
      readFile:   (p) => get(`/api/files/read?path=${encodeURIComponent(p)}`),
      mkdir:      (p) => post('/api/files/mkdir', { path: p }),
      renameFile: (from, to) => post('/api/files/rename', { from, to }),
      deleteFile: (p) => del(`/api/files?path=${encodeURIComponent(p)}`),
      downloadUrl: (p) => `${base}/api/files/download?path=${encodeURIComponent(p)}&_k=${encodeURIComponent(apiKey)}`,

      // ── Services ──
      listServices:  (state) => get(`/api/services${state ? `?state=${state}` : ''}`),
      serviceStatus: (name) => get(`/api/services/${encodeURIComponent(name)}`),
      serviceLogs:   (name, lines = 100) => get(`/api/services/${encodeURIComponent(name)}/logs?lines=${lines}`, { timeout: 10000 }),
      serviceAction: (name, verb) => post(`/api/services/${encodeURIComponent(name)}/${verb}`),

      // ── Network ──
      networkSnapshot: () => get('/api/network'),

      // ── Cron ──
      readCrontab:  () => get('/api/cron'),
      writeCrontab: (body) => put('/api/cron', { body }),

      terminalUrl:    () => `ws://${host}:${PORT}/terminal?token=${encodeURIComponent(apiKey)}`,
    };
  }

  window.makeApi = makeApi;
})();

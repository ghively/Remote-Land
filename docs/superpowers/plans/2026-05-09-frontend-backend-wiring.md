# NAS Terminal Sub-project 3 — Frontend / Backend Wiring Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. This is a no-build, no-npm frontend — verification is manual against a running backend (or demo mode for offline dev).

**Goal:** Wire the React frontend to the Sub-project 2 backend agent so the UI shows real CPU / RAM / disk / network, real Docker containers, and a real `bash` PTY over WebSocket. Preserve a demo mode that keeps the existing offline experience working.

**Spec:** `docs/superpowers/specs/2026-05-09-frontend-backend-wiring-design.md`

**Architecture summary:** New `api.js` REST client + `BackendContext.jsx` provider injected at the root. Login validates via `/api/health` + `/api/system/stats`. StatusBar / SystemMonitor / DockerManager / TerminalPane each consume `useBackend()`. xterm.js loaded via CDN for the real PTY pane. `apiKey === '__demo__'` is the single demo-mode flag.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `frontend/NAS Terminal.html` | xterm CDN tags, new JSX load order |
| Create | `frontend/api.js` | Plain JS — REST client factory `makeApi(host, apiKey)` |
| Create | `frontend/BackendContext.jsx` | `BackendProvider`, `useBackend`, heartbeat |
| Modify | `frontend/NASTerminal.jsx` | LoginScreen API-key field, BackendProvider wrap, live StatusBar |
| Modify | `frontend/SystemPanels.jsx` | Live `SystemMonitor` + `DockerManager` |
| Modify | `frontend/TerminalPane.jsx` | Add `WSTerminalSession`, branch on demo flag |
| Modify | `frontend/MediaAPIPanels.jsx` | Replace `ApiConfigPanel` with backend config; summary-only Radarr/Sonarr/Emby; hide SABnzbd from launcher |
| Modify | `frontend/AppLauncher.jsx` | Remove SABnzbd entry, rename API CONFIG → BACKEND CONFIG |

No new tests — frontend has no test harness. No npm. No build step.

---

### Task 1: CDN deps + REST client (`api.js`)

**Files:**
- Modify: `frontend/NAS Terminal.html`
- Create: `frontend/api.js`

- [ ] **Step 1: Add xterm.js CDN tags**

  In `frontend/NAS Terminal.html`, after line 8 (`wm-styles.css`):

  ```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.5.0/css/xterm.min.css">
  ```

  After the Babel script tag (around line 47) and **before** the JSX scripts:

  ```html
  <script src="https://cdn.jsdelivr.net/npm/xterm@5.5.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.10.0/lib/xterm-addon-fit.min.js"></script>
  <script src="api.js"></script>
  ```

  Note: `api.js` is plain JS (not Babel). Loaded *before* the JSX bundles so `window.makeApi` is defined when components mount.

- [ ] **Step 2: Create `frontend/api.js`**

  Plain, framework-free. Exposes `window.makeApi`.

  ```js
  /* api.js — REST client factory. Plain JS so it loads before Babel. */
  (function () {
    const PORT = 3001;

    function makeApi(host, apiKey) {
      const base = `http://${host}:${PORT}`;
      const auth = { 'x-api-key': apiKey };

      const get = async (path, opts = {}) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), opts.timeout || 5000);
        try {
          const res = await fetch(`${base}${path}`, { headers: auth, signal: ctrl.signal });
          if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
          const ct = res.headers.get('content-type') || '';
          return ct.includes('json') ? res.json() : res.text();
        } finally { clearTimeout(timer); }
      };

      const post = async (path, body) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        try {
          const res = await fetch(`${base}${path}`, {
            method: 'POST',
            headers: { ...auth, 'content-type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
            signal: ctrl.signal,
          });
          if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
          const ct = res.headers.get('content-type') || '';
          return ct.includes('json') ? res.json() : res.text();
        } finally { clearTimeout(timer); }
      };

      return {
        host, apiKey,
        health:         () => fetch(`${base}/api/health`, { signal: AbortSignal.timeout(3000) }).then(r => r.ok ? r.json() : Promise.reject(new Error(`health: HTTP ${r.status}`))),
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
  ```

- [ ] **Step 3: Smoke test in browser console**

  Open `frontend/NAS Terminal.html`. In DevTools console:

  ```js
  typeof window.makeApi          // 'function'
  typeof window.Terminal         // 'function' (xterm)
  typeof window.FitAddon         // 'object'
  ```

  Expected: all three resolve.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/api.js "frontend/NAS Terminal.html"
  git commit --no-gpg-sign -m "feat: add REST client and xterm CDN deps for backend wiring"
  ```

---

### Task 2: `BackendContext.jsx` — provider + heartbeat

**Files:**
- Create: `frontend/BackendContext.jsx`
- Modify: `frontend/NAS Terminal.html`

- [ ] **Step 1: Create `frontend/BackendContext.jsx`**

  ```jsx
  /* BackendContext.jsx — Connection state + heartbeat. */
  const BackendCtx = React.createContext(null);

  function BackendProvider({ host, apiKey, children }) {
    const api = React.useMemo(() => window.makeApi(host, apiKey), [host, apiKey]);
    const [status, setStatus] = React.useState(apiKey === '__demo__' ? 'demo' : 'connecting');
    const [lastError, setLastError] = React.useState(null);

    React.useEffect(() => {
      if (apiKey === '__demo__') { setStatus('demo'); return; }
      let alive = true;
      const tick = async () => {
        try {
          await api.health();
          if (alive) { setStatus('online'); setLastError(null); }
        } catch (err) {
          if (alive) { setStatus('offline'); setLastError(err.message); }
        }
      };
      tick();
      const iv = setInterval(tick, 5000);
      return () => { alive = false; clearInterval(iv); };
    }, [api, apiKey]);

    const value = React.useMemo(
      () => ({ host, apiKey, api, status, lastError, isDemo: apiKey === '__demo__' }),
      [host, apiKey, api, status, lastError]
    );
    return <BackendCtx.Provider value={value}>{children}</BackendCtx.Provider>;
  }

  function useBackend() { return React.useContext(BackendCtx); }

  window.BackendProvider = BackendProvider;
  window.useBackend = useBackend;
  ```

- [ ] **Step 2: Add to HTML load order**

  In `NAS Terminal.html`, insert **before** `WindowManager.jsx`:

  ```html
  <script type="text/babel" src="BackendContext.jsx"></script>
  ```

  Final order around the JSX block:
  ```
  api.js (plain)
  BackendContext.jsx
  WindowManager.jsx
  TerminalPane.jsx
  ...
  NASTerminal.jsx
  ```

- [ ] **Step 3: Smoke test**

  In console, after page loads:
  ```js
  typeof window.BackendProvider  // 'function'
  typeof window.useBackend       // 'function'
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/BackendContext.jsx "frontend/NAS Terminal.html"
  git commit --no-gpg-sign -m "feat: add BackendProvider context with heartbeat"
  ```

---

### Task 3: Login screen + provider wrap

**Files:**
- Modify: `frontend/NASTerminal.jsx`

- [ ] **Step 1: Add API-key field to `LoginScreen`**

  In `LoginScreen` (around line 23–108), add state:
  ```jsx
  const [apiKey, setApiKey] = useState('');
  ```

  Add a new field block after the password block:
  ```jsx
  <div>
    <div className="login-field-label">API_KEY</div>
    <input className="login-field" type="password" placeholder="leave blank for demo mode"
      value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="off" />
  </div>
  ```

- [ ] **Step 2: Replace simulated `doLogin` with real validation**

  Replace the existing `doLogin` body:

  ```jsx
  const doLogin = async (e) => {
    e && e.preventDefault();
    setError('');
    setLoading(true);

    if (!apiKey) {
      onLogin({ user: user || 'root', host, apiKey: '__demo__' });
      return;
    }

    try {
      const api = window.makeApi(host, apiKey);
      await api.health();          // throws if backend unreachable
      await api.systemStats();     // throws 401 if key wrong
      onLogin({ user: user || 'root', host, apiKey });
    } catch (err) {
      const msg = /HTTP 401/.test(err.message)
        ? '> AUTH FAILED: INVALID API KEY'
        : `> AUTH FAILED: ${err.message.toUpperCase()}`;
      setError(msg);
      setLoading(false);
    }
  };
  ```

  Remove the unused `VALID_CREDS` constant (lines 5–9). Update the demo-hint line below the submit button to:
  ```jsx
  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: -4 }}>
    Leave API_KEY blank for demo mode (mock data, no backend).
  </div>
  ```

- [ ] **Step 3: Wrap `WMDesktop` and `MobileDeck` in `BackendProvider`**

  In `NASTerminalApp` (root component), pass `apiKey` from auth and wrap the rendered tree:

  ```jsx
  if (!auth) return <LoginScreen onLogin={handleLogin} />;

  const inner = isMobile
    ? <MobileDeck user={auth.user} host={auth.host} sessions={mobileSessions} ... onLogout={handleLogout} />
    : <WMDesktop user={auth.user} host={auth.host} onLogout={handleLogout} />;

  return (
    <BackendProvider host={auth.host} apiKey={auth.apiKey}>
      {inner}
    </BackendProvider>
  );
  ```

  Update `handleLogin` so `auth` includes `apiKey` (already done in Step 2's `onLogin` call).

- [ ] **Step 4: Manual smoke**

  | Action | Expected |
  |---|---|
  | Open HTML, blank key, submit | Goes straight to desktop in demo mode |
  | Backend stopped, real key, submit | `> AUTH FAILED: BACKEND UNREACHABLE` |
  | Backend running, wrong key | `> AUTH FAILED: INVALID API KEY` |
  | Backend running, right key | Desktop loads; `useBackend().status === 'online'` |

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/NASTerminal.jsx
  git commit --no-gpg-sign -m "feat: validate backend on login, wire BackendProvider, demo mode fallback"
  ```

---

### Task 4: Status bar live stats

**Files:**
- Modify: `frontend/NASTerminal.jsx`

- [ ] **Step 1: Replace `StatusBar` random walk with backend polling**

  Replace the `useEffect` that updates `stats` (around lines 115–129):

  ```jsx
  const { api, status, isDemo } = useBackend();
  const [live, setLive] = useState(null);

  useEffect(() => {
    if (isDemo) return;            // keep simulated random walk via fallback below
    if (status !== 'online') return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await api.systemStats();
        if (alive) setLive(s);
      } catch (_) {}
    };
    tick();
    const iv = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(iv); };
  }, [api, status, isDemo]);

  // Cosmetic clock — keep as-is
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
      const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      setStats(s => ({ ...s, time, date }));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const cpuPct = isDemo ? stats.cpu : (live ? live.cpu.percent : null);
  const ramPct = isDemo ? stats.ram : (live ? Math.round(100 * live.ram.used / live.ram.total) : null);
  ```

  Render rules in the JSX:
  ```jsx
  <span className={`wb-val${cpuWarn ? ' ' + cpuWarn : ''}`}>
    {cpuPct == null ? '--' : `${cpuPct.toFixed(0)}%`}
  </span>
  ```

  Keep the existing demo-mode random walk by guarding it on `isDemo`:
  ```jsx
  useEffect(() => {
    if (!isDemo) return;
    const tick = () => setStats(s => ({
      ...s,
      cpu: Math.max(2, Math.min(98, s.cpu + (Math.random()*4-2))),
      ram: Math.max(20, Math.min(95, s.ram + (Math.random()*1-0.5))),
    }));
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [isDemo]);
  ```

- [ ] **Step 2: Add offline pill**

  In the right-side wb modules, before `cpu`:

  ```jsx
  {!isDemo && status === 'offline' && (
    <div className="wb-module" style={{ color: 'var(--neon-cyan)', textShadow: 'var(--bloom-cyan)' }}>
      [OFFLINE]
    </div>
  )}
  {isDemo && (
    <div className="wb-module" style={{ color: 'var(--neon-purple)' }}>
      [DEMO]
    </div>
  )}
  ```

- [ ] **Step 3: Manual smoke**

  - Real key + backend up: CPU/RAM numbers shift ~every 2s, match `htop` on the server.
  - Stop backend: `[OFFLINE]` appears within 5s; numbers freeze at last value or `--`.
  - Demo mode: `[DEMO]` pill; numbers wiggle as before.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/NASTerminal.jsx
  git commit --no-gpg-sign -m "feat: live CPU/RAM in StatusBar with offline indicator"
  ```

---

### Task 5: SystemMonitor — live processes

**Files:**
- Modify: `frontend/SystemPanels.jsx`

- [ ] **Step 1: Find `SystemMonitor` and locate its mock process source**

  ```bash
  grep -n "SystemMonitor\|MOCK_PROCESSES\|mockProcesses" frontend/SystemPanels.jsx
  ```

- [ ] **Step 2: Replace mock data with backend polling**

  Inside `SystemMonitor`:

  ```jsx
  const { api, isDemo } = useBackend();
  const [procs, setProcs] = useState(isDemo ? DEMO_PROCESSES : []);

  useEffect(() => {
    if (isDemo) return;
    let alive = true;
    const tick = async () => {
      try {
        const p = await api.processes();
        if (alive) setProcs(p);
      } catch (_) {}
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, [api, isDemo]);
  ```

  Keep the existing mock array but rename it `DEMO_PROCESSES`. Process row shape from backend: `{ user, pid, cpu, mem, cmd }` — matches what existing rendering already expects (verify column names match; rename in JSX if needed).

- [ ] **Step 3: Manual smoke**

  - Real backend: top processes match `ps aux --sort=-%cpu | head -21` on the server.
  - Filter / sort UI still works (those operate on local state — should be untouched).

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/SystemPanels.jsx
  git commit --no-gpg-sign -m "feat: SystemMonitor reads live processes from backend"
  ```

---

### Task 6: DockerManager — real containers

**Files:**
- Modify: `frontend/SystemPanels.jsx`

- [ ] **Step 1: Replace mock container source in `DockerManager`**

  ```jsx
  const { api, isDemo } = useBackend();
  const [containers, setContainers] = useState(isDemo ? DEMO_CONTAINERS : []);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (isDemo) return;
    let alive = true;
    const tick = async () => {
      try {
        const c = await api.containers();
        if (alive) { setContainers(c); setUnavailable(false); }
      } catch (err) {
        if (alive) setUnavailable(true);
      }
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, [api, isDemo]);
  ```

  When `unavailable && !isDemo`, render a banner:
  ```jsx
  <div style={{ padding: 12, color: '#ff5f56', textShadow: '0 0 4px #ff5f56', letterSpacing: 2 }}>
    [ DOCKER UNAVAILABLE — CHECK SOCKET / PERMISSIONS ]
  </div>
  ```

- [ ] **Step 2: Wire start/stop/logs**

  ```jsx
  const onStart = async (id) => {
    try { await api.startContainer(id); onNotify(`> STARTED ${id.slice(0,12)}`, 'ok'); }
    catch (e) { onNotify(`> START FAILED: ${e.message}`, 'crit'); }
  };
  const onStop = async (id) => {
    try { await api.stopContainer(id); onNotify(`> STOPPED ${id.slice(0,12)}`, 'ok'); }
    catch (e) { onNotify(`> STOP FAILED: ${e.message}`, 'crit'); }
  };
  const onLogs = async (id) => {
    try {
      const text = await api.containerLogs(id);
      setLogModal({ id, text });
    } catch (e) { onNotify(`> LOGS FAILED: ${e.message}`, 'crit'); }
  };
  ```

  In demo mode, keep the existing mock handlers (split with `isDemo ? mockOnStart : onStart`).

- [ ] **Step 3: Manual smoke**

  - Real backend: list matches `docker ps -a` output.
  - `[STOP]` on a test container: container stops within seconds; refresh shows `state: 'exited'`.
  - `[START]` on a stopped container: starts.
  - `[LOGS]` modal shows last 100 lines.
  - Stop Docker daemon (or run backend without Docker socket): banner appears.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/SystemPanels.jsx
  git commit --no-gpg-sign -m "feat: DockerManager talks to live Docker socket via backend"
  ```

---

### Task 7: TerminalPane — real PTY over WebSocket

**Files:**
- Modify: `frontend/TerminalPane.jsx`

- [ ] **Step 1: Add `WSTerminalSession` component near the top of the file**

  ```jsx
  function WSTerminalSession({ wsUrl }) {
    const containerRef = useRef(null);
    const wsRef = useRef(null);
    const termRef = useRef(null);

    useEffect(() => {
      const term = new window.Terminal({
        fontFamily: "'Courier New', monospace",
        fontSize: 13,
        cursorBlink: true,
        theme: { background: '#050505', foreground: '#ccffcc', cursor: '#00ff00' },
      });
      const fit = new window.FitAddon.FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      try { fit.fit(); } catch (_) {}
      termRef.current = term;

      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        if (ev.data instanceof ArrayBuffer) term.write(new Uint8Array(ev.data));
        else term.write(ev.data);
      };
      ws.onclose = (ev) => {
        const code = ev.code;
        const msg = code === 4401 ? 'unauthorized' : (ev.reason || 'closed');
        term.write(`\r\n\x1b[31m[disconnected: ${code} ${msg}]\x1b[0m\r\n`);
      };
      ws.onerror = () => term.write(`\r\n\x1b[31m[connection error]\x1b[0m\r\n`);
      ws.onopen = () => {
        try { fit.fit(); } catch (_) {}
        const { cols, rows } = term;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      };

      term.onData(d => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'input', data: d })));

      const onResize = () => {
        try { fit.fit(); } catch (_) { return; }
        const { cols, rows } = term;
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      };
      const ro = new ResizeObserver(onResize);
      ro.observe(containerRef.current);

      return () => { ro.disconnect(); ws.close(); term.dispose(); };
    }, [wsUrl]);

    return <div ref={containerRef} style={{ flex: 1, height: '100%', minHeight: 0, background: '#050505' }} />;
  }
  ```

- [ ] **Step 2: Branch `TerminalPane` on demo mode**

  Find the existing `TerminalPane` component definition. At the top of its body:

  ```jsx
  const { api, isDemo } = useBackend();
  if (!isDemo) {
    return <WSTerminalSession wsUrl={api.terminalUrl()} />;
  }
  // … existing simulated implementation continues unchanged …
  ```

  Tab UI is dropped in real mode — one PTY per window. Tabs remain in demo mode.

- [ ] **Step 3: Manual smoke**

  - Real backend on Linux: open a terminal pane, type `whoami`, `ls`, `htop`. Output streams in.
  - Resize the window — column count adjusts (test with `tput cols`).
  - Corrupt sessionStorage `nas_auth.apiKey` to a wrong value, refresh, open a terminal: red `[disconnected: 4401 unauthorized]` line appears.
  - Demo mode: simulated terminal still works as before.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/TerminalPane.jsx
  git commit --no-gpg-sign -m "feat: real PTY terminal via xterm.js + backend WebSocket"
  ```

---

### Task 8: Backend config panel + media summary mode

**Files:**
- Modify: `frontend/MediaAPIPanels.jsx`
- Modify: `frontend/AppLauncher.jsx`

- [ ] **Step 1: Replace `ApiConfigPanel` body**

  In `MediaAPIPanels.jsx`, replace `ApiConfigPanel` with a backend-connection editor. It reads `useBackend()`, lets the user change host + API key, persists to `sessionStorage.nas_auth`, and forces a page reload so the provider re-mounts.

  ```jsx
  function ApiConfigPanel({ onSave }) {
    const { host: curHost, apiKey: curKey } = useBackend();
    const [host, setHost] = useState(curHost);
    const [apiKey, setApiKey] = useState(curKey === '__demo__' ? '' : curKey);

    const save = () => {
      const auth = JSON.parse(sessionStorage.getItem('nas_auth') || '{}');
      sessionStorage.setItem('nas_auth', JSON.stringify({
        ...auth, host, apiKey: apiKey || '__demo__',
      }));
      onSave && onSave();
      location.reload();
    };

    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
        <div style={{ color: 'var(--neon-cyan)', fontSize: '0.85rem', letterSpacing: 2,
                      textShadow: 'var(--bloom-cyan)', borderBottom: '2px solid var(--neon-purple)', paddingBottom: 8 }}>
          BACKEND_CONFIGURATION
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.8 }}>
          &gt; Host of the NAS Terminal backend agent (port 3001).<br/>
          &gt; API key matches `apiKey` in backend/config.json on the server.<br/>
          &gt; Leave API key blank to switch to demo mode.
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>HOST</div>
          <input className="logview-filter" style={{ width: '100%' }}
            value={host} onChange={e => setHost(e.target.value)} placeholder="nas.local" />
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>API_KEY</div>
          <input className="logview-filter" style={{ width: '100%' }} type="password"
            value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="leave blank for demo" />
        </div>
        <button className="cmd-btn" style={{ width: '100%', textAlign: 'center', letterSpacing: 2 }} onClick={save}>
          [ SAVE_AND_RECONNECT ]
        </button>
      </div>
    );
  }
  ```

  Remove the old per-service `loadConfig` / `saveConfig` helpers if no other panel uses them. Search:
  ```bash
  grep -n "loadConfig\|nas_api_config" frontend/*.jsx
  ```
  Only delete the helpers if there are no remaining consumers. If `MediaPanelsFull.jsx` still references them, leave them in place (Sub-project 4 / future work).

- [ ] **Step 2: Convert Radarr / Sonarr panels to summary cards**

  Replace bodies of `RadarrPanel` and `SonarrPanel` with a small status card driven by the backend proxy:

  ```jsx
  function RadarrPanel({ onOpenWebUI }) {
    const { api, isDemo } = useBackend();
    const [data, setData] = useState(null);
    const [offline, setOffline] = useState(false);

    useEffect(() => {
      if (isDemo) { setData({ queueSize: 3, upcoming: 5 }); return; }
      let alive = true;
      const tick = async () => {
        try {
          const d = await api.radarr();
          if (!alive) return;
          if (d && d.status === 'offline') { setOffline(true); setData(null); }
          else { setData(d); setOffline(false); }
        } catch (_) { if (alive) setOffline(true); }
      };
      tick();
      const iv = setInterval(tick, 30000);
      return () => { alive = false; clearInterval(iv); };
    }, [api, isDemo]);

    return (
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
        <div style={{ color: 'var(--neon-cyan)', letterSpacing: 2 }}>[RADARR_SUMMARY]</div>
        {offline && <div style={{ color: '#ff5f56' }}>[ RADARR OFFLINE ]</div>}
        {data && (
          <>
            <div>QUEUE: <span style={{ color: 'var(--neon-green)' }}>{data.queueSize}</span></div>
            <div>UPCOMING (7d): <span style={{ color: 'var(--neon-green)' }}>{data.upcoming}</span></div>
          </>
        )}
        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
          [ DEEP DATA — REQUIRES BACKEND v2 ]
        </div>
        <button className="cmd-btn" onClick={onOpenWebUI}>[ OPEN RADARR WEB UI ]</button>
      </div>
    );
  }
  ```

  Mirror the same pattern for `SonarrPanel`. Add an analogous `EmbyPanel` that reads `api.emby()` and shows `serverName`, `version`, `activeSessions`. Wire it into the launcher in Step 4.

- [ ] **Step 3: Hide SABnzbd**

  - In `MediaAPIPanels.jsx`, leave `SABnzbdPanel` defined (don't break imports) but remove its launcher entry.
  - Remove the `sabnzbd` window type from `WIN_DEFAULTS` in `NASTerminal.jsx` if and only if no launcher entry uses it. Otherwise leave for demo mode.

- [ ] **Step 4: Update launcher**

  In `frontend/AppLauncher.jsx`, find the apps registry. Remove or comment out the `sabnzbd` entry. Rename the `apicfg` entry's display label from `API CONFIG` → `BACKEND CONFIG`.

  Add an `emby` entry pointing at the new `EmbyPanel` (or skip if scope-creep — the spec doesn't require Emby in launcher).

- [ ] **Step 5: Manual smoke**

  - Open Backend Config panel: shows current host/key. Change key, save, page reloads, status flips.
  - Open Radarr panel against real Radarr (with key in `backend/config.json`): shows queue + upcoming.
  - Wrong Radarr key in backend config → backend returns `{status:"offline"}` → panel shows `[ RADARR OFFLINE ]`.
  - Demo mode: all three media panels show fixed demo values.

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/MediaAPIPanels.jsx frontend/AppLauncher.jsx frontend/NASTerminal.jsx
  git commit --no-gpg-sign -m "feat: backend config panel, summary-only Radarr/Sonarr, hide SABnzbd"
  ```

---

### Task 9: Final verification + push

- [ ] **Step 1: Run through the spec's test plan**

  All 11 rows from `docs/superpowers/specs/2026-05-09-frontend-backend-wiring-design.md` § Test Plan. Tick off as each passes. Anything that fails — fix in a focused commit before moving on.

- [ ] **Step 2: Browser console must be clean**

  No 404s on JSX/CSS files. No React warnings. `Loading chunk failed` or Babel parse errors are blockers.

- [ ] **Step 3: Push**

  ```bash
  git push -u origin claude/review-remaining-tasks-F1ad6
  ```

- [ ] **Step 4: Update CLAUDE.md / README roadmap**

  Mark Sub-project 3 as ✅ Complete in both files. Commit as a separate `docs:` change so the implementation commits stay focused.

---

## Self-Review

**Spec coverage:**

| Spec success criterion | Task |
|---|---|
| Login validates API key against backend | Task 3 |
| `sessionStorage.nas_auth` holds `{user,host,apiKey}` | Task 3 |
| Status bar live `/api/system/stats` every 2s | Task 4 |
| Heartbeat flips `[OFFLINE]` within 5s | Task 2 + Task 4 |
| `SystemMonitor` real processes | Task 5 |
| `DockerManager` real containers + start/stop | Task 6 |
| `TerminalPane` real PTY over WebSocket | Task 7 |
| WebSocket auth failure visible | Task 7 (4401 banner) |
| Demo mode preserves mock-everything experience | Tasks 3–8 (all gated on `isDemo`) |
| No per-service keys in browser storage | Task 8 |
| `BackendConfigPanel` lets user change host/key | Task 8 |
| No new hardcoded colors | All tasks (use existing tokens) |
| No build step / no npm | All tasks (CDN xterm only) |

**Risk flags:**
- xterm.js sometimes fails `fit()` on initial mount before container has dimensions. Plan wraps the call in `try/catch` and re-fits on `ResizeObserver`.
- Removing `VALID_CREDS` is a behavioral change — login no longer accepts blank credentials except as the demo trigger. Demo hint copy is updated.
- The Sub-project 2 backend's `/api/system/stats` includes a 500 ms blocking sleep (CPU sample window). Polling every 2 s is fine; tighter polling would saturate.
- No automatic re-validation of the API key after the page sits idle. The 5 s heartbeat is enough for connection state but a stale key only surfaces on the next request — acceptable for v1.

**Out of scope, deliberately:**
- File manager, log viewer, services, network map, cron, browser, full Radarr/Sonarr/SAB dashboards — flagged in spec § Non-Goals.
- HTTPS / WSS — local network only.
- Multi-user auth — single shared backend key.

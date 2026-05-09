# NAS Terminal — Sub-project 3: Frontend / Backend Wiring

**Date:** 2026-05-09
**Status:** Draft
**Author:** Gene Hively

---

## Overview

Replace the frontend's mock data and simulated terminal with live calls to
the Sub-project 2 backend agent. After this sub-project, the UI shows real
CPU/RAM/disk/network for the actual server, lists real Docker containers,
and the terminal pane runs an actual `bash` PTY over WebSocket. Login
collects the backend API key once and the frontend authenticates every
request with it.

---

## Project Decomposition

| # | Sub-project | Status |
|---|-------------|--------|
| 1 | Project Foundation | ✅ Complete |
| 2 | Backend Server Agent | ✅ Complete |
| 3 | **Frontend / Backend Wiring** ← this spec | In Progress |
| 4 | AI Features | Planned |

---

## Goals

1. Login screen collects host + backend API key, validates the backend is
   reachable before granting access.
2. Status bar CPU/RAM percentages reflect the real server, not random walk.
3. `SystemMonitor` shows real top-N processes from `/api/system/processes`.
4. `DockerManager` lists real containers and start/stop buttons hit the
   real Docker socket via the backend.
5. `TerminalPane` is replaced with a real PTY over `WS /terminal`.
6. Media API panels (Radarr, Sonarr) read summary stats from the backend
   proxy. Per-service API keys live in the backend `config.json` only —
   never in the browser.
7. Connection failures degrade gracefully to a clear error state. They do
   not crash the UI or fall back to mock data silently.

---

## Non-Goals (for this sub-project)

- AI features — chat panel, NL→shell, log analysis. Sub-project 4.
- Full Radarr/Sonarr/SABnzbd dashboards (movie lists, queue tables,
  per-item actions). Sub-project 2 only exposes summary endpoints; the
  rich panels stay on mock data until the backend is extended in a later
  iteration.
- HTTPS/WSS. Local network usage assumes plain `http://` and `ws://`.
- Multi-user accounts. The backend uses one shared API key; the login
  screen's "user" field is cosmetic (used in the prompt and status bar).
- File manager, log viewer, services, network map, cron editor, browser —
  all stay on mock data. Adding endpoints for those is out of scope here.

---

## Architecture

```
Browser
  ├─ on login:        POST /api/health (no auth) → 200 OK
  │                    GET /api/system/stats with x-api-key → 200 OK
  ├─ status bar:      GET /api/system/stats          (poll every 2s)
  ├─ SystemMonitor:   GET /api/system/processes      (poll every 5s)
  ├─ DockerManager:   GET /api/docker/containers     (poll every 5s)
  │                   POST /api/docker/:id/start
  │                   POST /api/docker/:id/stop
  │                   GET  /api/docker/:id/logs
  ├─ Media panels:    GET /api/media/emby            (summary only)
  │                   GET /api/media/radarr          (summary only)
  │                   GET /api/media/sonarr          (summary only)
  └─ TerminalPane:    WS  /terminal?token=<apiKey>   (per terminal session)
```

**Auth model.** One backend API key, entered at login, kept in
`sessionStorage` under `nas_auth.apiKey`. Sent on every REST call as
`x-api-key` header. WebSocket terminal sessions append it as the
`?token=` query parameter (matches the backend's existing `terminal.js`).

**Connection state.** A new top-level React context (`BackendContext`)
exposes `{ host, apiKey, status, lastError }` and a typed `api` client.
Components read from it instead of building URLs ad hoc.

---

## File Structure

```
frontend/
├── api.js              ← NEW: REST client + auth header injection (window.api)
├── BackendContext.jsx  ← NEW: connection state + provider (window.useBackend)
├── BackendConfigPanel.jsx ← NEW: replaces ApiConfigPanel (host + backend key)
├── NASTerminal.jsx     ← MODIFY: login uses real /api/health, StatusBar polls
├── SystemPanels.jsx    ← MODIFY: SystemMonitor reads /api/system/processes
├── DockerPanels.jsx    ← NEW (extracted from SystemPanels): real Docker calls
├── TerminalPane.jsx    ← MODIFY: real WebSocket PTY (kept simulator behind flag)
├── MediaAPIPanels.jsx  ← MODIFY: summary-only mode, points at backend proxy
└── NAS Terminal.html   ← MODIFY: load order for new files
```

`api.js` and `BackendContext.jsx` come first in the load order; every
panel that needs live data reads from the context.

---

## REST Client (`api.js`)

```js
function makeApi(host, apiKey) {
  const base = `http://${host}:3001`;  // port from config.example.json
  const auth = { 'x-api-key': apiKey };
  const get = async (path, opts = {}) => {
    const res = await fetch(`${base}${path}`, {
      headers: auth,
      signal: AbortSignal.timeout(opts.timeout || 5000),
    });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res.json();
  };
  const post = async (path, body) => {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res.headers.get('content-type')?.includes('json') ? res.json() : res.text();
  };
  return {
    health:        () => fetch(`${base}/api/health`).then(r => r.json()),
    systemStats:   () => get('/api/system/stats'),
    processes:     () => get('/api/system/processes'),
    containers:    () => get('/api/docker/containers'),
    startContainer:(id) => post(`/api/docker/${id}/start`),
    stopContainer: (id) => post(`/api/docker/${id}/stop`),
    containerLogs: (id) => get(`/api/docker/${id}/logs`, { timeout: 10000 }),
    emby:          () => get('/api/media/emby'),
    radarr:        () => get('/api/media/radarr'),
    sonarr:        () => get('/api/media/sonarr'),
    terminalUrl:   () => `ws://${host}:3001/terminal?token=${encodeURIComponent(apiKey)}`,
  };
}
window.makeApi = makeApi;
```

Frontend never reads `process.env`, never reads `localStorage` directly
for auth; it reads from the context.

---

## BackendContext

```jsx
const BackendCtx = React.createContext(null);

function BackendProvider({ host, apiKey, children }) {
  const api = React.useMemo(() => makeApi(host, apiKey), [host, apiKey]);
  const [status, setStatus] = React.useState('connecting'); // 'connecting' | 'online' | 'offline'
  const [lastError, setLastError] = React.useState(null);

  // Heartbeat — drives connection indicator in StatusBar
  React.useEffect(() => {
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
  }, [api]);

  return <BackendCtx.Provider value={{ host, apiKey, api, status, lastError }}>{children}</BackendCtx.Provider>;
}

const useBackend = () => React.useContext(BackendCtx);
window.BackendProvider = BackendProvider;
window.useBackend = useBackend;
```

---

## Login Flow

`LoginScreen` gains a third field: **API KEY** (password-masked input).

```
USER@HOST   [ root ] @ [ nas.local ]
PASSWORD    [ ******** ]               ← cosmetic, not sent
API KEY     [ ******** ]               ← required, saved to sessionStorage
[ INITIATE_SESSION ]
```

On submit:

1. `fetch http://<host>:3001/api/health` → expect `{status:"ok"}`.
   - Failure → `> AUTH FAILED: BACKEND UNREACHABLE AT <host>:3001`.
2. `fetch http://<host>:3001/api/system/stats` with `x-api-key`.
   - 401 → `> AUTH FAILED: INVALID API KEY`.
   - Other failure → `> AUTH FAILED: <message>`.
3. Success → write `{ user, host, apiKey }` to `sessionStorage.nas_auth`,
   render `BackendProvider` wrapping `WMDesktop`.

**Demo mode shortcut.** If user leaves the API key blank, set
`apiKey = '__demo__'` and skip the backend probe — render a banner in
the status bar saying `[DEMO MODE — NO BACKEND]` and let panels fall back
to existing mock implementations. This preserves the "open the HTML file
and play with it" workflow described in the README.

`apiKey === '__demo__'` is the single source of truth for demo mode.
Panels read it from `useBackend()` and short-circuit to mock data.

---

## Status Bar — Live Stats

`StatusBar` replaces its random-walk CPU/RAM with:

```jsx
const { api, status } = useBackend();
const [stats, setStats] = useState(null);

useEffect(() => {
  if (status !== 'online') return;
  let alive = true;
  const tick = async () => {
    try {
      const s = await api.systemStats();
      if (alive) setStats(s);
    } catch (_) { /* heartbeat will flip to offline */ }
  };
  tick();
  const iv = setInterval(tick, 2000);
  return () => { alive = false; clearInterval(iv); };
}, [api, status]);
```

Render rules:
- `status === 'online'`: real `cpu.percent`, `ram.used / ram.total`,
  uptime computed from a startup timestamp returned by stats (TBD —
  backend currently doesn't return uptime; v1 keeps the existing
  cosmetic uptime string).
- `status === 'offline'`: `CPU --` `RAM --` with cyan `[OFFLINE]` pill.
- `status === 'connecting'` or demo mode: existing simulated values.

---

## SystemMonitor — Live Processes

`SystemPanels.jsx::SystemMonitor` swaps its mock list for:

```jsx
const { api } = useBackend();
const [procs, setProcs] = useState([]);
useEffect(() => {
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
}, [api]);
```

Filter and sort UI stay client-side. Process row shape matches the
backend output: `{ user, pid, cpu, mem, cmd }`.

---

## Docker Manager — Real Containers

`DockerManager`:

- Initial render: `api.containers()` populates the list.
- Poll every 5 seconds while panel is open.
- `[ START ]` / `[ STOP ]` buttons call `api.startContainer(id)` /
  `api.stopContainer(id)`. On 503, surface the error toast via
  `onNotify('> DOCKER UNAVAILABLE', 'crit')`.
- `[ LOGS ]` opens a modal that streams text from `api.containerLogs(id)`
  (one-shot fetch — last 100 lines as the backend currently returns).
  Live streaming logs is out of scope for this sub-project.

---

## TerminalPane — Real WebSocket PTY

The current `TerminalPane` keeps its own buffer/history simulator. We
add a parallel implementation that uses the backend WebSocket and pick
between them based on demo mode.

**New: `WSTerminalSession` component.**

```jsx
function WSTerminalSession({ wsUrl }) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const termRef = useRef(null);

  useEffect(() => {
    // xterm.js loaded via CDN <script> tags in NAS Terminal.html:
    //   xterm@5, xterm-addon-fit
    const term = new window.Terminal({
      fontFamily: 'var(--font-mono)',  // resolved via canvas, fallback to 'Courier New'
      fontSize: 13,
      theme: { background: '#050505', foreground: '#ccffcc', cursor: '#00ff00' },
    });
    const fit = new window.FitAddon.FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(ev.data));
      } else {
        term.write(ev.data);
      }
    };
    ws.onclose = (ev) => term.write(`\r\n\x1b[31m[disconnected: ${ev.code}]\x1b[0m\r\n`);
    ws.onerror = ()  => term.write(`\r\n\x1b[31m[connection error]\x1b[0m\r\n`);

    term.onData(d => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'input', data: d })));

    const onResize = () => {
      fit.fit();
      const { cols, rows } = term;
      ws.readyState === 1 && ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); ws.close(); term.dispose(); };
  }, [wsUrl]);

  return <div ref={containerRef} style={{ flex: 1, height: '100%' }} />;
}
```

`xterm.js` loads via CDN (matches the project's no-build constraint).
`NAS Terminal.html` adds:

```html
<link  rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.5.0/css/xterm.min.css">
<script src="https://cdn.jsdelivr.net/npm/xterm@5.5.0/lib/xterm.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.10.0/lib/xterm-addon-fit.min.js"></script>
```

`TerminalPane` chooses:

```jsx
const { apiKey, api } = useBackend();
return apiKey === '__demo__'
  ? <SimulatedTerminalPane {...props} />
  : <WSTerminalSession wsUrl={api.terminalUrl()} />;
```

`SimulatedTerminalPane` is the current `TermSession`-based component,
renamed and kept untouched. This guarantees demo mode still works.

---

## Media Panels — Summary via Backend Proxy

The current panels (`RadarrPanel`, `SonarrPanel`, `SABnzbdPanel`) call
upstream services directly with per-service keys stored in
`localStorage.nas_api_config`. That model leaks credentials to the
browser and conflicts with the backend's "all upstream keys live in
config.json" model.

**Decision for v1:**

- Replace `ApiConfigPanel` with a new `BackendConfigPanel` that edits
  only `{ host, apiKey }` for the backend itself. The old per-service
  keys panel is removed; its localStorage entry (`nas_api_config`) is
  ignored on read (orphaned data left in place — no migration needed).
- `RadarrPanel` / `SonarrPanel` collapse to a **summary card**:
  - Radarr: `queueSize` + `upcoming` count from `api.radarr()`.
  - Sonarr: `queueSize` + `upcoming` count from `api.sonarr()`.
  - Emby: `activeSessions`, `serverName`, `version` from `api.emby()`.
- `SABnzbdPanel` is **hidden from the launcher** in v1. The backend
  doesn't expose SABnzbd. Re-enable when a future backend iteration
  adds `/api/media/sabnzbd`.
- Full movie/episode/queue lists are noted in each panel as
  `[ DEEP DATA — REQUIRES BACKEND v2 ]` so users understand the gap.

This is a deliberate feature regression in exchange for a clean security
model. Re-expansion is one of the first items in Sub-project 4 / future
work.

---

## Error Handling

| Failure | Behaviour |
|---------|-----------|
| Login: `/api/health` unreachable | Inline error on login screen, no session created |
| Login: `/api/system/stats` returns 401 | Inline error, no session created |
| Heartbeat fails after login | Status bar pill flips to `[OFFLINE]`, panels show `--` |
| `/api/system/stats` polling fails | Last known values stay; heartbeat handles indicator |
| `/api/docker/containers` returns 503 | Panel shows `[ DOCKER UNAVAILABLE ]`; controls disabled |
| `/api/media/*` returns `{status:"offline"}` | Panel shows `[ <SERVICE> OFFLINE ]` pill |
| WebSocket close code 4401 | `WSTerminalSession` shows red `[unauthorized: 4401]` and stops reconnecting |
| WebSocket close code 1011 | Show `[server: <reason>]` from the close event |
| Demo mode (`apiKey === '__demo__'`) | All panels use existing mock data; no network calls |

No silent fallback to mock data when authenticated — failures are
visible. Demo mode is the only path where mock data appears.

---

## CDN Dependencies Added

| Library | Version | Purpose |
|---------|---------|---------|
| xterm.js | 5.5.0 | Terminal renderer |
| xterm-addon-fit | 0.10.0 | Auto-resize PTY cols/rows to container |

Loaded via `<link>` and `<script>` tags in `NAS Terminal.html`. No npm,
matching the project's no-build constraint.

---

## Test Plan

This sub-project lives in the no-build, no-npm frontend. There is no
unit test harness. Verification is manual against a running backend.

| # | Step | Expected |
|---|------|----------|
| 1 | Open `frontend/NAS Terminal.html`, leave API key blank, log in | Demo mode banner; mock data everywhere; no network errors in console |
| 2 | Stop backend; enter real API key; submit | `> AUTH FAILED: BACKEND UNREACHABLE` |
| 3 | Start backend with wrong key; submit | `> AUTH FAILED: INVALID API KEY` |
| 4 | Start backend with right key; submit | Login passes; status bar shows real CPU/RAM |
| 5 | Stop backend mid-session | `[OFFLINE]` pill; numbers stop updating; no crash |
| 6 | Restart backend | `[OFFLINE]` clears within 5s; numbers resume |
| 7 | Open SystemMonitor | Real top-20 process list; sort/filter still works |
| 8 | Open DockerManager | Real container list; `[STOP]` actually stops a test container |
| 9 | Open Terminal pane | Real bash prompt; `ls` works; resize the window — PTY resizes |
| 10 | Wrong key in URL token (manually corrupt sessionStorage) | WebSocket closes 4401, terminal shows red unauthorized banner |
| 11 | Open Radarr panel against real Radarr | Shows `queueSize` and `upcoming` count from backend |

---

## Success Criteria

- [ ] Login screen requires backend API key, validates against `/api/health` + `/api/system/stats` before granting access
- [ ] `sessionStorage.nas_auth` contains `{ user, host, apiKey }`; cleared on logout
- [ ] Status bar polls `/api/system/stats` every 2 s; renders real values
- [ ] Heartbeat indicator flips to `[OFFLINE]` within 5 s of backend going down
- [ ] `SystemMonitor` shows real `ps`-derived processes; refreshes every 5 s
- [ ] `DockerManager` shows real containers; start/stop actually starts/stops
- [ ] `TerminalPane` runs real `bash` over WebSocket; output streams; resize works
- [ ] WebSocket auth failure surfaces as visible error (no silent reconnect spam)
- [ ] Demo mode (blank API key) preserves the original mock-everything experience
- [ ] No per-service API keys (Radarr/Sonarr/SAB) live in browser storage
- [ ] `BackendConfigPanel` lets the user change host/key post-login without re-login
- [ ] All UI changes use existing CSS tokens — no new hardcoded colors
- [ ] All upstream JSX is loaded via `<script type="text/babel">` tags — no build step introduced

---

## Open Questions

1. **Uptime in `/api/system/stats`?** The status bar currently shows a
   cosmetic uptime. Adding `uptime` to the backend response is trivial
   (`os.uptime()`) — worth doing as part of this sub-project, or defer?
2. **Logs streaming.** Backend `getLogs` returns last 100 lines as a
   one-shot. Live streaming requires either polling or a new WS endpoint
   — out of scope here, but worth flagging for a future iteration.
3. **Terminal session reuse.** Currently each `TerminalPane` window
   spawns a fresh PTY. Should we keep that, or share a single PTY across
   tabs? v1 says fresh per-window; revisit if it feels wrong in use.

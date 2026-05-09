/* NASTerminal.jsx — Main app: Login, Status Bar, WM Orchestrator, Mobile Deck */
const { useState, useEffect, useRef, useCallback } = React;

// ── Boot sequence lines ───────────────────────────────────────────────────────
const BOOT_LINES = [
  { text: '> BIOS POST... OK',                         type: 'ok',   delay: 0 },
  { text: '> LOADING KERNEL 6.1.0-21-amd64...',        type: 'info', delay: 180 },
  { text: '> MOUNTING FILE SYSTEMS... SUCCESS',         type: 'ok',   delay: 360 },
  { text: '> STARTING NETWORK MANAGER... SUCCESS',      type: 'ok',   delay: 520 },
  { text: '> ESTABLISHING SSH DAEMON... SUCCESS',       type: 'ok',   delay: 700 },
  { text: '> LOADING NAS_TERMINAL v1.0.0...',           type: 'info', delay: 900 },
  { text: '> READY FOR INPUT.',                         type: 'ok',   delay: 1050 },
];

// ── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [user, setUser]     = useState('');
  const [pass, setPass]     = useState('');
  const [host, setHost]     = useState('nas.local');
  const [apiKey, setApiKey] = useState('');
  const [error, setError]   = useState('');
  const [bootIdx, setBootIdx] = useState(0);
  const [booted, setBooted]   = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timers = BOOT_LINES.map((line, i) =>
      setTimeout(() => {
        setBootIdx(i + 1);
        if (i === BOOT_LINES.length - 1) setTimeout(() => setBooted(true), 200);
      }, line.delay + 300)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const doLogin = async (e) => {
    e && e.preventDefault();
    setError('');
    setLoading(true);

    // Blank API key = demo mode (mock data, no backend probe).
    if (!apiKey) {
      onLogin({ user: user || 'root', host, apiKey: '__demo__' });
      return;
    }

    try {
      const api = window.makeApi(host, apiKey);
      await api.health();        // backend reachable?
      await api.systemStats();   // 401 if API key wrong
      onLogin({ user: user || 'root', host, apiKey });
    } catch (err) {
      const msg = /HTTP 401/.test(err.message)
        ? '> AUTH FAILED: INVALID API KEY'
        : `> AUTH FAILED: ${err.message.toUpperCase()}`;
      setError(msg);
      setLoading(false);
    }
  };

  const colorMap = { ok: 'var(--neon-green)', info: 'var(--neon-cyan)', warn: '#ffbd2e' };

  return (
    <div id="login-screen">
      <div className="login-panel">
        <div className="login-title">NAS_TERMINAL</div>
        <div className="login-subtitle">CYBER-NOIR SERVER MANAGEMENT INTERFACE v1.0.0</div>

        <div className="login-boot-lines">
          {BOOT_LINES.slice(0, bootIdx).map((l, i) => (
            <span key={i} className="boot-line" style={{ color: colorMap[l.type] || 'var(--text-dim)' }}>
              {l.text}
            </span>
          ))}
          {bootIdx < BOOT_LINES.length && (
            <span className="cursor-block" style={{ color: 'var(--neon-purple)' }}>█</span>
          )}
        </div>

        {booted && (
          <form onSubmit={doLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div className="login-field-label">USER@HOST</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="login-field" style={{ flex: 1 }} placeholder="root"
                  value={user} onChange={e => setUser(e.target.value)} autoFocus autoComplete="off" />
                <span style={{ color: 'var(--text-dim)', alignSelf: 'center', fontSize: '0.9rem' }}>@</span>
                <input className="login-field" style={{ flex: 1 }} placeholder="nas.local"
                  value={host} onChange={e => setHost(e.target.value)} />
              </div>
            </div>
            <div>
              <div className="login-field-label">PASSWORD</div>
              <input className="login-field" type="password" placeholder="••••••••"
                value={pass} onChange={e => setPass(e.target.value)} />
            </div>
            <div>
              <div className="login-field-label">API_KEY</div>
              <input className="login-field" type="password" placeholder="leave blank for demo mode"
                value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="off" />
            </div>
            <div className="login-error">{error}</div>
            <button type="submit" className="cmd-btn" style={{ width: '100%', textAlign: 'center', fontSize: '0.95rem', letterSpacing: 2 }}
              disabled={loading}>
              {loading ? '> AUTHENTICATING...' : '[ INITIATE_SESSION ]'}
            </button>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: -4 }}>
              Leave API_KEY blank for demo mode (mock data, no backend).
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Status Bar — Waybar-inspired ──────────────────────────────────────────────
function StatusBar({ user, host, windows, onOpenLauncher, onLogout, onToggleTile, tileMode }) {
  const { api, status, isDemo } = useBackend();
  const [stats, setStats] = useState({ cpu: 14, ram: 42, uptime: '42d 7h', time: '', date: '' });
  const [live, setLive] = useState(null);
  const [activeWs, setActiveWs] = useState(1);

  // Cosmetic clock — runs in every mode.
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

  // Demo random walk — only when no real backend.
  useEffect(() => {
    if (!isDemo) return;
    const iv = setInterval(() => {
      setStats(s => ({
        ...s,
        cpu: Math.max(2, Math.min(98, s.cpu + (Math.random()*4-2))),
        ram: Math.max(20, Math.min(95, s.ram + (Math.random()*1-0.5))),
      }));
    }, 1000);
    return () => clearInterval(iv);
  }, [isDemo]);

  // Real polling — only while backend is online.
  useEffect(() => {
    if (isDemo || status !== 'online' || !api) return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await api.systemStats();
        if (alive) setLive(s);
      } catch (_) { /* heartbeat owns the offline indicator */ }
    };
    tick();
    const iv = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(iv); };
  }, [api, status, isDemo]);

  const cpuPct = isDemo ? stats.cpu : (live ? live.cpu.percent : null);
  const ramPct = isDemo ? stats.ram : (live ? Math.round(100 * live.ram.used / live.ram.total) : null);
  const cpuWarn = cpuPct == null ? '' : cpuPct > 85 ? 'crit' : cpuPct > 65 ? 'warn' : '';
  const ramWarn = ramPct == null ? '' : ramPct > 85 ? 'crit' : ramPct > 65 ? 'warn' : '';

  // Workspace numbers — matches Hyprland workspaces 1-9
  const workspaces = [1,2,3,4,5,6,7,8,9];
  const occupiedWs = [1,2,3]; // simulate occupied workspaces

  return (
    <div id="status-bar">
      {/* Left — menu button + workspaces (like Waybar left modules) */}
      <div className="wb-left">
        <button className="wb-module menu" onClick={onOpenLauncher} title="Alt+Space — App Launcher">
          ❯_
        </button>
        <div className="wb-workspace">
          {workspaces.map(n => (
            <button
              key={n}
              className={`wb-ws-btn${n === activeWs ? ' active' : occupiedWs.includes(n) ? ' occupied' : ''}`}
              onClick={() => setActiveWs(n)}
              title={`Workspace ${n}`}
            >{n}</button>
          ))}
        </div>
        <div className="wb-module user">
          <span className="wb-val">{user}@{host}</span>
        </div>
      </div>

      {/* Center — clock (like Waybar center) */}
      <div className="wb-center">
        <div className="wb-module clock">
          <span className="wb-val">{stats.time}</span>
          <span className="wb-label" style={{ marginLeft: 6 }}>{stats.date}</span>
        </div>
      </div>

      {/* Right — system stats + controls (like Waybar right modules) */}
      <div className="wb-right">
        {isDemo && (
          <div className="wb-module" style={{ color: 'var(--neon-purple)', textShadow: 'var(--bloom-purple, 0 0 4px var(--neon-purple))', letterSpacing: 2 }}>
            [DEMO]
          </div>
        )}
        {!isDemo && status === 'offline' && (
          <div className="wb-module" style={{ color: 'var(--neon-cyan)', textShadow: 'var(--bloom-cyan)', letterSpacing: 2 }}>
            [OFFLINE]
          </div>
        )}
        <div className="wb-module cpu">
          <span className="wb-label">CPU</span>
          <span className={`wb-val${cpuWarn ? ' ' + cpuWarn : ''}`}>
            {cpuPct == null ? '--' : `${cpuPct.toFixed(0)}%`}
          </span>
        </div>
        <div className="wb-module ram">
          <span className="wb-label">RAM</span>
          <span className={`wb-val${ramWarn ? ' ' + ramWarn : ''}`}>
            {ramPct == null ? '--' : `${ramPct.toFixed(0)}%`}
          </span>
        </div>
        <div className="wb-module uptime">
          <span className="wb-label">UP</span>
          <span className="wb-val">{stats.uptime}</span>
        </div>
        <button className="wb-module btn" onClick={onToggleTile} title={tileMode ? 'Float mode (Super+Space)' : 'Tile mode (Super+Space)'} style={{ fontSize: 11 }}>
          {tileMode ? '⊞' : '⊟'}
        </button>
        <button className="wb-module btn danger" onClick={onLogout} title="Logout">⏻</button>
      </div>
    </div>
  );
}

// ── Notification stack ────────────────────────────────────────────────────────
function NotifStack({ notifs }) {
  return (
    <div id="notif-stack">
      {notifs.map(n => (
        <div key={n.id} className={`notif ${n.cls}`}>{n.msg}</div>
      ))}
    </div>
  );
}

// ── Webapp pane ───────────────────────────────────────────────────────────────
function WebappPane({ url, name }) {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [inputUrl, setInputUrl] = useState(url);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="webapp-toolbar">
        <button className="cmd-btn-sm cyan" onClick={() => setCurrentUrl(url)} title="Home">[HOME]</button>
        <button className="cmd-btn-sm" onClick={() => {}} title="Reload">[RELOAD]</button>
        <input
          className="webapp-url-bar"
          value={inputUrl}
          onChange={e => setInputUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') setCurrentUrl(inputUrl); }}
        />
        <button className="cmd-btn-sm cyan" onClick={() => window.open(currentUrl, '_blank')}>[NEW TAB]</button>
      </div>
      <div className="webapp-pane" style={{ flex: 1 }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', gap: 16, color: 'var(--text-dim)', fontSize: '0.85rem',
          background: 'rgba(0,0,0,0.7)',
        }}>
          <div style={{ color: 'var(--neon-cyan)', fontSize: '1.1rem', textShadow: 'var(--bloom-cyan)', letterSpacing: 2 }}>
            [{name.toUpperCase()}]
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{currentUrl}</div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(0,255,0,0.4)', textAlign: 'center', maxWidth: 300, lineHeight: 1.8 }}>
            &gt; IFRAME BLOCKED BY BROWSER SECURITY POLICY<br/>
            &gt; CONFIGURE X-FRAME-OPTIONS ON TARGET HOST<br/>
            &gt; OR USE NGINX REVERSE PROXY HEADERS
          </div>
          <button className="cmd-btn" style={{ fontSize: '0.8rem' }} onClick={() => window.open(currentUrl, '_blank')}>
            [ OPEN IN NEW TAB ]
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mobile CyberDeck ──────────────────────────────────────────────────────────
function MobileDeck({ user, host, sessions, onAddSession, onUpdateSession, onLaunchApp, onLogout }) {
  const [view, setView] = useState('home'); // 'home' | appId
  const [activeApp, setActiveApp] = useState(null);

  const DECK_PANELS = [
    { id: 'terminal', name: 'Terminal',  icon: '[>_]', desc: 'SSH' },
    { id: 'filemgr',  name: 'Files',    icon: '[FM]', desc: 'Browse' },
    { id: 'sysmon',   name: 'Monitor',  icon: '[HT]', desc: 'htop' },
    { id: 'logview',  name: 'Logs',     icon: '[LG]', desc: 'journal' },
    { id: 'docker',   name: 'Docker',   icon: '[DK]', desc: 'Containers' },
    { id: 'services', name: 'Services', icon: '[SC]', desc: 'systemctl' },
    { id: 'netmap',   name: 'Network',  icon: '[NM]', desc: 'Map' },
    { id: 'cron',     name: 'Cron',     icon: '[CR]', desc: 'Jobs' },
  ];

  const openApp = (app) => { setActiveApp(app); setView('app'); };
  const goHome = () => { setView('home'); setActiveApp(null); };

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const renderAppContent = () => {
    if (!activeApp) return null;
    const props = { onNotify: () => {} };
    switch (activeApp.id) {
      case 'terminal': {
        const winId = 'mobile-term';
        const mobileSess = sessions.filter(s => s.winId === winId);
        const actSess = mobileSess[0];
        if (mobileSess.length === 0) {
          onAddSession && onAddSession(winId, host);
        }
        return actSess ? (
          <TerminalPane
            winId={winId}
            sessions={sessions}
            activeSess={actSess.id}
            onTabChange={() => {}}
            onAddTab={(wid) => onAddSession && onAddSession(wid, host)}
            onCloseTab={() => {}}
            onUpdateSession={onUpdateSession}
          />
        ) : <div style={{ padding: 20, color: 'var(--text-dim)' }}>&gt; INITIALIZING...</div>;
      }
      case 'filemgr':  return <FileManager />;
      case 'sysmon':   return <SystemMonitor />;
      case 'logview':  return <LogViewer />;
      case 'docker':   return <DockerManager {...props} />;
      case 'services': return <ServiceManager {...props} />;
      case 'netmap':   return <NetworkMap {...props} />;
      case 'cron':     return <CronEditor {...props} />;
      default:
        return activeApp.url ? <WebappPane url={activeApp.url} name={activeApp.name} /> : null;
    }
  };

  return (
    <div className="mobile-deck">
      {/* Status bar */}
      <div className="deck-status-bar">
        <span>{user}@{host}</span>
        <span style={{ color: 'var(--neon-cyan)' }}>NAS_TERMINAL</span>
        <span>{timeStr}</span>
      </div>

      {/* Viewport */}
      <div className="deck-viewport">
        {view === 'home' ? (
          <div className="deck-home-frame">
            <div className="deck-grid-scroll">
              <div className="deck-welcome">
                <div style={{ fontSize: '1rem', color: 'var(--neon-cyan)', textShadow: 'var(--bloom-cyan)', letterSpacing: 2 }}>
                  NAS_TERMINAL
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>root@{host}</div>
              </div>
              <div className="deck-grid">
                {DECK_PANELS.map(app => (
                  <button key={app.id} className="deck-app-icon" onClick={() => openApp(app)}>
                    <span className="app-label">{app.desc}</span>
                    <span style={{ fontSize: '1.3rem', marginBottom: 4, color: 'var(--neon-cyan)' }}>{app.icon}</span>
                    <span className="app-name">{app.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="deck-fullscreen-app">
            <div className="app-header">
              <button className="back-btn" onClick={goHome}>[&lt; BACK]</button>
              <span className="app-title">{activeApp && activeApp.name.toUpperCase()}</span>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {renderAppContent()}
            </div>
          </div>
        )}
      </div>

      {/* Dock */}
      <div className="deck-dock">
        <button className={`dock-btn${view === 'home' ? ' active' : ''}`} onClick={goHome}>[HOME]</button>
        <div className="dock-separator" />
        <button className="dock-btn" onClick={() => openApp({ id: 'terminal', name: 'Terminal', icon: '[>_]' })}>[TERM]</button>
        <button className="dock-btn" onClick={() => openApp({ id: 'sysmon', name: 'Sys Monitor', icon: '[HT]' })}>[MON]</button>
        <div className="dock-separator" />
        <button className="dock-btn" style={{ color: '#ff5f56' }} onClick={onLogout}>[QUIT]</button>
      </div>
    </div>
  );
}

// ── Main WM ────────────────────────────────────────────────────────────────────
let _windowIdCounter = 0;
const mkWinId = (type) => `${type}-${++_windowIdCounter}`;

const WIN_DEFAULTS = {
  terminal:  { w: 720, h: 480, title: 'TERMINAL_SESSION' },
  webapp:    { w: 900, h: 600, title: 'WEBAPP_FRAME' },
  filemgr:   { w: 780, h: 520, title: 'FILE_MANAGER' },
  sysmon:    { w: 680, h: 560, title: 'SYSTEM_MONITOR' },
  logview:   { w: 800, h: 480, title: 'LOG_VIEWER' },
  docker:    { w: 700, h: 560, title: 'DOCKER_MGR' },
  services:  { w: 680, h: 500, title: 'SERVICES' },
  netmap:    { w: 760, h: 520, title: 'NETWORK_MAP' },
  cron:      { w: 680, h: 440, title: 'CRON_EDITOR' },
  radarr:    { w: 820, h: 580, title: '[RADARR]' },
  sonarr:    { w: 820, h: 580, title: '[SONARR]' },
  sabnzbd:   { w: 780, h: 540, title: '[SABNZBD]' },
  settings:   { w: 600, h: 560, title: 'SETTINGS' },
  browser:    { w: 1000, h: 640, title: 'WEB_BROWSER' },
};

function WMDesktop({ user, host, onLogout }) {
  const [windows, setWindows] = useState([]);
  const [activeWin, setActiveWin] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionMap, setActiveSessionMap] = useState({});
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [tileMode, setTileMode] = useState(true);
  const [notifs, setNotifs] = useState([]);
  const workspaceRef = useRef(null);

  const notify = useCallback((msg, cls = 'ok') => {
    const id = Date.now() + Math.random();
    setNotifs(n => [...n, { id, msg, cls }]);
    setTimeout(() => setNotifs(n => n.filter(x => x.id !== id)), 3000);
  }, []);

  // Spawn initial terminal on login
  useEffect(() => {
    spawnWindow('terminal', null, user, host);
  }, []);

  const addSession = useCallback((winId, sessionHost) => {
    const sessId = `sess-${Date.now()}`;
    const newSess = { ...createSession(sessId, sessionHost || host), winId };
    setSessions(s => [...s, newSess]);
    setActiveSessionMap(m => ({ ...m, [winId]: sessId }));
    return sessId;
  }, [host]);

  const spawnWindow = useCallback((type, appData, uname, hname) => {
    const u = uname || user;
    const h = hname || host;
    const defaults = WIN_DEFAULTS[type] || WIN_DEFAULTS.terminal;
    const wsEl = workspaceRef.current;
    const wsW = wsEl ? wsEl.clientWidth : window.innerWidth;
    const wsH = wsEl ? wsEl.clientHeight : window.innerHeight - 60;
    const offsetX = 40 + (windows.length % 6) * 30;
    const offsetY = 30 + (windows.length % 4) * 20;
    const id = mkWinId(type);

    const win = {
      id, type,
      title: appData ? `[${appData.name.toUpperCase()}]` : defaults.title,
      appData,
      x: Math.min(offsetX, wsW - defaults.w - 20),
      y: Math.min(offsetY, wsH - defaults.h - 20),
      w: Math.min(defaults.w, wsW - 40),
      h: Math.min(defaults.h, wsH - 40),
      minimized: false,
    };

    setWindows(ws => [...ws, win]);
    setActiveWin(id);

    // Auto-create a terminal session for terminal windows
    if (type === 'terminal') {
      const sessId = `sess-${Date.now()}`;
      const sess = { ...createSession(sessId, h), winId: id };
      setSessions(s => [...s, sess]);
      setActiveSessionMap(m => ({ ...m, [id]: sessId }));
    }
  }, [windows, user, host]);

  const closeWindow = useCallback((id) => {
    setWindows(ws => ws.filter(w => w.id !== id));
    setSessions(ss => ss.filter(s => s.winId !== id));
    setActiveWin(prev => prev === id ? null : prev);
  }, []);

  const minimizeWindow = useCallback((id) => {
    setWindows(ws => ws.map(w => w.id === id ? { ...w, minimized: !w.minimized } : w));
  }, []);

  const maximizeWindow = useCallback((id) => {
    // handled inside WMWindow
  }, []);

  const activateWindow = useCallback((id) => setActiveWin(id), []);

  const updateSession = useCallback((sessId, updater) => {
    setSessions(ss => ss.map(s => s.id === sessId ? updater(s) : s));
  }, []);

  const addTabToWindow = useCallback((winId) => {
    const sessId = `sess-${Date.now()}`;
    const newSess = { ...createSession(sessId, host), winId };
    setSessions(s => [...s, newSess]);
    setActiveSessionMap(m => ({ ...m, [winId]: sessId }));
  }, [host]);

  const closeTabFromWindow = useCallback((winId, sessId) => {
    setSessions(s => s.filter(x => !(x.winId === winId && x.id === sessId)));
    setActiveSessionMap(m => {
      const remaining = sessions.filter(s => s.winId === winId && s.id !== sessId);
      return { ...m, [winId]: remaining.length > 0 ? remaining[remaining.length - 1].id : null };
    });
  }, [sessions]);

  const [showCheatsheet, setShowCheatsheet] = useState(false);

  // Keyboard WM bindings
  useKeyboardWM({
    onNewTerm:    useCallback(() => spawnWindow('terminal', null), [spawnWindow]),
    onLauncher:   useCallback(() => setLauncherOpen(true), []),
    onClose:      useCallback(() => activeWin && closeWindow(activeWin), [activeWin, closeWindow]),
    onMinimize:   useCallback(() => activeWin && minimizeWindow(activeWin), [activeWin, minimizeWindow]),
    onToggleTile: useCallback(() => setTileMode(t => !t), []),
    onCheatsheet: useCallback(() => setShowCheatsheet(s => !s), []),
    onCycleNext: useCallback(() => {
      const vis = windows.filter(w => !w.minimized);
      if (!vis.length) return;
      const idx = vis.findIndex(w => w.id === activeWin);
      const next = vis[(idx + 1) % vis.length];
      setActiveWin(next.id);
    }, [windows, activeWin]),
    onCyclePrev: useCallback(() => {
      const vis = windows.filter(w => !w.minimized);
      if (!vis.length) return;
      const idx = vis.findIndex(w => w.id === activeWin);
      const prev = vis[(idx - 1 + vis.length) % vis.length];
      setActiveWin(prev.id);
    }, [windows, activeWin]),
    onMoveWindow: useCallback((dir) => {
      if (!activeWin || tileMode) return;
      const STEP = 40;
      setWindows(ws => ws.map(w => {
        if (w.id !== activeWin) return w;
        const dx = dir === 'left' ? -STEP : dir === 'right' ? STEP : 0;
        const dy = dir === 'up'   ? -STEP : dir === 'down'  ? STEP : 0;
        return { ...w, x: (w.x || 80) + dx, y: (w.y || 60) + dy };
      }));
    }, [activeWin, tileMode]),
  });

  // Ctrl+Alt+B = browser, Ctrl+Alt+E = file manager (browser-safe versions of Super+B/E)
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey && e.altKey && e.key === 'b') { e.preventDefault(); spawnWindow('browser', null); }
      if (e.ctrlKey && e.altKey && e.key === 'e') { e.preventDefault(); spawnWindow('filemgr', null); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [spawnWindow]);
  const visibleWindows = windows.filter(w => !w.minimized);
  const wsEl = workspaceRef.current;
  const wsW = wsEl ? wsEl.clientWidth : window.innerWidth;
  const wsH = wsEl ? wsEl.clientHeight : window.innerHeight - 60;
  const tileRects = tileMode && visibleWindows.length > 0
    ? dwindleLayout(visibleWindows.length, { x: 6, y: 6, w: wsW - 12, h: wsH - 12 })
    : [];

  const renderWindowContent = (win) => {
    const notifyFn = (msg, cls) => notify(msg, cls);
    switch (win.type) {
      case 'terminal':
        return (
          <TerminalPane
            winId={win.id}
            sessions={sessions}
            activeSess={activeSessionMap[win.id]}
            onTabChange={(wid, sid) => setActiveSessionMap(m => ({ ...m, [wid]: sid }))}
            onAddTab={addTabToWindow}
            onCloseTab={closeTabFromWindow}
            onUpdateSession={updateSession}
          />
        );
      case 'webapp':
        return <WebappPane url={win.appData.url} name={win.appData.name} />;
      case 'filemgr':   return <FileManager />;
      case 'sysmon':    return <SystemMonitor />;
      case 'logview':   return <LogViewer />;
      case 'docker':    return <DockerManager onNotify={notifyFn} />;
      case 'services':  return <ServiceManager onNotify={notifyFn} />;
      case 'netmap':    return <NetworkMap onNotify={notifyFn} />;
      case 'cron':      return <CronEditor onNotify={notifyFn} />;
      case 'settings':  return <SettingsPanel onClose={() => closeWindow(win.id)} />;
      case 'browser':   return <BrowserPanel />;
      case 'radarr':    return <RadarrPanel  onOpenWebUI={() => { spawnWindow('webapp', { name: 'Radarr',  url: (loadConfig().radarr.url  || 'http://nas.local:7878') }); notify('> OPENING RADARR WEB UI', 'ok'); }} />;
      case 'sonarr':    return <SonarrPanel  onOpenWebUI={() => { spawnWindow('webapp', { name: 'Sonarr',  url: (loadConfig().sonarr.url  || 'http://nas.local:8989') }); notify('> OPENING SONARR WEB UI', 'ok'); }} />;
      case 'sabnzbd':   return <SABnzbdPanel onOpenWebUI={() => { spawnWindow('webapp', { name: 'SABnzbd', url: (loadConfig().sabnzbd.url || 'http://nas.local:8080') }); notify('> OPENING SABNZBD WEB UI', 'ok'); }} />;
      case 'apicfg':    return <ApiConfigPanel onSave={() => { notify('> API CONFIG SAVED', 'ok'); closeWindow(win.id); }} />;
      default: return null;
    }
  };

  const handleLaunch = (app) => {
    // Window focus from switcher mode
    if (app._focusWin) {
      if (app.minimized) minimizeWindow(app.id);
      activateWindow(app.id);
      notify(`> FOCUSED: ${app.title}`, 'ok');
      return;
    }
    // Special handlers
    if (app.id === 'devdocs') { window.open('Developer Guide.html', '_blank'); return; }
    if (app.id === 'settings') { spawnWindow('settings', app); notify('> OPENING SETTINGS', 'ok'); return; }
    if (['radarr', 'sonarr', 'sabnzbd'].includes(app.id)) {
      spawnWindow(app.id, app);
      notify(`> LAUNCHING ${app.name.toUpperCase()} NATIVE PANEL`, 'ok');
      return;
    }
    if (app.id === 'apicfg') { spawnWindow('apicfg', app); notify('> OPENING API CONFIGURATION', 'ok'); return; }
    if (app.url) { spawnWindow('webapp', app); }
    else { spawnWindow(app.id, app); }
    notify(`> LAUNCHING ${app.name.toUpperCase()}`, 'ok');
  };

  return (
    <>
      <StatusBar
        user={user} host={host}
        windows={windows}
        onOpenLauncher={() => setLauncherOpen(true)}
        onLogout={onLogout}
        onToggleTile={() => setTileMode(t => !t)}
        tileMode={tileMode}
      />

      <div id="workspace">
        <div id="workspace-inner" ref={workspaceRef} style={{position:'relative',width:'100%',height:'100%'}}>
        {windows.map((win, idx) => {
          const tileIdx = visibleWindows.findIndex(w => w.id === win.id);
          const tileRect = tileMode && tileRects[tileIdx];
          return (
            <WMWindow
              key={win.id}
              win={win}
              isActive={win.id === activeWin}
              onActivate={() => activateWindow(win.id)}
              onClose={closeWindow}
              onMinimize={minimizeWindow}
              onMaximize={maximizeWindow}
              isTiled={tileMode && !win.minimized}
              tileRect={tileRect || null}
            >
              {renderWindowContent(win)}
            </WMWindow>
          );
        })}

      {windows.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 16, color: 'var(--text-dim)',
          }}>
            <div style={{ fontSize: '1.5rem', color: 'var(--neon-green)', textShadow: 'var(--bloom-green)', letterSpacing: 4 }}>
              NAS_TERMINAL
            </div>
            <div style={{ fontSize: '0.8rem', letterSpacing: 2 }}>root@{host}:~$ <span className="cursor-block">█</span></div>
            <button className="cmd-btn" onClick={() => setLauncherOpen(true)} style={{ marginTop: 8 }}>
              [ OPEN LAUNCHER ]
            </button>
            <div style={{ fontSize: '0.7rem', color: 'rgba(0,255,0,0.3)', letterSpacing: 1, marginTop: 8 }}>
              Super+Enter = new terminal &nbsp;|&nbsp; Super+Space = launcher &nbsp;|&nbsp; Super+/ = keybindings
            </div>
          </div>
        )}
        </div>{/* end workspace-inner */}
      </div>

      {/* Keyboard shortcut hint in status bar area */}
      {showCheatsheet && <KeyboardCheatsheet onClose={() => setShowCheatsheet(false)} />}

      <AppLauncher
        isOpen={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        onLaunch={handleLaunch}
        windows={windows}
      />

      <NotifStack notifs={notifs} />
    </>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
function NASTerminalApp() {
  const [auth, setAuth] = useState(() => {
    try {
      const s = sessionStorage.getItem('nas_auth');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 760);
  const [mobileSessions, setMobileSessions] = useState([]);

  useEffect(() => {
    const onR = () => setIsMobile(window.innerWidth < 760);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  const handleLogin = (creds) => {
    sessionStorage.setItem('nas_auth', JSON.stringify(creds));
    setAuth(creds);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('nas_auth');
    setAuth(null);
  };

  if (!auth) return <LoginScreen onLogin={handleLogin} />;

  const inner = isMobile ? (
    <MobileDeck
      user={auth.user}
      host={auth.host}
      sessions={mobileSessions}
      onAddSession={(winId, h) => {
        const sessId = `mob-${Date.now()}`;
        setMobileSessions(s => [...s, { ...createSession(sessId, h || auth.host), winId }]);
      }}
      onUpdateSession={(sessId, updater) => setMobileSessions(ss => ss.map(s => s.id === sessId ? updater(s) : s))}
      onLaunchApp={() => {}}
      onLogout={handleLogout}
    />
  ) : (
    <WMDesktop user={auth.user} host={auth.host} onLogout={handleLogout} />
  );

  return (
    <BackendProvider host={auth.host} apiKey={auth.apiKey || '__demo__'}>
      {inner}
    </BackendProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<NASTerminalApp />);

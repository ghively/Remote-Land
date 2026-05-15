/* NASTerminal.jsx — Main app: Login, Status Bar, WM Orchestrator, Mobile Deck */
const {
  useState,
  useEffect,
  useRef,
  useCallback
} = React;

// ── Boot sequence lines ───────────────────────────────────────────────────────
const BOOT_LINES = [{
  text: '> BIOS POST... OK',
  type: 'ok',
  delay: 0
}, {
  text: '> LOADING KERNEL 6.1.0-21-amd64...',
  type: 'info',
  delay: 180
}, {
  text: '> MOUNTING FILE SYSTEMS... SUCCESS',
  type: 'ok',
  delay: 360
}, {
  text: '> STARTING NETWORK MANAGER... SUCCESS',
  type: 'ok',
  delay: 520
}, {
  text: '> ESTABLISHING SSH DAEMON... SUCCESS',
  type: 'ok',
  delay: 700
}, {
  text: '> LOADING NAS_TERMINAL v1.0.0...',
  type: 'info',
  delay: 900
}, {
  text: '> READY FOR INPUT.',
  type: 'ok',
  delay: 1050
}];

// ── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({
  onLogin
}) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [host, setHost] = useState('nas.local');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [bootIdx, setBootIdx] = useState(0);
  const [booted, setBooted] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const timers = BOOT_LINES.map((line, i) => setTimeout(() => {
      setBootIdx(i + 1);
      if (i === BOOT_LINES.length - 1) setTimeout(() => setBooted(true), 200);
    }, line.delay + 300));
    return () => timers.forEach(clearTimeout);
  }, []);
  const doLogin = async e => {
    e && e.preventDefault();
    setError('');
    setLoading(true);

    // Blank API key = demo mode (mock data, no backend probe).
    if (!apiKey) {
      onLogin({
        user: user || 'root',
        host,
        apiKey: '__demo__'
      });
      return;
    }
    try {
      const api = window.makeApi(host, apiKey);
      await api.health(); // backend reachable?
      await api.systemStats(); // 401 if API key wrong
      onLogin({
        user: user || 'root',
        host,
        apiKey
      });
    } catch (err) {
      const raw = err && err.message ? err.message : 'unknown error';
      let msg;
      if (/HTTP 401|HTTP 403/.test(raw)) msg = '> AUTH FAILED: INVALID API KEY';else if (/abort|timeout|AbortError/i.test(raw)) msg = '> CONNECTION TIMEOUT — IS THE BACKEND RUNNING?';else if (/Failed to fetch|NetworkError|ECONNREFUSED|ERR_NETWORK/i.test(raw)) msg = `> BACKEND UNREACHABLE AT ${host}:3001`;else msg = `> AUTH FAILED: ${raw.toUpperCase()}`;
      setError(msg);
      setLoading(false);
    }
  };
  const colorMap = {
    ok: 'var(--neon-green)',
    info: 'var(--neon-cyan)',
    warn: 'var(--color-warn)'
  };
  return /*#__PURE__*/React.createElement("div", {
    id: "login-screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "login-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "login-title"
  }, "NAS_TERMINAL"), /*#__PURE__*/React.createElement("div", {
    className: "login-subtitle"
  }, "CYBER-NOIR SERVER MANAGEMENT INTERFACE v1.0.0"), /*#__PURE__*/React.createElement("div", {
    className: "login-boot-lines"
  }, BOOT_LINES.slice(0, bootIdx).map((l, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "boot-line",
    style: {
      color: colorMap[l.type] || 'var(--text-dim)'
    }
  }, l.text)), bootIdx < BOOT_LINES.length && /*#__PURE__*/React.createElement("span", {
    className: "cursor-block",
    style: {
      color: 'var(--neon-purple)'
    }
  }, "\u2588")), booted && /*#__PURE__*/React.createElement("form", {
    onSubmit: doLogin,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "login-field-label"
  }, "USER@HOST"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "login-field",
    style: {
      flex: 1
    },
    placeholder: "root",
    value: user,
    onChange: e => setUser(e.target.value),
    autoFocus: true,
    autoComplete: "off"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-dim)',
      alignSelf: 'center',
      fontSize: '0.9rem'
    }
  }, "@"), /*#__PURE__*/React.createElement("input", {
    className: "login-field",
    style: {
      flex: 1
    },
    placeholder: "nas.local",
    value: host,
    onChange: e => setHost(e.target.value)
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "login-field-label"
  }, "PASSWORD"), /*#__PURE__*/React.createElement("input", {
    className: "login-field",
    type: "password",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    value: pass,
    onChange: e => setPass(e.target.value)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "login-field-label"
  }, "API_KEY"), /*#__PURE__*/React.createElement("input", {
    className: "login-field",
    type: "password",
    placeholder: "leave blank for demo mode",
    value: apiKey,
    onChange: e => setApiKey(e.target.value),
    autoComplete: "off"
  })), /*#__PURE__*/React.createElement("div", {
    className: "login-error"
  }, error), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "cmd-btn",
    style: {
      width: '100%',
      textAlign: 'center',
      fontSize: '0.95rem',
      letterSpacing: 2
    },
    disabled: loading
  }, loading ? '> AUTHENTICATING...' : '[ INITIATE_SESSION ]'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.68rem',
      color: 'var(--text-dim)',
      textAlign: 'center',
      marginTop: -4
    }
  }, "Leave API_KEY blank for demo mode (mock data, no backend)."))));
}

// ── Status Bar — Waybar-inspired ──────────────────────────────────────────────
function StatusBar({
  user,
  host,
  windows,
  onOpenLauncher,
  onLogout,
  onToggleTile,
  tileMode
}) {
  const {
    api,
    status,
    isDemo
  } = useBackend();
  const [stats, setStats] = useState({
    cpu: 14,
    ram: 42,
    uptime: '42d 7h',
    time: '',
    date: ''
  });
  const [live, setLive] = useState(null);
  const [activeWs, setActiveWs] = useState(1);

  // One visibility-gated tick per second handles both the clock and (in
  // demo mode) the cosmetic CPU/RAM random walk. Real backend stats come
  // from a separate slower poll below.
  const demoTick = React.useCallback(() => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const date = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    setStats(s => ({
      ...s,
      time,
      date,
      cpu: isDemo ? Math.max(2, Math.min(98, s.cpu + (Math.random() * 4 - 2))) : s.cpu,
      ram: isDemo ? Math.max(20, Math.min(95, s.ram + (Math.random() * 1 - 0.5))) : s.ram
    }));
  }, [isDemo]);
  usePoller(demoTick, 1000, true);

  // Real polling — only while backend is online and tab is visible.
  const liveTick = React.useCallback(async () => {
    try {
      const s = await api.systemStats();
      setLive(s);
    } catch (_) {/* heartbeat owns the offline indicator */}
  }, [api]);
  usePoller(liveTick, 5000, !isDemo && status === 'online' && !!api);
  const cpuPct = isDemo ? stats.cpu : live ? live.cpu.percent : null;
  const ramPct = isDemo ? stats.ram : live ? Math.round(100 * live.ram.used / live.ram.total) : null;
  const cpuWarn = cpuPct == null ? '' : cpuPct > 85 ? 'crit' : cpuPct > 65 ? 'warn' : '';
  const ramWarn = ramPct == null ? '' : ramPct > 85 ? 'crit' : ramPct > 65 ? 'warn' : '';

  // Workspace numbers — matches Hyprland workspaces 1-9
  const workspaces = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const occupiedWs = [1, 2, 3]; // simulate occupied workspaces

  return /*#__PURE__*/React.createElement("div", {
    id: "status-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wb-left"
  }, /*#__PURE__*/React.createElement("button", {
    className: "wb-module menu",
    onClick: onOpenLauncher,
    title: "Alt+Space \u2014 App Launcher"
  }, "\u276F_"), /*#__PURE__*/React.createElement("div", {
    className: "wb-workspace"
  }, workspaces.map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    className: `wb-ws-btn${n === activeWs ? ' active' : occupiedWs.includes(n) ? ' occupied' : ''}`,
    onClick: () => setActiveWs(n),
    title: `Workspace ${n}`
  }, n))), /*#__PURE__*/React.createElement("div", {
    className: "wb-module user"
  }, /*#__PURE__*/React.createElement("span", {
    className: "wb-val"
  }, user, "@", host))), /*#__PURE__*/React.createElement("div", {
    className: "wb-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wb-module clock"
  }, /*#__PURE__*/React.createElement("span", {
    className: "wb-val"
  }, stats.time), /*#__PURE__*/React.createElement("span", {
    className: "wb-label",
    style: {
      marginLeft: 6
    }
  }, stats.date))), /*#__PURE__*/React.createElement("div", {
    className: "wb-right"
  }, isDemo && /*#__PURE__*/React.createElement("div", {
    className: "wb-module",
    style: {
      color: 'var(--neon-purple)',
      textShadow: 'var(--bloom-purple, 0 0 4px var(--neon-purple))',
      letterSpacing: 2
    }
  }, "[DEMO]"), !isDemo && status === 'offline' && /*#__PURE__*/React.createElement("div", {
    className: "wb-module",
    style: {
      color: 'var(--neon-cyan)',
      textShadow: 'var(--bloom-cyan)',
      letterSpacing: 2
    }
  }, "[OFFLINE]"), /*#__PURE__*/React.createElement("div", {
    className: "wb-module cpu"
  }, /*#__PURE__*/React.createElement("span", {
    className: "wb-label"
  }, "CPU"), /*#__PURE__*/React.createElement("span", {
    className: `wb-val${cpuWarn ? ' ' + cpuWarn : ''}`
  }, cpuPct == null ? '--' : `${cpuPct.toFixed(0)}%`)), /*#__PURE__*/React.createElement("div", {
    className: "wb-module ram"
  }, /*#__PURE__*/React.createElement("span", {
    className: "wb-label"
  }, "RAM"), /*#__PURE__*/React.createElement("span", {
    className: `wb-val${ramWarn ? ' ' + ramWarn : ''}`
  }, ramPct == null ? '--' : `${ramPct.toFixed(0)}%`)), /*#__PURE__*/React.createElement("div", {
    className: "wb-module uptime"
  }, /*#__PURE__*/React.createElement("span", {
    className: "wb-label"
  }, "UP"), /*#__PURE__*/React.createElement("span", {
    className: "wb-val"
  }, !isDemo && live && live.uptime && live.uptime.formatted || stats.uptime)), /*#__PURE__*/React.createElement("button", {
    className: "wb-module btn",
    onClick: onToggleTile,
    title: tileMode ? 'Float mode (Super+Space)' : 'Tile mode (Super+Space)',
    style: {
      fontSize: 11
    }
  }, tileMode ? '⊞' : '⊟'), /*#__PURE__*/React.createElement("button", {
    className: "wb-module btn danger",
    onClick: onLogout,
    title: "Logout"
  }, "\u23FB")));
}

// ── Notification stack ────────────────────────────────────────────────────────
function NotifStack({
  notifs
}) {
  return /*#__PURE__*/React.createElement("div", {
    id: "notif-stack"
  }, notifs.map(n => /*#__PURE__*/React.createElement("div", {
    key: n.id,
    className: `notif ${n.cls}`
  }, n.msg)));
}

// ── Webapp pane ───────────────────────────────────────────────────────────────
function WebappPane({
  url,
  name
}) {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [inputUrl, setInputUrl] = useState(url);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "webapp-toolbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm cyan",
    onClick: () => setCurrentUrl(url),
    title: "Home"
  }, "[HOME]"), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm",
    onClick: () => {},
    title: "Reload"
  }, "[RELOAD]"), /*#__PURE__*/React.createElement("input", {
    className: "webapp-url-bar",
    value: inputUrl,
    onChange: e => setInputUrl(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') setCurrentUrl(inputUrl);
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm cyan",
    onClick: () => window.open(currentUrl, '_blank')
  }, "[NEW TAB]")), /*#__PURE__*/React.createElement("div", {
    className: "webapp-pane",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 16,
      color: 'var(--text-dim)',
      fontSize: '0.85rem',
      background: 'rgba(0,0,0,0.7)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '1.1rem',
      textShadow: 'var(--bloom-cyan)',
      letterSpacing: 2
    }
  }, "[", name.toUpperCase(), "]"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-dim)',
      fontSize: '0.75rem'
    }
  }, currentUrl), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.72rem',
      color: 'rgba(0,255,0,0.4)',
      textAlign: 'center',
      maxWidth: 300,
      lineHeight: 1.8
    }
  }, "> IFRAME BLOCKED BY BROWSER SECURITY POLICY", /*#__PURE__*/React.createElement("br", null), "> CONFIGURE X-FRAME-OPTIONS ON TARGET HOST", /*#__PURE__*/React.createElement("br", null), "> OR USE NGINX REVERSE PROXY HEADERS"), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn",
    style: {
      fontSize: '0.8rem'
    },
    onClick: () => window.open(currentUrl, '_blank')
  }, "[ OPEN IN NEW TAB ]"))));
}

// ── Mobile CyberDeck ──────────────────────────────────────────────────────────
function MobileDeck({
  user,
  host,
  sessions,
  onAddSession,
  onUpdateSession,
  onLaunchApp,
  onLogout
}) {
  const [view, setView] = useState('home'); // 'home' | appId
  const [activeApp, setActiveApp] = useState(null);
  const DECK_PANELS = [{
    id: 'terminal',
    name: 'Terminal',
    icon: '[>_]',
    desc: 'SSH'
  }, {
    id: 'filemgr',
    name: 'Files',
    icon: '[FM]',
    desc: 'Browse'
  }, {
    id: 'sysmon',
    name: 'Monitor',
    icon: '[HT]',
    desc: 'htop'
  }, {
    id: 'logview',
    name: 'Logs',
    icon: '[LG]',
    desc: 'journal'
  }, {
    id: 'docker',
    name: 'Docker',
    icon: '[DK]',
    desc: 'Containers'
  }, {
    id: 'services',
    name: 'Services',
    icon: '[SC]',
    desc: 'systemctl'
  }, {
    id: 'netmap',
    name: 'Network',
    icon: '[NM]',
    desc: 'Map'
  }, {
    id: 'cron',
    name: 'Cron',
    icon: '[CR]',
    desc: 'Jobs'
  }, {
    id: 'aichat',
    name: 'AI Chat',
    icon: '[AI]',
    desc: 'LLM'
  }, {
    id: 'browser',
    name: 'Browser',
    icon: '[WW]',
    desc: 'Web'
  }, {
    id: 'apicfg',
    name: 'API Cfg',
    icon: '[CF]',
    desc: 'Keys'
  }, {
    id: 'settings',
    name: 'Settings',
    icon: '[ST]',
    desc: 'Theme'
  }, {
    id: 'devdocs',
    name: 'Dev Guide',
    icon: '[?]',
    desc: 'Docs',
    url: 'Developer Guide.html'
  }];
  const openApp = app => {
    setActiveApp(app);
    setView('app');
  };
  const goHome = () => {
    setView('home');
    setActiveApp(null);
  };
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const renderAppContent = () => {
    if (!activeApp) return null;
    const props = {
      onNotify: () => {}
    };
    switch (activeApp.id) {
      case 'terminal':
        {
          const winId = 'mobile-term';
          const mobileSess = sessions.filter(s => s.winId === winId);
          const actSess = mobileSess[0];
          if (mobileSess.length === 0) {
            onAddSession && onAddSession(winId, host);
          }
          return actSess ? /*#__PURE__*/React.createElement(TerminalPane, {
            winId: winId,
            sessions: sessions,
            activeSess: actSess.id,
            onTabChange: () => {},
            onAddTab: wid => onAddSession && onAddSession(wid, host),
            onCloseTab: () => {},
            onUpdateSession: onUpdateSession
          }) : /*#__PURE__*/React.createElement("div", {
            style: {
              padding: 20,
              color: 'var(--text-dim)'
            }
          }, "> INITIALIZING...");
        }
      case 'filemgr':
        return /*#__PURE__*/React.createElement(FileManager, props);
      case 'sysmon':
        return /*#__PURE__*/React.createElement(SystemMonitor, null);
      case 'logview':
        return /*#__PURE__*/React.createElement(LogViewer, null);
      case 'docker':
        return /*#__PURE__*/React.createElement(DockerManager, props);
      case 'services':
        return /*#__PURE__*/React.createElement(ServiceManager, props);
      case 'netmap':
        return /*#__PURE__*/React.createElement(NetworkMap, props);
      case 'cron':
        return /*#__PURE__*/React.createElement(CronEditor, props);
      case 'aichat':
        return /*#__PURE__*/React.createElement(AIChatPanel, null);
      case 'browser':
        return /*#__PURE__*/React.createElement(BrowserPanel, null);
      case 'settings':
        return /*#__PURE__*/React.createElement(SettingsPanel, {
          onClose: goHome
        });
      case 'apicfg':
        return /*#__PURE__*/React.createElement(BackendConfigPanel, {
          onSave: goHome
        });
      default:
        return activeApp.url ? /*#__PURE__*/React.createElement(WebappPane, {
          url: activeApp.url,
          name: activeApp.name
        }) : null;
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "mobile-deck"
  }, /*#__PURE__*/React.createElement("div", {
    className: "deck-status-bar"
  }, /*#__PURE__*/React.createElement("span", null, user, "@", host), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--neon-cyan)'
    }
  }, "NAS_TERMINAL"), /*#__PURE__*/React.createElement("span", null, timeStr)), /*#__PURE__*/React.createElement("div", {
    className: "deck-viewport"
  }, view === 'home' ? /*#__PURE__*/React.createElement("div", {
    className: "deck-home-frame"
  }, /*#__PURE__*/React.createElement("div", {
    className: "deck-grid-scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "deck-welcome"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '1rem',
      color: 'var(--neon-cyan)',
      textShadow: 'var(--bloom-cyan)',
      letterSpacing: 2
    }
  }, "NAS_TERMINAL"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.7rem',
      color: 'var(--text-dim)'
    }
  }, "root@", host)), /*#__PURE__*/React.createElement("div", {
    className: "deck-grid"
  }, DECK_PANELS.map(app => /*#__PURE__*/React.createElement("button", {
    key: app.id,
    className: "deck-app-icon",
    onClick: () => openApp(app)
  }, /*#__PURE__*/React.createElement("span", {
    className: "app-label"
  }, app.desc), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '1.3rem',
      marginBottom: 4,
      color: 'var(--neon-cyan)'
    }
  }, app.icon), /*#__PURE__*/React.createElement("span", {
    className: "app-name"
  }, app.name)))))) : /*#__PURE__*/React.createElement("div", {
    className: "deck-fullscreen-app"
  }, /*#__PURE__*/React.createElement("div", {
    className: "app-header"
  }, /*#__PURE__*/React.createElement("button", {
    className: "back-btn",
    onClick: goHome
  }, "[< BACK]"), /*#__PURE__*/React.createElement("span", {
    className: "app-title"
  }, activeApp && activeApp.name.toUpperCase())), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }
  }, renderAppContent()))), /*#__PURE__*/React.createElement("div", {
    className: "deck-dock"
  }, /*#__PURE__*/React.createElement("button", {
    className: `dock-btn${view === 'home' ? ' active' : ''}`,
    onClick: goHome
  }, "[HOME]"), /*#__PURE__*/React.createElement("div", {
    className: "dock-separator"
  }), /*#__PURE__*/React.createElement("button", {
    className: "dock-btn",
    onClick: () => openApp({
      id: 'terminal',
      name: 'Terminal',
      icon: '[>_]'
    })
  }, "[TERM]"), /*#__PURE__*/React.createElement("button", {
    className: "dock-btn",
    onClick: () => openApp({
      id: 'sysmon',
      name: 'Sys Monitor',
      icon: '[HT]'
    })
  }, "[MON]"), /*#__PURE__*/React.createElement("div", {
    className: "dock-separator"
  }), /*#__PURE__*/React.createElement("button", {
    className: "dock-btn",
    style: {
      color: 'var(--color-error)'
    },
    onClick: onLogout
  }, "[QUIT]")));
}

// ── Main WM ────────────────────────────────────────────────────────────────────
let _windowIdCounter = 0;
const mkWinId = type => `${type}-${++_windowIdCounter}`;
const WIN_DEFAULTS = {
  terminal: {
    w: 720,
    h: 480,
    title: 'TERMINAL_SESSION'
  },
  webapp: {
    w: 900,
    h: 600,
    title: 'WEBAPP_FRAME'
  },
  filemgr: {
    w: 780,
    h: 520,
    title: 'FILE_MANAGER'
  },
  sysmon: {
    w: 680,
    h: 560,
    title: 'SYSTEM_MONITOR'
  },
  logview: {
    w: 800,
    h: 480,
    title: 'LOG_VIEWER'
  },
  docker: {
    w: 700,
    h: 560,
    title: 'DOCKER_MGR'
  },
  services: {
    w: 680,
    h: 500,
    title: 'SERVICES'
  },
  netmap: {
    w: 760,
    h: 520,
    title: 'NETWORK_MAP'
  },
  cron: {
    w: 680,
    h: 440,
    title: 'CRON_EDITOR'
  },
  radarr: {
    w: 820,
    h: 580,
    title: '[RADARR]'
  },
  sonarr: {
    w: 820,
    h: 580,
    title: '[SONARR]'
  },
  sabnzbd: {
    w: 780,
    h: 540,
    title: '[SABNZBD]'
  },
  settings: {
    w: 600,
    h: 560,
    title: 'SETTINGS'
  },
  browser: {
    w: 1000,
    h: 640,
    title: 'WEB_BROWSER'
  },
  aichat: {
    w: 600,
    h: 540,
    title: '[AI_CHAT]'
  }
};
function WMDesktop({
  user,
  host,
  onLogout
}) {
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
    setNotifs(n => [...n, {
      id,
      msg,
      cls
    }]);
    setTimeout(() => setNotifs(n => n.filter(x => x.id !== id)), 3000);
  }, []);

  // Spawn initial terminal on login
  useEffect(() => {
    spawnWindow('terminal', null, user, host);
  }, []);
  const addSession = useCallback((winId, sessionHost) => {
    const sessId = `sess-${Date.now()}`;
    const newSess = {
      ...createSession(sessId, sessionHost || host),
      winId
    };
    setSessions(s => [...s, newSess]);
    setActiveSessionMap(m => ({
      ...m,
      [winId]: sessId
    }));
    return sessId;
  }, [host]);
  const spawnWindow = useCallback((type, appData, uname, hname) => {
    const u = uname || user;
    const h = hname || host;
    const defaults = WIN_DEFAULTS[type] || WIN_DEFAULTS.terminal;
    const wsEl = workspaceRef.current;
    const wsW = wsEl ? wsEl.clientWidth : window.innerWidth;
    const wsH = wsEl ? wsEl.clientHeight : window.innerHeight - 60;
    const offsetX = 40 + windows.length % 6 * 30;
    const offsetY = 30 + windows.length % 4 * 20;
    const id = mkWinId(type);
    const win = {
      id,
      type,
      title: appData ? `[${appData.name.toUpperCase()}]` : defaults.title,
      appData,
      x: Math.min(offsetX, wsW - defaults.w - 20),
      y: Math.min(offsetY, wsH - defaults.h - 20),
      w: Math.min(defaults.w, wsW - 40),
      h: Math.min(defaults.h, wsH - 40),
      minimized: false
    };
    setWindows(ws => [...ws, win]);
    setActiveWin(id);

    // Auto-create a terminal session for terminal windows
    if (type === 'terminal') {
      const sessId = `sess-${Date.now()}`;
      const sess = {
        ...createSession(sessId, h),
        winId: id
      };
      setSessions(s => [...s, sess]);
      setActiveSessionMap(m => ({
        ...m,
        [id]: sessId
      }));
    }
  }, [windows, user, host]);
  const closeWindow = useCallback(id => {
    setWindows(ws => ws.filter(w => w.id !== id));
    setSessions(ss => ss.filter(s => s.winId !== id));
    setActiveWin(prev => prev === id ? null : prev);
  }, []);
  const minimizeWindow = useCallback(id => {
    setWindows(ws => ws.map(w => w.id === id ? {
      ...w,
      minimized: !w.minimized
    } : w));
  }, []);
  const maximizeWindow = useCallback(id => {
    // handled inside WMWindow
  }, []);
  const activateWindow = useCallback(id => setActiveWin(id), []);
  const updateSession = useCallback((sessId, updater) => {
    setSessions(ss => ss.map(s => s.id === sessId ? updater(s) : s));
  }, []);
  const addTabToWindow = useCallback(winId => {
    const sessId = `sess-${Date.now()}`;
    const newSess = {
      ...createSession(sessId, host),
      winId
    };
    setSessions(s => [...s, newSess]);
    setActiveSessionMap(m => ({
      ...m,
      [winId]: sessId
    }));
  }, [host]);
  const closeTabFromWindow = useCallback((winId, sessId) => {
    setSessions(prev => {
      const remaining = prev.filter(x => !(x.winId === winId && x.id === sessId));
      const sameWin = remaining.filter(s => s.winId === winId);
      setActiveSessionMap(m => ({
        ...m,
        [winId]: sameWin.length > 0 ? sameWin[sameWin.length - 1].id : null
      }));
      // If closing the last tab in a terminal window, close the window itself
      // so the user isn't left staring at an empty pane.
      if (sameWin.length === 0) {
        setWindows(ws => ws.filter(w => !(w.id === winId && w.type === 'terminal')));
      }
      return remaining;
    });
  }, []);
  const [showCheatsheet, setShowCheatsheet] = useState(false);

  // Keyboard WM bindings
  useKeyboardWM({
    onNewTerm: useCallback(() => spawnWindow('terminal', null), [spawnWindow]),
    onLauncher: useCallback(() => setLauncherOpen(true), []),
    onClose: useCallback(() => activeWin && closeWindow(activeWin), [activeWin, closeWindow]),
    onMinimize: useCallback(() => activeWin && minimizeWindow(activeWin), [activeWin, minimizeWindow]),
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
    onMoveWindow: useCallback(dir => {
      if (!activeWin || tileMode) return;
      const STEP = 40;
      setWindows(ws => ws.map(w => {
        if (w.id !== activeWin) return w;
        const dx = dir === 'left' ? -STEP : dir === 'right' ? STEP : 0;
        const dy = dir === 'up' ? -STEP : dir === 'down' ? STEP : 0;
        return {
          ...w,
          x: (w.x || 80) + dx,
          y: (w.y || 60) + dy
        };
      }));
    }, [activeWin, tileMode])
  });

  // Ctrl+Alt+B = browser, Ctrl+Alt+E = file manager (browser-safe versions of Super+B/E)
  useEffect(() => {
    const handler = e => {
      const tag = document.activeElement?.tagName;
      if ((tag === 'INPUT' || tag === 'TEXTAREA') && !document.activeElement.closest('.xterm')) return;
      if (e.ctrlKey && e.altKey && e.key === 'b') {
        e.preventDefault();
        spawnWindow('browser', null);
      }
      if (e.ctrlKey && e.altKey && e.key === 'e') {
        e.preventDefault();
        spawnWindow('filemgr', null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [spawnWindow]);

  // Bridge launcher's [INSERT INTO TERMINAL] → most-recent live PTY.
  useEffect(() => {
    const onInsert = e => {
      const sinks = window.__nasTerminalSinks;
      if (!sinks || sinks.size === 0) {
        notify('> NO ACTIVE TERMINAL — OPEN ONE FIRST', 'warn');
        return;
      }
      const sink = Array.from(sinks).pop();
      sink(e.detail);
      notify('> COMMAND INSERTED — PRESS ENTER TO RUN', 'ok');
    };
    window.addEventListener('nas:insert-into-terminal', onInsert);
    return () => window.removeEventListener('nas:insert-into-terminal', onInsert);
  }, [notify]);
  const visibleWindows = windows.filter(w => !w.minimized);
  const wsEl = workspaceRef.current;
  const wsW = wsEl ? wsEl.clientWidth : window.innerWidth;
  const wsH = wsEl ? wsEl.clientHeight : window.innerHeight - 60;
  // Workspace already has `--gap-outer` padding from CSS, so the dwindle
  // rect starts at 0,0 inside the padded box. Rects are keyed by window id
  // so minimizing one window doesn't re-shuffle the others' positions.
  const tileRectsByWin = tileMode && visibleWindows.length > 0 ? dwindleLayoutByWin(visibleWindows, {
    x: 0,
    y: 0,
    w: wsW,
    h: wsH
  }) : {};
  const renderWindowContent = win => {
    const notifyFn = (msg, cls) => notify(msg, cls);
    switch (win.type) {
      case 'terminal':
        return /*#__PURE__*/React.createElement(TerminalPane, {
          winId: win.id,
          sessions: sessions,
          activeSess: activeSessionMap[win.id],
          onTabChange: (wid, sid) => setActiveSessionMap(m => ({
            ...m,
            [wid]: sid
          })),
          onAddTab: addTabToWindow,
          onCloseTab: closeTabFromWindow,
          onUpdateSession: updateSession
        });
      case 'webapp':
        return /*#__PURE__*/React.createElement(WebappPane, {
          url: win.appData.url,
          name: win.appData.name
        });
      case 'filemgr':
        return /*#__PURE__*/React.createElement(FileManager, {
          onNotify: notifyFn
        });
      case 'sysmon':
        return /*#__PURE__*/React.createElement(SystemMonitor, null);
      case 'logview':
        return /*#__PURE__*/React.createElement(LogViewer, null);
      case 'docker':
        return /*#__PURE__*/React.createElement(DockerManager, {
          onNotify: notifyFn
        });
      case 'services':
        return /*#__PURE__*/React.createElement(ServiceManager, {
          onNotify: notifyFn
        });
      case 'netmap':
        return /*#__PURE__*/React.createElement(NetworkMap, {
          onNotify: notifyFn
        });
      case 'cron':
        return /*#__PURE__*/React.createElement(CronEditor, {
          onNotify: notifyFn
        });
      case 'settings':
        return /*#__PURE__*/React.createElement(SettingsPanel, {
          onClose: () => closeWindow(win.id)
        });
      case 'browser':
        return /*#__PURE__*/React.createElement(BrowserPanel, null);
      case 'radarr':
        return /*#__PURE__*/React.createElement(RadarrPanel, {
          onOpenWebUI: () => {
            spawnWindow('webapp', {
              name: 'Radarr',
              url: loadConfig().radarr.url || 'http://nas.local:7878'
            });
            notify('> OPENING RADARR WEB UI', 'ok');
          }
        });
      case 'sonarr':
        return /*#__PURE__*/React.createElement(SonarrPanel, {
          onOpenWebUI: () => {
            spawnWindow('webapp', {
              name: 'Sonarr',
              url: loadConfig().sonarr.url || 'http://nas.local:8989'
            });
            notify('> OPENING SONARR WEB UI', 'ok');
          }
        });
      case 'sabnzbd':
        return /*#__PURE__*/React.createElement(SABnzbdPanel, {
          onOpenWebUI: () => {
            spawnWindow('webapp', {
              name: 'SABnzbd',
              url: loadConfig().sabnzbd.url || 'http://nas.local:8080'
            });
            notify('> OPENING SABNZBD WEB UI', 'ok');
          }
        });
      case 'apicfg':
        return /*#__PURE__*/React.createElement(BackendConfigPanel, {
          onSave: () => {
            notify('> BACKEND CONFIG SAVED', 'ok');
            closeWindow(win.id);
          }
        });
      case 'aichat':
        return /*#__PURE__*/React.createElement(AIChatPanel, null);
      default:
        return null;
    }
  };
  const handleLaunch = app => {
    // Window focus from switcher mode
    if (app._focusWin) {
      if (app.minimized) minimizeWindow(app.id);
      activateWindow(app.id);
      notify(`> FOCUSED: ${app.title}`, 'ok');
      return;
    }
    // Special handlers
    if (app.id === 'devdocs') {
      window.open('Developer Guide.html', '_blank');
      return;
    }
    if (app.id === 'settings') {
      spawnWindow('settings', app);
      notify('> OPENING SETTINGS', 'ok');
      return;
    }
    if (['radarr', 'sonarr', 'sabnzbd'].includes(app.id)) {
      spawnWindow(app.id, app);
      notify(`> LAUNCHING ${app.name.toUpperCase()} NATIVE PANEL`, 'ok');
      return;
    }
    if (app.id === 'apicfg') {
      spawnWindow('apicfg', app);
      notify('> OPENING API CONFIGURATION', 'ok');
      return;
    }
    if (app.id === 'aichat') {
      spawnWindow('aichat', app);
      notify('> OPENING AI CHAT', 'ok');
      return;
    }
    if (app.url) {
      spawnWindow('webapp', app);
    } else {
      spawnWindow(app.id, app);
    }
    notify(`> LAUNCHING ${app.name.toUpperCase()}`, 'ok');
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusBar, {
    user: user,
    host: host,
    windows: windows,
    onOpenLauncher: () => setLauncherOpen(true),
    onLogout: onLogout,
    onToggleTile: () => setTileMode(t => !t),
    tileMode: tileMode
  }), /*#__PURE__*/React.createElement("div", {
    id: "workspace"
  }, /*#__PURE__*/React.createElement("div", {
    id: "workspace-inner",
    ref: workspaceRef,
    style: {
      position: 'relative',
      width: '100%',
      height: '100%'
    }
  }, windows.map((win, idx) => {
    const tileRect = tileMode ? tileRectsByWin[win.id] : null;
    return /*#__PURE__*/React.createElement(WMWindow, {
      key: win.id,
      win: win,
      isActive: win.id === activeWin,
      onActivate: () => activateWindow(win.id),
      onClose: closeWindow,
      onMinimize: minimizeWindow,
      onMaximize: maximizeWindow,
      isTiled: tileMode && !win.minimized,
      tileRect: tileRect || null
    }, renderWindowContent(win));
  }), windows.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      color: 'var(--text-dim)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '1.5rem',
      color: 'var(--neon-green)',
      textShadow: 'var(--bloom-green)',
      letterSpacing: 4
    }
  }, "NAS_TERMINAL"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.8rem',
      letterSpacing: 2
    }
  }, "root@", host, ":~$ ", /*#__PURE__*/React.createElement("span", {
    className: "cursor-block"
  }, "\u2588")), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn",
    onClick: () => setLauncherOpen(true),
    style: {
      marginTop: 8
    }
  }, "[ OPEN LAUNCHER ]"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.7rem',
      color: 'rgba(0,255,0,0.3)',
      letterSpacing: 1,
      marginTop: 8
    }
  }, "Super+Enter = new terminal \xA0|\xA0 Super+Space = launcher \xA0|\xA0 Super+/ = keybindings")))), showCheatsheet && /*#__PURE__*/React.createElement(KeyboardCheatsheet, {
    onClose: () => setShowCheatsheet(false)
  }), /*#__PURE__*/React.createElement(AppLauncher, {
    isOpen: launcherOpen,
    onClose: () => setLauncherOpen(false),
    onLaunch: handleLaunch,
    windows: windows
  }), /*#__PURE__*/React.createElement(NotifStack, {
    notifs: notifs
  }));
}

// ── Root App ──────────────────────────────────────────────────────────────────
function NASTerminalApp() {
  const [auth, setAuth] = useState(() => {
    try {
      const s = sessionStorage.getItem('nas_auth');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 760);
  const [mobileSessions, setMobileSessions] = useState([]);
  useEffect(() => {
    const onR = () => setIsMobile(window.innerWidth < 760);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  const handleLogin = creds => {
    sessionStorage.setItem('nas_auth', JSON.stringify(creds));
    setAuth(creds);
  };
  const handleLogout = () => {
    sessionStorage.removeItem('nas_auth');
    setAuth(null);
  };
  if (!auth) return /*#__PURE__*/React.createElement(LoginScreen, {
    onLogin: handleLogin
  });
  const inner = isMobile ? /*#__PURE__*/React.createElement(MobileDeck, {
    user: auth.user,
    host: auth.host,
    sessions: mobileSessions,
    onAddSession: (winId, h) => {
      const sessId = `mob-${Date.now()}`;
      setMobileSessions(s => [...s, {
        ...createSession(sessId, h || auth.host),
        winId
      }]);
    },
    onUpdateSession: (sessId, updater) => setMobileSessions(ss => ss.map(s => s.id === sessId ? updater(s) : s)),
    onLaunchApp: () => {},
    onLogout: handleLogout
  }) : /*#__PURE__*/React.createElement(WMDesktop, {
    user: auth.user,
    host: auth.host,
    onLogout: handleLogout
  });
  return /*#__PURE__*/React.createElement(BackendProvider, {
    host: auth.host,
    apiKey: auth.apiKey || '__demo__'
  }, inner);
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(NASTerminalApp, null));
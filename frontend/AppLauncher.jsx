/* AppLauncher.jsx — Rofi-style full-screen launcher overlay */
const { useState, useEffect, useRef } = React;

const DEFAULT_APPS = [
  { id: 'emby',      name: 'Emby',      desc: 'Media Server',      url: 'http://nas.local:8096',  icon: '[EM]',  cat: 'MEDIA' },
  { id: 'radarr',    name: 'Radarr',    desc: 'Movie Manager',     url: 'http://nas.local:7878',  icon: '[RR]',  cat: 'MEDIA' },
  { id: 'sonarr',    name: 'Sonarr',    desc: 'TV Manager',        url: 'http://nas.local:8989',  icon: '[SR]',  cat: 'MEDIA' },
  { id: 'sabnzbd',   name: 'SABnzbd',   desc: 'NZB Downloader',    url: 'http://nas.local:8080',  icon: '[SB]',  cat: 'DOWNLOADS' },
  { id: 'vikunja',   name: 'Vikunja',   desc: 'Task Manager',      url: 'http://nas.local:3456',  icon: '[VK]',  cat: 'PRODUCTIVITY' },
  { id: 'logseq',    name: 'Logseq',    desc: 'Knowledge Base',    url: 'http://nas.local:3000',  icon: '[LS]',  cat: 'PRODUCTIVITY' },
  { id: 'portainer', name: 'Portainer', desc: 'Container UI',      url: 'http://nas.local:9000',  icon: '[PT]',  cat: 'ADMIN' },
  { id: 'cockpit',   name: 'Cockpit',   desc: 'System Admin',      url: 'http://nas.local:9090',  icon: '[CK]',  cat: 'ADMIN' },
];

const PANEL_APPS = [
  { id: 'terminal',  name: 'Terminal',    desc: 'SSH Session',       icon: '[>_]', cat: 'SYSTEM' },
  { id: 'filemgr',   name: 'File Mgr',   desc: 'Browse Filesystem', icon: '[FM]', cat: 'SYSTEM' },
  { id: 'sysmon',    name: 'Sys Monitor',desc: 'htop-style Monitor', icon: '[HT]', cat: 'SYSTEM' },
  { id: 'logview',   name: 'Log Viewer', desc: 'journalctl stream',  icon: '[LG]', cat: 'SYSTEM' },
  { id: 'docker',    name: 'Docker',     desc: 'Container Manager',  icon: '[DK]', cat: 'SYSTEM' },
  { id: 'services',  name: 'Services',   desc: 'systemctl units',    icon: '[SC]', cat: 'SYSTEM' },
  { id: 'netmap',    name: 'Network',    desc: 'Network Map',        icon: '[NM]', cat: 'SYSTEM' },
  { id: 'cron',      name: 'Cron',       desc: 'Job Scheduler',      icon: '[CR]', cat: 'SYSTEM' },
  { id: 'apicfg',    name: 'Backend Config', desc: 'Host & API key',     icon: '[CF]', cat: 'SYSTEM' },
  { id: 'aichat',    name: 'AI Chat',    desc: 'LLM assistant',      icon: '[AI]', cat: 'SYSTEM' },
  { id: 'settings',  name: 'Settings',   desc: 'Theme & appearance', icon: '[ST]', cat: 'SYSTEM' },
  { id: 'browser',   name: 'Browser',    desc: 'Web Browser',        icon: '[WW]', cat: 'SYSTEM' },
  { id: 'devdocs',   name: 'Dev Guide',  desc: 'Developer docs',     icon: '[?]',  cat: 'SYSTEM' },
];

const MEDIA_APPS = [
  { id: 'radarr',    name: 'Radarr',     desc: 'Movie Manager — Backend Summary',  icon: '[RR]', cat: 'MEDIA',  url: 'http://nas.local:7878' },
  { id: 'sonarr',    name: 'Sonarr',     desc: 'TV Manager — Backend Summary',     icon: '[SR]', cat: 'MEDIA',  url: 'http://nas.local:8989' },
  // SABnzbd hidden in v1 — backend has no /api/media/sabnzbd endpoint yet.
];

const STORAGE_KEY = 'nas_wm_webapps';
function loadWebapps() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_APPS; } catch { return DEFAULT_APPS; } }
function saveWebapps(apps) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(apps)); } catch {} }

// Rofi mode tabs
const MODES = ['apps', 'windows', 'webapps'];

function AppLauncher({ isOpen, onClose, onLaunch, windows = [] }) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('apps');
  const [focused, setFocused] = useState(0);
  const [webapps, setWebapps] = useState(loadWebapps);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newApp, setNewApp] = useState({ name: '', desc: '', url: '', icon: '[>]', cat: 'MEDIA' });
  const searchRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => { saveWebapps(webapps); }, [webapps]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current && searchRef.current.focus(), 50);
      setSearch(''); setFocused(0);
    }
  }, [isOpen]);

  // Update ring background from global gradient angle
  useEffect(() => {
    if (!isOpen) return;
    let raf;
    const updateRing = () => {
      if (ringRef.current) {
        const angle = getComputedStyle(document.documentElement).getPropertyValue('--gradient-angle') || '0deg';
        ringRef.current.style.background = `conic-gradient(from ${angle}, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)`;
      }
      raf = requestAnimationFrame(updateRing);
    };
    raf = requestAnimationFrame(updateRing);
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  // Escape closes
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  // Build flat list for keyboard nav
  const allItems = mode === 'apps'
    ? [...PANEL_APPS, ...MEDIA_APPS].filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase()))
    : mode === 'webapps'
    ? webapps.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()))
    : (windows || []).filter(w => !w.minimized).filter(w => !search || w.title.toLowerCase().includes(search.toLowerCase()));

  // Keyboard navigation
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, allItems.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
    if (e.key === 'Tab')       { e.preventDefault(); setMode(m => { const i = MODES.indexOf(m); return MODES[(i+1) % MODES.length]; }); setFocused(0); }
    if (e.key === 'Enter' && allItems[focused]) { launch(allItems[focused]); }
  };

  const launch = (app) => {
    if (app.id && !app.url) {
      // Window focus
      if (mode === 'windows') { onLaunch({ ...app, _focusWin: true }); }
      else onLaunch(app);
    } else {
      onLaunch(app);
    }
    onClose();
  };

  const addApp = () => {
    if (!newApp.name || !newApp.url) return;
    const app = { ...newApp, id: newApp.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now() };
    setWebapps(w => [...w, app]);
    setNewApp({ name: '', desc: '', url: '', icon: '[>]', cat: 'MEDIA' });
    setShowAddModal(false);
  };

  return (
    <div id="app-launcher" className={isOpen ? 'open' : ''} onClick={e => { if (e.target.id === 'app-launcher') onClose(); }}>
      <div className="rofi-panel">
        {/* Rainbow ring */}
        <div className="rofi-ring" ref={ringRef} style={{ opacity: 0.5 }} />

        <div className="rofi-inner">
          {/* Header with search */}
          <div className="rofi-header">
            <div className="rofi-search-wrap" style={{ flex: 1 }}>
              <span className="rofi-search-icon">❯</span>
              <input
                ref={searchRef}
                className="rofi-search"
                placeholder={mode === 'windows' ? 'switch to window...' : mode === 'webapps' ? 'open web app...' : 'run command...'}
                value={search}
                onChange={e => { setSearch(e.target.value); setFocused(0); }}
                onKeyDown={onKeyDown}
              />
            </div>
          </div>

          {/* Mode tabs — like rofi modi */}
          <div style={{ display: 'flex', gap: 3, padding: '8px 16px 4px', borderBottom: '1px solid rgba(0,165,149,0.1)' }}>
            {[
              { id: 'apps',    label: 'drun',   hint: 'system panels' },
              { id: 'windows', label: 'window', hint: 'open windows' },
              { id: 'webapps', label: 'run',    hint: 'web apps' },
            ].map(m => (
              <button key={m.id} onClick={() => { setMode(m.id); setFocused(0); setSearch(''); }}
                style={{
                  background: mode === m.id ? 'rgba(0,165,149,0.2)' : 'transparent',
                  border: `1px solid ${mode === m.id ? 'rgba(0,165,149,0.5)' : 'rgba(0,165,149,0.1)'}`,
                  borderRadius: '5px',
                  color: mode === m.id ? '#00a595' : 'rgba(0,165,149,0.4)',
                  fontFamily: 'var(--font-system)',
                  fontSize: '0.72rem',
                  padding: '3px 12px',
                  cursor: 'pointer',
                  letterSpacing: '0.5px',
                  transition: 'all 0.12s',
                }}>
                {m.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '0.6rem', color: 'rgba(0,165,149,0.3)', alignSelf: 'center', letterSpacing: 1 }}>
              Tab to switch · ↑↓ navigate · Enter select
            </span>
          </div>

          {/* Content */}
          <div className="rofi-scroll">
            {/* Apps mode */}
            {mode === 'apps' && (
              <>
                {/* System panels */}
                {PANEL_APPS.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase())).length > 0 && (
                  <>
                    <div className="rofi-section-label">System Panels</div>
                    <div className="rofi-grid">
                      {PANEL_APPS
                        .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase()))
                        .map((app, i) => {
                          const idx = i;
                          return (
                            <button key={app.id} className={`rofi-app${focused === idx ? ' focused' : ''}`}
                              onClick={() => launch(app)}
                              onMouseEnter={() => setFocused(idx)}>
                              <span className="rofi-app-icon">{app.icon}</span>
                              <span className="rofi-app-name">{app.name}</span>
                              <span className="rofi-app-desc">{app.desc}</span>
                            </button>
                          );
                        })}
                    </div>
                  </>
                )}
                {/* Media API panels */}
                {MEDIA_APPS.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase())).length > 0 && (
                  <>
                    <div className="rofi-section-label">Media — Native API</div>
                    <div className="rofi-grid">
                      {MEDIA_APPS
                        .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()))
                        .map((app, i) => {
                          const idx = PANEL_APPS.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase())).length + i;
                          return (
                            <button key={app.id} className={`rofi-app${focused === idx ? ' focused' : ''}`}
                              onClick={() => launch(app)}
                              onMouseEnter={() => setFocused(idx)}
                              style={{ borderColor: 'rgba(188,0,202,0.2)' }}>
                              <span className="rofi-app-icon" style={{ color: '#bc00ca', textShadow: '0 0 8px rgba(188,0,202,0.5)' }}>{app.icon}</span>
                              <span className="rofi-app-name">{app.name}</span>
                              <span className="rofi-app-badge">API</span>
                            </button>
                          );
                        })}
                    </div>
                  </>
                )}
              </>
            )}

            {/* Window switcher mode */}
            {mode === 'windows' && (
              <>
                <div className="rofi-section-label">Open Windows ({(windows || []).filter(w => !w.minimized).length})</div>
                <div className="rofi-win-list">
                  {(windows || []).filter(w => !search || w.title.toLowerCase().includes(search.toLowerCase())).map((w, i) => (
                    <div key={w.id}
                      className={`rofi-win-row${focused === i ? ' focused' : ''}`}
                      onClick={() => launch({ ...w, _focusWin: true })}
                      onMouseEnter={() => setFocused(i)}>
                      <div className="rofi-win-dot" style={{ background: w.minimized ? '#888' : '#00a595', boxShadow: w.minimized ? 'none' : '0 0 5px #00a595' }} />
                      <span className="rofi-win-title">{w.title}</span>
                      <span className="rofi-win-type">[{w.type}]</span>
                      {w.minimized && <span style={{ fontSize: '0.6rem', color: 'rgba(0,165,149,0.3)' }}>minimized</span>}
                    </div>
                  ))}
                  {(windows || []).filter(w => !search || w.title.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                    <div style={{ padding: '20px 16px', color: 'rgba(0,165,149,0.3)', fontSize: '0.8rem' }}>No open windows</div>
                  )}
                </div>
              </>
            )}

            {/* Webapps mode */}
            {mode === 'webapps' && (
              <>
                <div className="rofi-section-label">Web Applications</div>
                <div className="rofi-grid">
                  {webapps
                    .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase()))
                    .map((app, i) => (
                      <button key={app.id} className={`rofi-app${focused === i ? ' focused' : ''}`}
                        onClick={() => launch(app)}
                        onMouseEnter={() => setFocused(i)}>
                        <span className="rofi-app-icon" style={{ color: '#ffcf00', textShadow: '0 0 8px rgba(255,207,0,0.5)' }}>{app.icon}</span>
                        <span className="rofi-app-name">{app.name}</span>
                        <span className="rofi-app-desc">{app.desc}</span>
                      </button>
                    ))}
                </div>

                {/* Add webapp */}
                {!showAddModal ? (
                  <div style={{ padding: '8px 16px 12px' }}>
                    <button className="wb-module btn" style={{ width: '100%', textAlign: 'center', padding: '8px', justifyContent: 'center', borderRadius: 6, display: 'flex' }}
                      onClick={() => setShowAddModal(true)}>
                      + Add Web Application
                    </button>
                  </div>
                ) : (
                  <div style={{ margin: '0 12px 12px', background: 'rgba(0,165,149,0.05)', border: '1px solid rgba(0,165,149,0.2)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(0,165,149,0.6)', letterSpacing: 1 }}>Register Web App</div>
                    {[
                      { key: 'name', ph: 'App name' }, { key: 'url', ph: 'http://host:port' },
                      { key: 'desc', ph: 'Description' }, { key: 'icon', ph: 'Icon [XX]' }, { key: 'cat', ph: 'Category' },
                    ].map(f => (
                      <input key={f.key} className="rofi-search" style={{ padding: '6px 10px' }}
                        placeholder={f.ph} value={newApp[f.key]} onChange={e => setNewApp(n => ({ ...n, [f.key]: e.target.value }))} />
                    ))}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="wb-module btn" style={{ flex: 1, justifyContent: 'center', display: 'flex', padding: '6px' }} onClick={addApp}>Register</button>
                      <button className="wb-module btn" style={{ justifyContent: 'center', display: 'flex', padding: '6px 10px' }} onClick={() => setShowAddModal(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer — keybind hints like rofi */}
          <div className="rofi-footer">
            <span>Alt+Space to toggle · Esc to close</span>
            <span>{allItems.length} results</span>
          </div>
        </div>
      </div>
    </div>
  );
}

window.AppLauncher = AppLauncher;
window.PANEL_APPS = PANEL_APPS;
window.DEFAULT_APPS = DEFAULT_APPS;
window.MEDIA_APPS = MEDIA_APPS;

/* BrowserPanel.jsx — In-WM web browser with address bar, bookmarks, history */
const { useState, useEffect, useRef } = React;

const DEFAULT_BOOKMARKS = [
  { name: 'GitHub',       url: 'https://github.com',           icon: '[GH]' },
  { name: 'Arch Wiki',    url: 'https://wiki.archlinux.org',   icon: '[AW]' },
  { name: 'Docker Hub',   url: 'https://hub.docker.com',       icon: '[DH]' },
  { name: 'Reddit',       url: 'https://old.reddit.com',       icon: '[RD]' },
  { name: 'Hacker News',  url: 'https://news.ycombinator.com', icon: '[HN]' },
  { name: 'Speedtest',    url: 'https://fast.com',             icon: '[ST]' },
  { name: 'LinuxServer',  url: 'https://www.linuxserver.io',   icon: '[LS]' },
  { name: 'Selfhosted',   url: 'https://reddit.com/r/selfhosted', icon: '[SH]' },
];

const BM_KEY   = 'nas_browser_bookmarks';
const HIST_KEY = 'nas_browser_history';

function loadBM()   { try { return JSON.parse(localStorage.getItem(BM_KEY))   || DEFAULT_BOOKMARKS; } catch { return DEFAULT_BOOKMARKS; } }
function loadHist() { try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch { return []; } }

function BrowserPanel() {
  const [url, setUrl]         = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [bookmarks, setBM]    = useState(loadBM);
  const [history, setHistory] = useState(loadHist);
  const [view, setView]       = useState('newtab'); // 'newtab' | 'loading' | 'loaded' | 'error'
  const [error, setError]     = useState('');
  const [showBM, setShowBM]   = useState(false);
  const [newBMName, setNewBMName] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => { localStorage.setItem(BM_KEY,   JSON.stringify(bookmarks)); }, [bookmarks]);
  useEffect(() => { localStorage.setItem(HIST_KEY, JSON.stringify(history.slice(0, 100))); }, [history]);

  const normalizeUrl = (raw) => {
    const s = raw.trim();
    if (!s) return '';
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    // looks like a domain?
    if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(s)) return 'https://' + s;
    // search
    return `https://duckduckgo.com/?q=${encodeURIComponent(s)}`;
  };

  const navigate = (raw) => {
    const target = normalizeUrl(raw);
    if (!target) return;
    setUrl(target);
    setInputUrl(target);
    setView('loading');
    setError('');
    setHistory(h => [{ url: target, ts: Date.now() }, ...h.filter(x => x.url !== target)].slice(0, 100));
  };

  const onInputKeyDown = (e) => {
    if (e.key === 'Enter') navigate(inputUrl);
  };

  const onIframeLoad = () => {
    setView('loaded');
    try {
      const iUrl = iframeRef.current?.contentWindow?.location?.href;
      if (iUrl && iUrl !== 'about:blank') setInputUrl(iUrl);
    } catch {}
  };

  const onIframeError = () => {
    setView('error');
    setError('> FAILED TO LOAD PAGE');
  };

  // Try to go back via iframe history
  const goBack = () => {
    try { iframeRef.current?.contentWindow?.history?.back(); } catch {}
  };
  const goForward = () => {
    try { iframeRef.current?.contentWindow?.history?.forward(); } catch {}
  };
  const reload = () => {
    try { iframeRef.current?.contentWindow?.location?.reload(); } catch {
      setView('loading');
      setTimeout(() => setView('loaded'), 400);
    }
  };

  const addBM = () => {
    if (!url) return;
    const name = newBMName || new URL(url).hostname;
    setBM(b => [...b, { name, url, icon: '[*]' }]);
    setNewBMName('');
    setShowBM(false);
  };

  const removeBM = (i) => setBM(b => b.filter((_, j) => j !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#000' }}>

      {/* Navigation toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
        background: 'rgba(0,0,0,0.85)', borderBottom: '1px solid rgba(0,255,0,0.15)',
        flexShrink: 0, flexWrap: 'nowrap',
      }}>
        <button className="cmd-btn-sm" onClick={goBack}    title="Back">[&lt;]</button>
        <button className="cmd-btn-sm" onClick={goForward} title="Forward">[&gt;]</button>
        <button className="cmd-btn-sm" onClick={reload}    title="Reload">[↻]</button>

        {/* Security indicator */}
        <span style={{ fontSize: '0.72rem', color: url.startsWith('https') ? '#27c93f' : '#ffbd2e', flexShrink: 0 }}>
          {url.startsWith('https') ? '[SSL]' : url ? '[HTTP]' : '[--]'}
        </span>

        {/* URL bar */}
        <input
          className="webapp-url-bar"
          style={{ flex: 1, minWidth: 0 }}
          value={inputUrl}
          onChange={e => setInputUrl(e.target.value)}
          onKeyDown={onInputKeyDown}
          onFocus={e => e.target.select()}
          placeholder="$ navigate --url ... or search"
          spellCheck={false}
        />

        <button className="cmd-btn-sm cyan" onClick={() => navigate(inputUrl)} title="Go">[GO]</button>
        <button
          className="cmd-btn-sm"
          title="Bookmark this page"
          onClick={() => { if (url) { setShowBM(s => !s); setNewBMName(''); } }}
        >[★]</button>
        <button
          className="cmd-btn-sm"
          title="Open in new tab"
          onClick={() => url && window.open(url, '_blank')}
        >[↗]</button>
      </div>

      {/* Add bookmark bar */}
      {showBM && url && (
        <div style={{
          display: 'flex', gap: 6, padding: '5px 8px', background: 'rgba(0,20,0,0.5)',
          borderBottom: '1px solid rgba(0,243,255,0.2)', flexShrink: 0, alignItems: 'center',
        }}>
          <input className="logview-filter" style={{ flex: 1 }} placeholder="Bookmark name"
            value={newBMName} onChange={e => setNewBMName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addBM()} />
          <button className="cmd-btn-sm cyan" onClick={addBM}>[SAVE BOOKMARK]</button>
          <button className="cmd-btn-sm" onClick={() => setShowBM(false)}>[×]</button>
        </div>
      )}

      {/* Bookmarks strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
        background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(0,255,0,0.08)',
        overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0,
      }}>
        {bookmarks.map((bm, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
            <button
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '0.72rem',
                padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.5px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--neon-green)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
              onClick={() => navigate(bm.url)}
            >{bm.icon} {bm.name}</button>
            <button
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,95,86,0.3)', fontSize: '9px', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
              onClick={() => removeBM(i)}
              title="Remove"
            >×</button>
          </div>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0a0a0a' }}>

        {/* New tab / home screen */}
        {view === 'newtab' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 24, padding: 20,
            background: 'rgba(0,0,0,0.8)',
          }}>
            <div style={{ color: 'var(--neon-cyan)', fontSize: '1.2rem', letterSpacing: 3, textShadow: 'var(--bloom-cyan)' }}>
              [WEB_BROWSER]
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', lineHeight: 2 }}>
              &gt; TYPE URL OR SEARCH TERM IN THE BAR ABOVE<br/>
              &gt; CLICK A BOOKMARK TO NAVIGATE<br/>
              &gt; NOTE: SITES BLOCKING IFRAMES WON'T LOAD — USE [↗] TO OPEN IN NEW TAB
            </div>

            {/* Quick links grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, width: '100%', maxWidth: 500 }}>
              {bookmarks.slice(0, 8).map((bm, i) => (
                <button key={i}
                  className="launcher-app-btn"
                  style={{ padding: '12px 8px' }}
                  onClick={() => navigate(bm.url)}
                >
                  <span style={{ color: 'var(--neon-purple)', textShadow: 'var(--bloom-purple)', fontSize: '1rem' }}>{bm.icon}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 'bold' }}>{bm.name}</span>
                </button>
              ))}
            </div>

            {/* Recent history */}
            {history.length > 0 && (
              <div style={{ width: '100%', maxWidth: 500 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: 2, marginBottom: 6 }}>&gt; RECENT</div>
                {history.slice(0, 5).map((h, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
                    cursor: 'pointer', borderRadius: 3, fontSize: '0.75rem', transition: 'background 0.1s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,0,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => navigate(h.url)}
                  >
                    <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>[↺]</span>
                    <span style={{ color: 'var(--neon-green)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.url}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loading spinner */}
        {view === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            background: 'rgba(0,0,0,0.9)', zIndex: 5,
          }}>
            <div style={{ color: 'var(--neon-cyan)', fontSize: '0.85rem', letterSpacing: 2, textShadow: 'var(--bloom-cyan)' }}>
              &gt; LOADING...
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', maxWidth: 300, textAlign: 'center', lineHeight: 1.8 }}>
              {url}
            </div>
          </div>
        )}

        {/* Error state */}
        {view === 'error' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            background: 'rgba(0,0,0,0.9)', zIndex: 5,
          }}>
            <div style={{ color: '#ff5f56', fontSize: '0.85rem', letterSpacing: 2, textShadow: '0 0 5px #ff5f56' }}>
              &gt; NAVIGATION FAILED
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.8, maxWidth: 320 }}>
              {error}<br/>
              &gt; Site may block iframes (X-Frame-Options)<br/>
              &gt; Use [↗] to open in a real tab instead
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="cmd-btn-sm cyan" onClick={() => navigate(url)}>[RETRY]</button>
              <button className="cmd-btn-sm" onClick={() => window.open(url, '_blank')}>[OPEN IN TAB]</button>
              <button className="cmd-btn-sm" onClick={() => { setView('newtab'); setUrl(''); setInputUrl(''); }}>[HOME]</button>
            </div>
          </div>
        )}

        {/* The iframe */}
        {(view === 'loading' || view === 'loaded') && (
          <iframe
            ref={iframeRef}
            src={url}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              border: 'none', display: 'block',
              opacity: view === 'loaded' ? 1 : 0,
              transition: 'opacity 0.3s',
              background: '#fff',
            }}
            onLoad={onIframeLoad}
            onError={onIframeError}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
            title="browser"
          />
        )}
      </div>
    </div>
  );
}

window.BrowserPanel = BrowserPanel;

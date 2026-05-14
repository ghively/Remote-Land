/* BrowserPanel.jsx — In-WM web browser with address bar, bookmarks, history */
const {
  useState,
  useEffect,
  useRef
} = React;
const DEFAULT_BOOKMARKS = [{
  name: 'GitHub',
  url: 'https://github.com',
  icon: '[GH]'
}, {
  name: 'Arch Wiki',
  url: 'https://wiki.archlinux.org',
  icon: '[AW]'
}, {
  name: 'Docker Hub',
  url: 'https://hub.docker.com',
  icon: '[DH]'
}, {
  name: 'Reddit',
  url: 'https://old.reddit.com',
  icon: '[RD]'
}, {
  name: 'Hacker News',
  url: 'https://news.ycombinator.com',
  icon: '[HN]'
}, {
  name: 'Speedtest',
  url: 'https://fast.com',
  icon: '[ST]'
}, {
  name: 'LinuxServer',
  url: 'https://www.linuxserver.io',
  icon: '[LS]'
}, {
  name: 'Selfhosted',
  url: 'https://reddit.com/r/selfhosted',
  icon: '[SH]'
}];
const BM_KEY = 'nas_browser_bookmarks';
const HIST_KEY = 'nas_browser_history';
const TRUSTED_KEY = 'nas_browser_trusted_origins';
function loadBM() {
  try {
    return JSON.parse(localStorage.getItem(BM_KEY)) || DEFAULT_BOOKMARKS;
  } catch {
    return DEFAULT_BOOKMARKS;
  }
}
function loadHist() {
  try {
    return JSON.parse(localStorage.getItem(HIST_KEY)) || [];
  } catch {
    return [];
  }
}
function loadTrusted() {
  try {
    return new Set(JSON.parse(localStorage.getItem(TRUSTED_KEY)) || []);
  } catch {
    return new Set();
  }
}
function saveTrusted(set) {
  try {
    localStorage.setItem(TRUSTED_KEY, JSON.stringify([...set]));
  } catch {}
}
function originOf(u) {
  try {
    return new URL(u).origin;
  } catch {
    return '';
  }
}

// Same-origin-with-parent means the iframe can read window.parent's
// sessionStorage / localStorage if `allow-same-origin` is set. That's where
// the API-key-leak risk lives, so we warn loudly before trusting it.
function isParentOrigin(u) {
  if (typeof window === 'undefined' || !window.location) return false;
  return originOf(u) === window.location.origin;
}
function BrowserPanel() {
  const [url, setUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [bookmarks, setBM] = useState(loadBM);
  const [history, setHistory] = useState(loadHist);
  const [trusted, setTrusted] = useState(loadTrusted);
  const [view, setView] = useState('newtab'); // 'newtab' | 'loading' | 'loaded' | 'error'
  const [error, setError] = useState('');
  const [showBM, setShowBM] = useState(false);
  const [newBMName, setNewBMName] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const iframeRef = useRef(null);
  useEffect(() => {
    localStorage.setItem(BM_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);
  useEffect(() => {
    localStorage.setItem(HIST_KEY, JSON.stringify(history.slice(0, 100)));
  }, [history]);
  const currentOrigin = originOf(url);
  const isTrusted = !!currentOrigin && trusted.has(currentOrigin);
  const toggleTrust = () => {
    if (!currentOrigin) return;
    if (!isTrusted && isParentOrigin(url)) {
      const ok = confirm(`WARNING: ${currentOrigin} is the same origin as this app.\n\n` + `Granting "allow-same-origin" here lets the embedded page read this app's ` + `sessionStorage/localStorage — including your saved API key. ` + `Only trust this if you own the page.\n\nContinue?`);
      if (!ok) return;
    }
    setTrusted(prev => {
      const next = new Set(prev);
      if (next.has(currentOrigin)) next.delete(currentOrigin);else next.add(currentOrigin);
      saveTrusted(next);
      return next;
    });
    // Force a reload of the iframe so the new sandbox attribute is applied.
    setView('loading');
    setTimeout(() => setView('loaded'), 50);
  };
  const normalizeUrl = raw => {
    const s = raw.trim();
    if (!s) return '';
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    // looks like a domain?
    if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(s)) return 'https://' + s;
    // search
    return `https://duckduckgo.com/?q=${encodeURIComponent(s)}`;
  };
  const navigate = raw => {
    const target = normalizeUrl(raw);
    if (!target) return;
    setUrl(target);
    setInputUrl(target);
    setView('loading');
    setError('');
    setHistory(h => [{
      url: target,
      ts: Date.now()
    }, ...h.filter(x => x.url !== target)].slice(0, 100));
  };
  const onInputKeyDown = e => {
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
    try {
      iframeRef.current?.contentWindow?.history?.back();
    } catch {}
  };
  const goForward = () => {
    try {
      iframeRef.current?.contentWindow?.history?.forward();
    } catch {}
  };
  const reload = () => {
    try {
      iframeRef.current?.contentWindow?.location?.reload();
    } catch {
      setView('loading');
      setTimeout(() => setView('loaded'), 400);
    }
  };
  const addBM = () => {
    if (!url) return;
    const name = newBMName || new URL(url).hostname;
    setBM(b => [...b, {
      name,
      url,
      icon: '[*]'
    }]);
    setNewBMName('');
    setShowBM(false);
  };
  const removeBM = i => setBM(b => b.filter((_, j) => j !== i));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--bg-dark)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 8px',
      background: 'rgba(0,0,0,0.85)',
      borderBottom: '1px solid rgba(0,255,0,0.15)',
      flexShrink: 0,
      flexWrap: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm",
    onClick: goBack,
    title: "Back"
  }, "[<]"), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm",
    onClick: goForward,
    title: "Forward"
  }, "[>]"), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm",
    onClick: reload,
    title: "Reload"
  }, "[\u21BB]"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.72rem',
      color: url.startsWith('https') ? 'var(--color-success)' : 'var(--color-warn)',
      flexShrink: 0
    }
  }, url.startsWith('https') ? '[SSL]' : url ? '[HTTP]' : '[--]'), currentOrigin && /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm",
    onClick: toggleTrust,
    title: isTrusted ? `Trusted: ${currentOrigin}\nClick to revoke same-origin sandbox.` : `Sandboxed: ${currentOrigin}\nClick to grant same-origin (cookies/localStorage).`,
    style: {
      color: isTrusted ? 'var(--color-warn)' : 'var(--color-success)',
      flexShrink: 0
    }
  }, isTrusted ? '[TRUSTED]' : '[SANDBOX]'), /*#__PURE__*/React.createElement("input", {
    className: "webapp-url-bar",
    style: {
      flex: 1,
      minWidth: 0
    },
    value: inputUrl,
    onChange: e => setInputUrl(e.target.value),
    onKeyDown: onInputKeyDown,
    onFocus: e => e.target.select(),
    placeholder: "$ navigate --url ... or search",
    spellCheck: false
  }), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm cyan",
    onClick: () => navigate(inputUrl),
    title: "Go"
  }, "[GO]"), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm",
    title: "Bookmark this page",
    onClick: () => {
      if (url) {
        setShowBM(s => !s);
        setNewBMName('');
      }
    }
  }, "[\u2605]"), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm",
    title: "Open in new tab",
    onClick: () => url && window.open(url, '_blank')
  }, "[\u2197]")), showBM && url && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      padding: '5px 8px',
      background: 'rgba(0,20,0,0.5)',
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      flexShrink: 0,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "logview-filter",
    style: {
      flex: 1
    },
    placeholder: "Bookmark name",
    value: newBMName,
    onChange: e => setNewBMName(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addBM()
  }), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm cyan",
    onClick: addBM
  }, "[SAVE BOOKMARK]"), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm",
    onClick: () => setShowBM(false)
  }, "[\xD7]")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px',
      background: 'rgba(0,0,0,0.6)',
      borderBottom: '1px solid rgba(0,255,0,0.08)',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      flexShrink: 0
    }
  }, bookmarks.map((bm, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      background: 'transparent',
      border: 'none',
      color: 'var(--text-dim)',
      fontSize: '0.72rem',
      padding: '2px 8px',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      letterSpacing: '0.5px',
      transition: 'color 0.15s'
    },
    onMouseEnter: e => e.currentTarget.style.color = 'var(--neon-green)',
    onMouseLeave: e => e.currentTarget.style.color = 'var(--text-dim)',
    onClick: () => navigate(bm.url)
  }, bm.icon, " ", bm.name), /*#__PURE__*/React.createElement("button", {
    style: {
      background: 'transparent',
      border: 'none',
      color: 'rgba(255,95,86,0.3)',
      fontSize: '9px',
      cursor: 'pointer',
      padding: '0 2px',
      lineHeight: 1
    },
    onClick: () => removeBM(i),
    title: "Remove"
  }, "\xD7")))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--bg-dark)'
    }
  }, view === 'newtab' && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: 20,
      background: 'rgba(0,0,0,0.8)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '1.2rem',
      letterSpacing: 3,
      textShadow: 'var(--bloom-cyan)'
    }
  }, "[WEB_BROWSER]"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.75rem',
      color: 'var(--text-dim)',
      textAlign: 'center',
      lineHeight: 2
    }
  }, "> TYPE URL OR SEARCH TERM IN THE BAR ABOVE", /*#__PURE__*/React.createElement("br", null), "> CLICK A BOOKMARK TO NAVIGATE", /*#__PURE__*/React.createElement("br", null), "> NOTE: SITES BLOCKING IFRAMES WON'T LOAD \u2014 USE [\u2197] TO OPEN IN NEW TAB"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
      gap: 10,
      width: '100%',
      maxWidth: 500
    }
  }, bookmarks.slice(0, 8).map((bm, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "launcher-app-btn",
    style: {
      padding: '12px 8px'
    },
    onClick: () => navigate(bm.url)
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--neon-purple)',
      textShadow: 'var(--bloom-purple)',
      fontSize: '1rem'
    }
  }, bm.icon), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.72rem',
      fontWeight: 'bold'
    }
  }, bm.name)))), history.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 500
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.7rem',
      color: 'var(--text-dim)',
      letterSpacing: 2,
      marginBottom: 6
    }
  }, "> RECENT"), history.slice(0, 5).map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 8px',
      cursor: 'pointer',
      borderRadius: 3,
      fontSize: '0.75rem',
      transition: 'background 0.1s'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(0,255,0,0.05)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent',
    onClick: () => navigate(h.url)
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-dim)',
      flexShrink: 0
    }
  }, "[\u21BA]"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--neon-green)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, h.url))))), view === 'loading' && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      background: 'rgba(0,0,0,0.9)',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.85rem',
      letterSpacing: 2,
      textShadow: 'var(--bloom-cyan)'
    }
  }, "> LOADING..."), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-dim)',
      fontSize: '0.72rem',
      maxWidth: 300,
      textAlign: 'center',
      lineHeight: 1.8
    }
  }, url)), view === 'error' && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      background: 'rgba(0,0,0,0.9)',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--color-error)',
      fontSize: '0.85rem',
      letterSpacing: 2,
      textShadow: '0 0 5px var(--color-error)'
    }
  }, "> NAVIGATION FAILED"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.72rem',
      color: 'var(--text-dim)',
      textAlign: 'center',
      lineHeight: 1.8,
      maxWidth: 320
    }
  }, error, /*#__PURE__*/React.createElement("br", null), "> Site may block iframes (X-Frame-Options)", /*#__PURE__*/React.createElement("br", null), "> Use [\u2197] to open in a real tab instead"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm cyan",
    onClick: () => navigate(url)
  }, "[RETRY]"), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm",
    onClick: () => window.open(url, '_blank')
  }, "[OPEN IN TAB]"), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm",
    onClick: () => {
      setView('newtab');
      setUrl('');
      setInputUrl('');
    }
  }, "[HOME]"))), (view === 'loading' || view === 'loaded') && /*#__PURE__*/React.createElement("iframe", {
    ref: iframeRef,
    src: url,
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      border: 'none',
      display: 'block',
      opacity: view === 'loaded' ? 1 : 0,
      transition: 'opacity 0.3s',
      background: '#fff'
    },
    onLoad: onIframeLoad,
    onError: onIframeError
    // Drop allow-same-origin by default so an embedded page can't read
    // this app's sessionStorage / localStorage (where the API key
    // lives). Only restored for origins the user has explicitly
    // trusted via the toolbar [SANDBOX]/[TRUSTED] toggle.
    ,
    sandbox: `${isTrusted ? 'allow-same-origin ' : ''}` + 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads',
    referrerPolicy: "no-referrer",
    title: "browser"
  })));
}
window.BrowserPanel = BrowserPanel;
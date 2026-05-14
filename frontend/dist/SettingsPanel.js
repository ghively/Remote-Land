/* SettingsPanel.jsx — Full settings, theming, background picker */
const {
  useState,
  useEffect,
  useCallback
} = React;
const SETTINGS_KEY = 'nas_terminal_settings';
const PRESET_THEMES = [{
  id: 'encom',
  name: 'ENCOM',
  desc: "Gene's kitty default — black + cyan",
  vars: {
    '--neon-green': '#00ee00',
    '--neon-cyan': '#00a595',
    '--neon-purple': '#bc00ca',
    '--text-primary': '#00a595',
    '--bg-glass': 'rgba(0,8,0,0.72)',
    '--border-green-30': 'rgba(0,165,149,0.3)'
  }
}, {
  id: 'phosphor',
  name: 'Green Phosphor',
  desc: 'Classic CRT terminal',
  vars: {
    '--neon-green': '#00ff00',
    '--neon-cyan': '#00f3ff',
    '--neon-purple': '#8000ff',
    '--text-primary': '#ccffcc',
    '--bg-glass': 'rgba(10,10,15,0.72)',
    '--border-green-30': 'rgba(0,255,0,0.3)'
  }
}, {
  id: 'dracula',
  name: 'Dracula',
  desc: "Gene's kitty Dracula theme",
  vars: {
    '--neon-green': '#50fa7b',
    '--neon-cyan': '#8ae9fc',
    '--neon-purple': '#bd92f8',
    '--text-primary': '#f8f8f2',
    '--bg-glass': 'rgba(30,31,40,0.75)',
    '--border-green-30': 'rgba(80,250,123,0.3)'
  }
}, {
  id: 'cobalt_neon',
  name: 'Cobalt Neon',
  desc: "Gene's Cobalt Neon kitty theme",
  vars: {
    '--neon-green': '#8ff586',
    '--neon-cyan': '#3aa5ff',
    '--neon-purple': '#781aa0',
    '--text-primary': '#8ff586',
    '--bg-glass': 'rgba(20,40,56,0.75)',
    '--border-green-30': 'rgba(143,245,134,0.3)'
  }
}, {
  id: 'batman',
  name: 'Batman',
  desc: "Gene's Batman kitty theme",
  vars: {
    '--neon-green': '#c8be46',
    '--neon-cyan': '#a2a2a5',
    '--neon-purple': '#737271',
    '--text-primary': '#c5c5be',
    '--bg-glass': 'rgba(27,29,30,0.75)',
    '--border-green-30': 'rgba(200,190,70,0.3)'
  }
}, {
  id: 'dotgov',
  name: 'DotGov',
  desc: "Gene's DotGov kitty theme",
  vars: {
    '--neon-green': '#3d9751',
    '--neon-cyan': '#8bd1ed',
    '--neon-purple': '#772fb0',
    '--text-primary': '#eaeaea',
    '--bg-glass': 'rgba(37,43,53,0.75)',
    '--border-green-30': 'rgba(61,151,81,0.3)'
  }
}, {
  id: 'amber',
  name: 'Amber Terminal',
  desc: 'Warm 70s phosphor',
  vars: {
    '--neon-green': '#ffaa00',
    '--neon-cyan': '#ffdd44',
    '--neon-purple': '#ff6600',
    '--text-primary': '#ffe0a0',
    '--bg-glass': 'rgba(15,10,5,0.75)',
    '--border-green-30': 'rgba(255,170,0,0.3)'
  }
}, {
  id: 'synthwave',
  name: 'Synthwave',
  desc: 'Neon purple retro',
  vars: {
    '--neon-green': '#cc44ff',
    '--neon-cyan': '#ff44cc',
    '--neon-purple': '#4444ff',
    '--text-primary': '#eeccff',
    '--bg-glass': 'rgba(10,5,20,0.75)',
    '--border-green-30': 'rgba(204,68,255,0.3)'
  }
}, {
  id: 'custom',
  name: 'Custom',
  desc: 'User-defined colors from pickers',
  vars: {}
}];
const BG_PRESETS = [{
  id: 'server',
  name: 'Server Room',
  value: "url('assets/bg_server.png')"
}, {
  id: 'dark',
  name: 'Pure Dark',
  value: '#050505'
}, {
  id: 'grid',
  name: 'Hex Grid',
  value: 'radial-gradient(circle at center, #0a0a0f 0%, #050508 100%)'
}, {
  id: 'scanline',
  name: 'Deep Space',
  value: 'linear-gradient(135deg, #000814 0%, #001233 50%, #000814 100%)'
}, {
  id: 'matrix',
  name: 'Matrix Green',
  value: 'linear-gradient(180deg, #000800 0%, #001200 100%)'
}, {
  id: 'custom',
  name: 'Custom URL',
  value: ''
}];
const FONT_OPTIONS = [{
  id: 'fantasque',
  name: 'FantasqueSansM Nerd Font',
  value: "'FantasqueSansM Nerd Font Mono', 'JetBrains Mono', 'Fira Code', monospace"
}, {
  id: 'jetbrains',
  name: 'JetBrains Mono',
  value: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace"
}, {
  id: 'fira',
  name: 'Fira Code',
  value: "'Fira Code', 'JetBrains Mono', 'Courier New', monospace"
}, {
  id: 'sharetech',
  name: 'Share Tech Mono',
  value: "'Share Tech Mono', 'Courier New', monospace"
}, {
  id: 'vt323',
  name: 'VT323 (CRT bitmap)',
  value: "'VT323', 'Courier New', monospace"
}, {
  id: 'courier',
  name: 'Courier New (stock kitty)',
  value: "'Courier New', Courier, monospace"
}];
const SCAN_OPTIONS = [{
  id: 'on',
  name: 'CRT Scanlines ON'
}, {
  id: 'light',
  name: 'Light Scanlines'
}, {
  id: 'off',
  name: 'Scanlines OFF'
}];
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    // Force-upgrade old dark opacity settings
    if (saved && saved.windowOpacity > 80) {
      saved.windowOpacity = 72;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(saved));
    }
    return saved || {
      theme: 'encom',
      bg: 'server',
      customBgUrl: '',
      font: 'fantasque',
      scanlines: 'light',
      // lighter scanlines by default
      rainbowSpeed: 6,
      // 6s per revolution — calm, like hyprland borderangle
      rainbowOpacityInactive: 22,
      fontSize: 14,
      windowOpacity: 72,
      // 72% — lets background show through clearly
      glowIntensity: 80,
      crtFlicker: false,
      // off by default — less distracting
      floatAnimation: true
    };
  } catch {
    return {};
  }
}
function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

// Apply settings to :root CSS vars + body
function applySettings(s) {
  const root = document.documentElement;
  const body = document.body;

  // Theme vars. For the synthetic 'custom' theme we layer the user's
  // saved custom values on top of the phosphor preset so half-finished
  // pickers still produce a coherent palette.
  let theme = PRESET_THEMES.find(t => t.id === s.theme);
  if (theme && theme.id === 'custom') {
    const base = PRESET_THEMES.find(t => t.id === 'phosphor');
    theme = {
      ...theme,
      vars: {
        ...(base && base.vars),
        ...(s.customVars || {})
      }
    };
  }
  if (theme) {
    Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    // Recompute derived vars
    const g = theme.vars['--neon-green'];
    const c = theme.vars['--neon-cyan'];
    root.style.setProperty('--text-dim', hexToRgba(g, 0.6));
    root.style.setProperty('--glow-green-sm', `0 0 5px ${g}`);
    root.style.setProperty('--glow-green-md', `0 0 10px ${g}`);
    root.style.setProperty('--glow-green-lg', `0 0 15px ${g}`);
    root.style.setProperty('--bloom-green', `0 0 2px ${g}, 0 0 10px ${g}`);
    root.style.setProperty('--bloom-cyan', `0 0 5px ${c}`);
    root.style.setProperty('--border-green-20', hexToRgba(g, 0.2));
    root.style.setProperty('--border-green-50', hexToRgba(g, 0.5));
  }

  // Font
  const font = FONT_OPTIONS.find(f => f.id === s.font);
  if (font) {
    root.style.setProperty('--font-system', font.value);
    root.style.setProperty('--font-mono', font.value);
  }

  // Background
  const bgPreset = BG_PRESETS.find(b => b.id === s.bg);
  if (bgPreset) {
    const val = s.bg === 'custom' ? `url('${s.customBgUrl}')` : bgPreset.value;
    if (val.startsWith('url(')) {
      body.style.backgroundImage = val;
      body.style.backgroundColor = '#050505';
    } else if (val.startsWith('#') || val.startsWith('rgb')) {
      body.style.backgroundImage = 'none';
      body.style.backgroundColor = val;
    } else {
      body.style.backgroundImage = val;
      body.style.backgroundColor = '#050505';
    }
    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
    body.style.backgroundAttachment = 'fixed';
  }

  // Glass opacity — map 0-100 to reasonable transparency range
  const op = Math.min(0.88, (s.windowOpacity || 72) / 100);
  root.style.setProperty('--bg-glass', `rgba(4,8,5,${op})`);
  root.style.setProperty('--bg-glass-strong', `rgba(4,8,5,${Math.min(0.92, op + 0.08)})`);

  // wm-inner now uses var(--bg-glass) — no override needed
  // Font size
  body.style.fontSize = `${s.fontSize || 14}px`;

  // Glow intensity
  const gi = (s.glowIntensity || 100) / 100;
  const g2 = theme?.vars['--neon-green'] || '#00ff00';
  root.style.setProperty('--glow-green-sm', `0 0 ${5 * gi}px ${g2}`);
  root.style.setProperty('--glow-green-lg', `0 0 ${15 * gi}px ${g2}`);

  // Scanlines
  const styleId = 'nas-scanline-override';
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  if (s.scanlines === 'off') {
    styleEl.textContent = 'body::after { display: none !important; }';
  } else if (s.scanlines === 'light') {
    styleEl.textContent = 'body::after { opacity: 0.3 !important; }';
  } else {
    styleEl.textContent = '';
  }

  // Float animation
  const floatStyleId = 'nas-float-override';
  let floatEl = document.getElementById(floatStyleId);
  if (!floatEl) {
    floatEl = document.createElement('style');
    floatEl.id = floatStyleId;
    document.head.appendChild(floatEl);
  }
  floatEl.textContent = s.floatAnimation ? '' : '#workspace-inner { animation: none !important; }';

  // Rainbow speed + opacity
  const rSpeedStyleId = 'nas-rainbow-override';
  let rEl = document.getElementById(rSpeedStyleId);
  if (!rEl) {
    rEl = document.createElement('style');
    rEl.id = rSpeedStyleId;
    document.head.appendChild(rEl);
  }
  const speed = s.rainbowSpeed || 2;
  const inactiveOp = (s.rainbowOpacityInactive || 25) / 100;
  rEl.textContent = `
    .wm-window .wm-ring { opacity: ${inactiveOp}; }
    .wm-window.active .wm-ring { opacity: 1; }
  `;
  // Update JS driver speed
  if (window.__rainbowSetSpeed) window.__rainbowSetSpeed(speed);

  // CRT flicker
  const flickerStyleId = 'nas-flicker-override';
  let fEl = document.getElementById(flickerStyleId);
  if (!fEl) {
    fEl = document.createElement('style');
    fEl.id = flickerStyleId;
    document.head.appendChild(fEl);
  }
  fEl.textContent = s.crtFlicker ? '' : 'body::after { animation: none !important; }';
}
function hexToRgba(color, alpha) {
  // Handle hex
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

// ── Settings Panel Component ───────────────────────────────────────────────────
function SettingsPanel({
  onClose
}) {
  const [s, setS] = useState(loadSettings);
  const [activeSection, setActiveSection] = useState('theme');
  const [customBgInput, setCustomBgInput] = useState(s.customBgUrl || '');
  const [notification, setNotification] = useState('');
  const notify = msg => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2500);
  };

  // Apply on every change
  useEffect(() => {
    applySettings(s);
    saveSettings(s);
  }, [s]);
  const set = (key, val) => setS(prev => ({
    ...prev,
    [key]: val
  }));
  const resetToDefaults = () => {
    const def = {
      theme: 'phosphor',
      bg: 'server',
      customBgUrl: '',
      font: 'jetbrains',
      scanlines: 'on',
      rainbowSpeed: 2,
      rainbowOpacityInactive: 25,
      fontSize: 14,
      windowOpacity: 82,
      glowIntensity: 100,
      crtFlicker: true,
      floatAnimation: true
    };
    setS(def);
    saveSettings(def);
    notify('> SETTINGS RESET TO DEFAULTS');
  };
  const SECTIONS = [{
    id: 'theme',
    label: '[THEME]'
  }, {
    id: 'bg',
    label: '[BACKGROUND]'
  }, {
    id: 'font',
    label: '[TYPOGRAPHY]'
  }, {
    id: 'effects',
    label: '[EFFECTS]'
  }, {
    id: 'windows',
    label: '[WINDOWS]'
  }];
  const SliderRow = ({
    label,
    keyName,
    min,
    max,
    step = 1,
    unit = ''
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.72rem',
      color: 'var(--text-dim)',
      letterSpacing: 1
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.72rem',
      color: 'var(--neon-green)',
      textShadow: 'var(--glow-green-sm)'
    }
  }, s[keyName], unit)), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: min,
    max: max,
    step: step,
    value: s[keyName],
    onChange: e => set(keyName, parseFloat(e.target.value)),
    style: {
      width: '100%',
      accentColor: 'var(--neon-green)',
      cursor: 'pointer'
    }
  }));
  const ToggleRow = ({
    label,
    keyName,
    desc
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      borderBottom: '1px solid rgba(0,255,0,0.06)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.78rem',
      color: 'var(--text-primary)'
    }
  }, label), desc && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--text-dim)',
      marginTop: 2
    }
  }, desc)), /*#__PURE__*/React.createElement("button", {
    className: `cmd-btn-sm${s[keyName] ? ' cyan' : ''}`,
    onClick: () => set(keyName, !s[keyName]),
    style: {
      minWidth: 70
    }
  }, s[keyName] ? '[ON]' : '[OFF]'));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      position: 'relative'
    }
  }, notification && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      background: 'rgba(0,243,255,0.15)',
      borderBottom: '1px solid var(--neon-cyan)',
      padding: '5px 12px',
      fontSize: '0.75rem',
      color: 'var(--neon-cyan)',
      letterSpacing: 1
    }
  }, notification), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 4,
      padding: '6px 10px',
      borderBottom: '1px solid rgba(0,255,0,0.1)',
      background: 'rgba(0,0,0,0.5)',
      flexShrink: 0
    }
  }, SECTIONS.map(sec => /*#__PURE__*/React.createElement("button", {
    key: sec.id,
    className: `cmd-btn-sm${activeSection === sec.id ? ' cyan' : ''}`,
    onClick: () => setActiveSection(sec.id)
  }, sec.label)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm warn",
    onClick: resetToDefaults
  }, "[RESET]")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 14,
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, activeSection === 'theme' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 12,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 6
    }
  }, "COLOR THEME"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: 8,
      marginBottom: 20
    }
  }, PRESET_THEMES.map(theme => /*#__PURE__*/React.createElement("button", {
    key: theme.id,
    onClick: () => set('theme', theme.id),
    style: {
      background: s.theme === theme.id ? 'rgba(0,255,0,0.1)' : 'rgba(0,0,0,0.4)',
      border: `1px solid ${s.theme === theme.id ? 'var(--neon-green)' : 'rgba(0,255,0,0.2)'}`,
      borderRadius: 4,
      padding: '10px 12px',
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'all 0.15s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginBottom: 6
    }
  }, Object.values(theme.vars).slice(0, 3).map((v, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 14,
      height: 14,
      borderRadius: 2,
      background: v.startsWith('rgba') ? v : v,
      border: '1px solid rgba(255,255,255,0.1)',
      flexShrink: 0
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.78rem',
      color: s.theme === theme.id ? 'var(--neon-green)' : 'var(--text-primary)',
      fontWeight: 'bold'
    }
  }, theme.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--text-dim)',
      marginTop: 2
    }
  }, theme.desc), s.theme === theme.id && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--neon-green)',
      marginTop: 4
    }
  }, "\u25CF ACTIVE")))), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 10,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 6
    }
  }, "CUSTOM OVERRIDES"), [{
    label: 'Primary Accent',
    var: '--neon-green',
    keyHint: 'buttons, borders, prompts'
  }, {
    label: 'Secondary Accent',
    var: '--neon-cyan',
    keyHint: 'titles, headings'
  }, {
    label: 'Tertiary Accent',
    var: '--neon-purple',
    keyHint: 'tags, separators'
  }].map(c => /*#__PURE__*/React.createElement("div", {
    key: c.var,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.75rem',
      color: 'var(--text-primary)'
    }
  }, c.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--text-dim)'
    }
  }, c.keyHint)), /*#__PURE__*/React.createElement("input", {
    type: "color",
    key: `${s.theme}-${c.var}`,
    defaultValue: s.theme === 'custom' && s.customVars && s.customVars[c.var] || PRESET_THEMES.find(t => t.id === s.theme)?.vars?.[c.var] || '#00ff00',
    onChange: e => {
      const val = e.target.value;
      // Stash in component state — never mutate the preset object.
      setS(prev => ({
        ...prev,
        theme: 'custom',
        customVars: {
          ...(prev.customVars || {}),
          [c.var]: val
        }
      }));
    },
    style: {
      width: 40,
      height: 28,
      border: '1px solid rgba(0,255,0,0.3)',
      borderRadius: 3,
      background: 'transparent',
      cursor: 'pointer'
    }
  })))), activeSection === 'bg' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 12,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 6
    }
  }, "BACKGROUND"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: 8,
      marginBottom: 16
    }
  }, BG_PRESETS.filter(b => b.id !== 'custom').map(bg => /*#__PURE__*/React.createElement("button", {
    key: bg.id,
    onClick: () => set('bg', bg.id),
    style: {
      background: s.bg === bg.id ? 'rgba(0,255,0,0.1)' : 'rgba(0,0,0,0.4)',
      border: `1px solid ${s.bg === bg.id ? 'var(--neon-green)' : 'rgba(0,255,0,0.15)'}`,
      borderRadius: 4,
      padding: '8px 10px',
      cursor: 'pointer',
      minHeight: 60,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 30,
      borderRadius: 3,
      marginBottom: 6,
      background: bg.value.startsWith('url') ? `${bg.value} center/cover` : bg.value,
      border: '1px solid rgba(255,255,255,0.1)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.72rem',
      color: s.bg === bg.id ? 'var(--neon-green)' : 'var(--text-primary)'
    }
  }, bg.name), s.bg === bg.id && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.62rem',
      color: 'var(--neon-green)',
      marginTop: 2
    }
  }, "\u25CF ACTIVE")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.72rem',
      color: 'var(--text-dim)',
      letterSpacing: 1,
      marginBottom: 6
    }
  }, "CUSTOM BACKGROUND URL"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "logview-filter",
    style: {
      flex: 1
    },
    placeholder: "https://... or /path/to/image.jpg",
    value: customBgInput,
    onChange: e => setCustomBgInput(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm cyan",
    onClick: () => {
      set('bg', 'custom');
      set('customBgUrl', customBgInput);
      notify('> BACKGROUND UPDATED');
    }
  }, "[APPLY]")))), activeSection === 'font' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 12,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 6
    }
  }, "FONT FAMILY"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      marginBottom: 20
    }
  }, FONT_OPTIONS.map(f => /*#__PURE__*/React.createElement("button", {
    key: f.id,
    onClick: () => set('font', f.id),
    style: {
      background: s.font === f.id ? 'rgba(0,255,0,0.08)' : 'transparent',
      border: `1px solid ${s.font === f.id ? 'var(--neon-green)' : 'rgba(0,255,0,0.1)'}`,
      borderRadius: 3,
      padding: '8px 12px',
      cursor: 'pointer',
      textAlign: 'left',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: f.value,
      fontSize: '0.85rem',
      color: s.font === f.id ? 'var(--neon-green)' : 'var(--text-primary)'
    }
  }, f.name, " \u2014 AaBbCc 0123"), s.font === f.id && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--neon-green)'
    }
  }, "\u25CF ACTIVE")))), /*#__PURE__*/React.createElement(SliderRow, {
    label: "BASE FONT SIZE",
    keyName: "fontSize",
    min: 10,
    max: 20,
    unit: "px"
  })), activeSection === 'effects' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 12,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 6
    }
  }, "CRT EFFECTS"), /*#__PURE__*/React.createElement(ToggleRow, {
    label: "Flicker Animation",
    keyName: "crtFlicker",
    desc: "Subtle opacity flicker on scanlines"
  }), /*#__PURE__*/React.createElement(ToggleRow, {
    label: "Workspace Float",
    keyName: "floatAnimation",
    desc: "Gentle 1-2px ambient drift on desktop"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 10,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 6
    }
  }, "SCANLINE INTENSITY"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, SCAN_OPTIONS.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.id,
    onClick: () => set('scanlines', o.id),
    style: {
      background: s.scanlines === o.id ? 'rgba(0,255,0,0.08)' : 'transparent',
      border: `1px solid ${s.scanlines === o.id ? 'var(--neon-green)' : 'rgba(0,255,0,0.1)'}`,
      borderRadius: 3,
      padding: '7px 12px',
      cursor: 'pointer',
      textAlign: 'left',
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.78rem',
      color: s.scanlines === o.id ? 'var(--neon-green)' : 'var(--text-primary)'
    }
  }, o.name), s.scanlines === o.id && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--neon-green)'
    }
  }, "\u25CF ACTIVE"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 10,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 6
    }
  }, "GLOW"), /*#__PURE__*/React.createElement(SliderRow, {
    label: "GLOW INTENSITY",
    keyName: "glowIntensity",
    min: 0,
    max: 200,
    unit: "%"
  }))), activeSection === 'windows' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 12,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 6
    }
  }, "WINDOW APPEARANCE"), /*#__PURE__*/React.createElement(SliderRow, {
    label: "GLASS OPACITY",
    keyName: "windowOpacity",
    min: 40,
    max: 100,
    unit: "%"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      marginBottom: 6,
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 6
    }
  }, "RAINBOW BORDER"), /*#__PURE__*/React.createElement(SliderRow, {
    label: "ACTIVE SPEED (s/rev)",
    keyName: "rainbowSpeed",
    min: 0.5,
    max: 10,
    step: 0.5,
    unit: "s"
  }), /*#__PURE__*/React.createElement(SliderRow, {
    label: "INACTIVE OPACITY",
    keyName: "rainbowOpacityInactive",
    min: 0,
    max: 80,
    unit: "%"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 12px',
      borderTop: '1px dashed rgba(0,255,0,0.2)',
      flexShrink: 0,
      background: 'rgba(0,0,0,0.5)',
      fontSize: '0.68rem',
      color: 'var(--text-dim)',
      letterSpacing: 1
    }
  }, "> SETTINGS AUTO-SAVED TO BROWSER STORAGE \xA0|\xA0 PERSIST ACROSS RELOADS"));
}

// Apply settings on initial load — clear stale overly-dark settings first
(function () {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    // Clear if settings are from old dark version
    if (saved && (saved.windowOpacity > 80 || saved.rainbowSpeed < 3)) {
      saved.windowOpacity = 72;
      saved.rainbowSpeed = 6;
      saved.scanlines = 'light';
      saved.crtFlicker = false;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(saved));
    }
  } catch {}
  const toApply = loadSettings();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applySettings(toApply));
  } else {
    applySettings(toApply);
  }
})();
window.SettingsPanel = SettingsPanel;
window.applySettings = applySettings;
window.loadSettings = loadSettings;
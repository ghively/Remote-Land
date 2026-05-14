/* WindowManager.jsx — Dwindle tiling + drag/resize + keyboard shortcuts */
const {
  useState,
  useEffect,
  useRef,
  useCallback
} = React;

// ── Dwindle layout ────────────────────────────────────────────────────────────
// Hyprland-style: split the largest side recursively, leaving a `gap_in`
// between siblings. Minimum tile size is enforced so we never produce a
// rect smaller than the window's own min-width/min-height CSS (300x200).
const TILE_MIN_W = 300;
const TILE_MIN_H = 200;
const GAP_IN = 8;
function dwindleLayout(count, rect, depth = 0) {
  if (count === 0) return [];
  if (count === 1) return [{
    ...rect
  }];
  const {
    x,
    y,
    w,
    h
  } = rect;
  const splitHoriz = w >= h;
  let a, b;
  if (splitHoriz) {
    const hw = Math.floor((w - GAP_IN) / 2);
    a = {
      x,
      y,
      w: hw,
      h
    };
    b = {
      x: x + hw + GAP_IN,
      y,
      w: w - hw - GAP_IN,
      h
    };
  } else {
    const hh = Math.floor((h - GAP_IN) / 2);
    a = {
      x,
      y,
      w,
      h: hh
    };
    b = {
      x,
      y: y + hh + GAP_IN,
      w,
      h: h - hh - GAP_IN
    };
  }
  // If splitting any further would produce a sub-min-size tile, stop and
  // stack the remaining windows on top of `b` so nothing renders broken.
  if (a.w < TILE_MIN_W || a.h < TILE_MIN_H || b.w < TILE_MIN_W || b.h < TILE_MIN_H) {
    return Array.from({
      length: count
    }, () => ({
      ...rect
    }));
  }
  return [a, ...dwindleLayout(count - 1, b, depth + 1)];
}

// Wrapper that returns a {winId -> rect} map keyed by window ID, so
// minimizing/closing a window doesn't shift the remaining windows to wrong
// rects. Pass the ordered list of visible windows.
function dwindleLayoutByWin(visibleWins, rect) {
  const rects = dwindleLayout(visibleWins.length, rect);
  const byId = {};
  visibleWins.forEach((w, i) => {
    byId[w.id] = rects[i];
  });
  return byId;
}

// ── Individual Window ─────────────────────────────────────────────────────────
function WMWindow({
  win,
  isActive,
  onActivate,
  onClose,
  onMinimize,
  onMaximize,
  onPositionChange,
  children,
  isTiled,
  tileRect
}) {
  const [pos, setPos] = useState({
    x: win.x || 80,
    y: win.y || 60,
    w: win.w || 720,
    h: win.h || 500
  });
  const [maximized, setMaxized] = useState(false);
  const [popIn, setPopIn] = useState(false);
  const posRef = useRef(pos);
  posRef.current = pos;

  // Add pop-in class after first paint so window is visible at t=0
  useEffect(() => {
    const t = setTimeout(() => setPopIn(true), 16); // one frame delay
    return () => clearTimeout(t);
  }, []);

  // Snap to tile rect when tiling is on
  useEffect(() => {
    if (isTiled && tileRect) {
      setMaxized(false);
      setPos({
        x: tileRect.x,
        y: tileRect.y,
        w: tileRect.w,
        h: tileRect.h
      });
    }
  }, [isTiled, tileRect && tileRect.x, tileRect && tileRect.y, tileRect && tileRect.w, tileRect && tileRect.h]);
  const style = maximized ? {
    left: 0,
    top: 0,
    width: '100%',
    height: '100%'
  } : {
    left: pos.x,
    top: pos.y,
    width: pos.w,
    height: pos.h
  };

  // ── Drag ──────────────────────────────────────────────────────────────────
  const startDrag = e => {
    if (e.button !== 0 || isTiled || maximized) return;
    e.preventDefault();
    onActivate();
    const ox = e.clientX - posRef.current.x;
    const oy = e.clientY - posRef.current.y;
    const onMove = ev => {
      setPos(p => ({
        ...p,
        x: ev.clientX - ox,
        y: Math.max(0, ev.clientY - oy)
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      onPositionChange && onPositionChange(win.id, posRef.current);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Resize (SE corner) ────────────────────────────────────────────────────
  const startResize = e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onActivate();
    const sx = e.clientX,
      sy = e.clientY;
    const sw = posRef.current.w,
      sh = posRef.current.h;
    const onMove = ev => {
      setPos(p => ({
        ...p,
        w: Math.max(300, sw + ev.clientX - sx),
        h: Math.max(200, sh + ev.clientY - sy)
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Resize (right edge) ───────────────────────────────────────────────────
  const startResizeRight = e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onActivate();
    const sx = e.clientX,
      sw = posRef.current.w;
    const onMove = ev => setPos(p => ({
      ...p,
      w: Math.max(300, sw + ev.clientX - sx)
    }));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Resize (bottom edge) ──────────────────────────────────────────────────
  const startResizeBottom = e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onActivate();
    const sy = e.clientY,
      sh = posRef.current.h;
    const onMove = ev => setPos(p => ({
      ...p,
      h: Math.max(200, sh + ev.clientY - sy)
    }));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const handleMax = e => {
    e.stopPropagation();
    setMaxized(m => !m);
    onMaximize && onMaximize(win.id);
  };
  const zIndex = isActive ? 100 : 10;
  return /*#__PURE__*/React.createElement("div", {
    className: `wm-window${isActive ? ' active' : ''}${popIn ? ' popin' : ''}`,
    style: {
      position: 'absolute',
      ...style,
      zIndex,
      transition: isTiled ? 'left 0.35s cubic-bezier(0.25,1,0.5,1), top 0.35s cubic-bezier(0.25,1,0.5,1), width 0.35s cubic-bezier(0.25,1,0.5,1), height 0.35s cubic-bezier(0.25,1,0.5,1)' : 'none'
    },
    onMouseDown: e => {
      onActivate();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "wm-ring",
    style: {
      background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "wm-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wm-titlebar",
    onMouseDown: startDrag
  }, /*#__PURE__*/React.createElement("div", {
    className: "win-dots"
  }, /*#__PURE__*/React.createElement("button", {
    className: "win-dot close",
    onMouseDown: e => e.stopPropagation(),
    onClick: e => {
      e.stopPropagation();
      onClose(win.id);
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "win-dot min",
    onMouseDown: e => e.stopPropagation(),
    onClick: e => {
      e.stopPropagation();
      onMinimize(win.id);
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "win-dot max",
    onMouseDown: e => e.stopPropagation(),
    onClick: handleMax
  })), /*#__PURE__*/React.createElement("div", {
    className: "win-title"
  }, win.title), /*#__PURE__*/React.createElement("div", {
    className: "win-type-badge"
  }, "[", win.type.toUpperCase(), "]")), /*#__PURE__*/React.createElement("div", {
    className: "wm-body"
  }, children)), !isTiled && !maximized && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "wm-resize-se",
    onMouseDown: startResize
  }), /*#__PURE__*/React.createElement("div", {
    className: "wm-resize-e",
    onMouseDown: startResizeRight
  }), /*#__PURE__*/React.createElement("div", {
    className: "wm-resize-s",
    onMouseDown: startResizeBottom
  })));
}

// ── Keyboard handler — matches Gene's hyprland UserKeybinds.conf ─────────────
// Browser-safe bindings:
//   Super (Meta/Cmd) works on some setups but gets captured on others
//   Ctrl+Alt combos work reliably in browser context
//   Alt+Space = launcher (your actual rofi bind — works in browser)
function useKeyboardWM({
  onNewTerm,
  onLauncher,
  onClose,
  onMinimize,
  onCycleNext,
  onCyclePrev,
  onToggleTile,
  onMoveWindow,
  onCheatsheet
}) {
  useEffect(() => {
    const handler = e => {
      const meta = e.metaKey; // Cmd (Mac) / Win key
      const ctrl = e.ctrlKey;
      const alt = e.altKey;
      const shift = e.shiftKey;
      const key = e.key;

      // Skip if typing in an input/textarea — but NOT xterm's hidden textarea
      const tag = document.activeElement?.tagName;
      if ((tag === 'INPUT' || tag === 'TEXTAREA') && !document.activeElement.closest('.xterm')) return;

      // Alt+Space → launcher (your actual rofi bind)
      if (alt && !ctrl && !meta && key === ' ') {
        e.preventDefault();
        onLauncher && onLauncher();
        return;
      }
      // Ctrl+Alt+T → new terminal  (browser-safe version of Super+Return)
      if (ctrl && alt && key === 't') {
        e.preventDefault();
        onNewTerm && onNewTerm();
        return;
      }
      // Meta+Enter → new terminal (Super+Return — works if Meta isn't captured)
      if (meta && key === 'Enter') {
        e.preventDefault();
        onNewTerm && onNewTerm();
        return;
      }
      // Ctrl+Alt+H → cheatsheet  (Super+H)
      if (ctrl && alt && key === 'h') {
        e.preventDefault();
        onCheatsheet && onCheatsheet();
        return;
      }
      // Meta+H → cheatsheet
      if (meta && key === 'h') {
        e.preventDefault();
        onCheatsheet && onCheatsheet();
        return;
      }
      // Escape in launcher is handled by launcher itself
      // Ctrl+Alt+W → close active window  (Super+Q)
      if (ctrl && alt && key === 'w') {
        e.preventDefault();
        onClose && onClose();
        return;
      }
      // Ctrl+Alt+M → minimize
      if (ctrl && alt && key === 'm') {
        e.preventDefault();
        onMinimize && onMinimize();
        return;
      }
      // Ctrl+Alt+Space → toggle tiling  (Super+Space)
      if (ctrl && alt && key === ' ') {
        e.preventDefault();
        onToggleTile && onToggleTile();
        return;
      }
      // Meta+Space → toggle tiling
      if (meta && key === ' ') {
        e.preventDefault();
        onToggleTile && onToggleTile();
        return;
      }
      // Alt+Tab → cycle forward
      if (alt && !ctrl && key === 'Tab' && !shift) {
        e.preventDefault();
        onCycleNext && onCycleNext();
        return;
      }
      // Alt+Shift+Tab → cycle backward
      if (alt && shift && key === 'Tab') {
        e.preventDefault();
        onCyclePrev && onCyclePrev();
        return;
      }
      // Ctrl+Alt+arrows → move window (float mode)
      if (ctrl && alt) {
        if (key === 'ArrowLeft') {
          e.preventDefault();
          onMoveWindow && onMoveWindow('left');
          return;
        }
        if (key === 'ArrowRight') {
          e.preventDefault();
          onMoveWindow && onMoveWindow('right');
          return;
        }
        if (key === 'ArrowUp') {
          e.preventDefault();
          onMoveWindow && onMoveWindow('up');
          return;
        }
        if (key === 'ArrowDown') {
          e.preventDefault();
          onMoveWindow && onMoveWindow('down');
          return;
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onNewTerm, onLauncher, onClose, onMinimize, onCycleNext, onCyclePrev, onToggleTile, onMoveWindow, onCheatsheet]);
}

// ── Keyboard cheatsheet overlay ───────────────────────────────────────────────
function KeyboardCheatsheet({
  onClose
}) {
  // Matches Gene's hyprland UserKeybinds.conf — browser-safe versions
  const BINDINGS = [{
    keys: 'Alt + Space',
    action: 'App launcher  (rofi — your actual bind)'
  }, {
    keys: 'Ctrl+Alt + T',
    action: 'New terminal  (Super+Return equivalent)'
  }, {
    keys: 'Ctrl+Alt + H',
    action: 'This keybind cheatsheet  (Super+H)'
  }, {
    keys: 'Ctrl+Alt + W',
    action: 'Close active window  (Super+Q)'
  }, {
    keys: 'Ctrl+Alt + M',
    action: 'Minimize active window'
  }, {
    keys: 'Ctrl+Alt + Space',
    action: 'Toggle float ↔ dwindle tiling  (Super+Space)'
  }, {
    keys: 'Alt + Tab',
    action: 'Cycle windows forward'
  }, {
    keys: 'Alt + Shift + Tab',
    action: 'Cycle windows backward'
  }, {
    keys: 'Ctrl+Alt + ← → ↑ ↓',
    action: 'Move window  (float mode)'
  }, {
    keys: 'Escape',
    action: 'Close overlay / launcher'
  }];
  const dialogRef = React.useRef(null);
  const closeBtnRef = React.useRef(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    // Move focus into the dialog so Tab cycles within it.
    if (closeBtnRef.current) closeBtnRef.current.focus();
    const onKey = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [onClose]);
  return /*#__PURE__*/React.createElement("div", {
    role: "presentation",
    style: {
      position: 'fixed',
      inset: 0,
      background: 'var(--bg-overlay-2)',
      backdropFilter: 'blur(6px)',
      zIndex: 6000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    ref: dialogRef,
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "cheatsheet-title",
    style: {
      background: 'rgba(10,10,15,0.95)',
      border: '1px solid var(--border-green-30)',
      borderRadius: 'var(--radius-xl)',
      padding: 28,
      minWidth: 420,
      maxWidth: '90vw',
      boxShadow: 'var(--shadow-window)'
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    id: "cheatsheet-title",
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '1rem',
      letterSpacing: 3,
      textShadow: 'var(--bloom-cyan)',
      marginBottom: 16,
      borderBottom: '2px solid var(--neon-purple)',
      paddingBottom: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, "[KEYBOARD_BINDINGS]"), /*#__PURE__*/React.createElement("button", {
    ref: closeBtnRef,
    onClick: onClose,
    "aria-label": "Close keyboard bindings",
    style: {
      background: 'transparent',
      border: '1px solid var(--border-green-30)',
      color: 'var(--neon-cyan)',
      padding: '2px 10px',
      borderRadius: 3,
      fontFamily: 'var(--font-mono)',
      cursor: 'pointer'
    }
  }, "ESC")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, BINDINGS.map((b, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 16,
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.8rem',
      color: 'var(--neon-green)',
      textShadow: 'var(--glow-green-sm)',
      minWidth: 200,
      flexShrink: 0,
      background: 'rgba(0,255,0,0.07)',
      padding: '2px 8px',
      borderRadius: 3,
      border: '1px solid var(--border-green-20)'
    }
  }, b.keys), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-dim)',
      fontSize: '0.8rem'
    }
  }, b.action)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      textAlign: 'center',
      fontSize: '0.72rem',
      color: 'var(--text-dim)'
    }
  }, "Press [ESC] or click outside to dismiss")));
}
window.WMWindow = WMWindow;
window.dwindleLayout = dwindleLayout;
window.dwindleLayoutByWin = dwindleLayoutByWin;
window.useKeyboardWM = useKeyboardWM;
window.KeyboardCheatsheet = KeyboardCheatsheet;
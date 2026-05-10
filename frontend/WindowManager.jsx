/* WindowManager.jsx — Dwindle tiling + drag/resize + keyboard shortcuts */
const { useState, useEffect, useRef, useCallback } = React;

// ── Dwindle layout ────────────────────────────────────────────────────────────
function dwindleLayout(count, rect, depth = 0) {
  if (count === 0) return [];
  if (count === 1) return [{ ...rect }];
  const { x, y, w, h } = rect;
  const gap = 8;
  const splitHoriz = w >= h;
  let a, b;
  if (splitHoriz) {
    const hw = Math.floor((w - gap) / 2);
    a = { x, y, w: hw, h };
    b = { x: x + hw + gap, y, w: w - hw - gap, h };
  } else {
    const hh = Math.floor((h - gap) / 2);
    a = { x, y, w, h: hh };
    b = { x, y: y + hh + gap, w, h: h - hh - gap };
  }
  return [a, ...dwindleLayout(count - 1, b, depth + 1)];
}

// ── Individual Window ─────────────────────────────────────────────────────────
function WMWindow({ win, isActive, onActivate, onClose, onMinimize, onMaximize, onPositionChange, children, isTiled, tileRect }) {
  const [pos, setPos]           = useState({ x: win.x || 80, y: win.y || 60, w: win.w || 720, h: win.h || 500 });
  const [maximized, setMaxized] = useState(false);
  const [popIn, setPopIn]       = useState(false);
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
      setPos({ x: tileRect.x, y: tileRect.y, w: tileRect.w, h: tileRect.h });
    }
  }, [isTiled, tileRect && tileRect.x, tileRect && tileRect.y, tileRect && tileRect.w, tileRect && tileRect.h]);

  const style = maximized
    ? { left: 0, top: 0, width: '100%', height: '100%' }
    : { left: pos.x, top: pos.y, width: pos.w, height: pos.h };

  // ── Drag ──────────────────────────────────────────────────────────────────
  const startDrag = (e) => {
    if (e.button !== 0 || isTiled || maximized) return;
    e.preventDefault();
    onActivate();
    const ox = e.clientX - posRef.current.x;
    const oy = e.clientY - posRef.current.y;
    const onMove = (ev) => {
      setPos(p => ({ ...p, x: ev.clientX - ox, y: Math.max(0, ev.clientY - oy) }));
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
  const startResize = (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    onActivate();
    const sx = e.clientX, sy = e.clientY;
    const sw = posRef.current.w, sh = posRef.current.h;
    const onMove = (ev) => {
      setPos(p => ({
        ...p,
        w: Math.max(300, sw + ev.clientX - sx),
        h: Math.max(200, sh + ev.clientY - sy),
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
  const startResizeRight = (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    onActivate();
    const sx = e.clientX, sw = posRef.current.w;
    const onMove = (ev) => setPos(p => ({ ...p, w: Math.max(300, sw + ev.clientX - sx) }));
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Resize (bottom edge) ──────────────────────────────────────────────────
  const startResizeBottom = (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    onActivate();
    const sy = e.clientY, sh = posRef.current.h;
    const onMove = (ev) => setPos(p => ({ ...p, h: Math.max(200, sh + ev.clientY - sy) }));
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleMax = (e) => {
    e.stopPropagation();
    setMaxized(m => !m);
    onMaximize && onMaximize(win.id);
  };

  const zIndex = isActive ? 100 : 10;

  return (
    <div
      className={`wm-window${isActive ? ' active' : ''}${popIn ? ' popin' : ''}`}
      style={{ position: 'absolute', ...style, zIndex,
        transition: isTiled ? 'left 0.35s cubic-bezier(0.25,1,0.5,1), top 0.35s cubic-bezier(0.25,1,0.5,1), width 0.35s cubic-bezier(0.25,1,0.5,1), height 0.35s cubic-bezier(0.25,1,0.5,1)' : 'none'
      }}
      onMouseDown={(e) => { onActivate(); }}
    >
      {/* Rainbow ring — pre-painted, updated each rAF tick */}
      <div className="wm-ring" style={{
        background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
      }} />
      {/* wm-inner clips content, sits 3px inside the ring gap */}
      <div className="wm-inner">
        {/* Title bar — drag handle */}
        <div className="wm-titlebar" onMouseDown={startDrag}>
          <div className="win-dots">
            <button className="win-dot close" onMouseDown={e=>e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onClose(win.id); }} />
            <button className="win-dot min"   onMouseDown={e=>e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onMinimize(win.id); }} />
            <button className="win-dot max"   onMouseDown={e=>e.stopPropagation()} onClick={handleMax} />
          </div>
          <div className="win-title">{win.title}</div>
          <div className="win-type-badge">[{win.type.toUpperCase()}]</div>
        </div>
        <div className="wm-body">{children}</div>
      </div>

      {/* Resize handles — outside wm-inner so they're always hittable */}
      {!isTiled && !maximized && (<>
        {/* SE corner */}
        <div className="wm-resize-se" onMouseDown={startResize} />
        {/* Right edge */}
        <div className="wm-resize-e"  onMouseDown={startResizeRight} />
        {/* Bottom edge */}
        <div className="wm-resize-s"  onMouseDown={startResizeBottom} />
      </>)}
    </div>
  );
}

// ── Keyboard handler — matches Gene's hyprland UserKeybinds.conf ─────────────
// Browser-safe bindings:
//   Super (Meta/Cmd) works on some setups but gets captured on others
//   Ctrl+Alt combos work reliably in browser context
//   Alt+Space = launcher (your actual rofi bind — works in browser)
function useKeyboardWM({ onNewTerm, onLauncher, onClose, onMinimize, onCycleNext, onCyclePrev, onToggleTile, onMoveWindow, onCheatsheet }) {
  useEffect(() => {
    const handler = (e) => {
      const meta  = e.metaKey;   // Cmd (Mac) / Win key
      const ctrl  = e.ctrlKey;
      const alt   = e.altKey;
      const shift = e.shiftKey;
      const key   = e.key;

      // Skip if typing in an input/textarea — but NOT xterm's hidden textarea
      const tag = document.activeElement?.tagName;
      if ((tag === 'INPUT' || tag === 'TEXTAREA') && !document.activeElement.closest('.xterm')) return;

      // Alt+Space → launcher (your actual rofi bind)
      if (alt && !ctrl && !meta && key === ' ') {
        e.preventDefault(); onLauncher && onLauncher(); return;
      }
      // Ctrl+Alt+T → new terminal  (browser-safe version of Super+Return)
      if (ctrl && alt && key === 't') {
        e.preventDefault(); onNewTerm && onNewTerm(); return;
      }
      // Meta+Enter → new terminal (Super+Return — works if Meta isn't captured)
      if (meta && key === 'Enter') {
        e.preventDefault(); onNewTerm && onNewTerm(); return;
      }
      // Ctrl+Alt+H → cheatsheet  (Super+H)
      if (ctrl && alt && key === 'h') {
        e.preventDefault(); onCheatsheet && onCheatsheet(); return;
      }
      // Meta+H → cheatsheet
      if (meta && key === 'h') {
        e.preventDefault(); onCheatsheet && onCheatsheet(); return;
      }
      // Escape in launcher is handled by launcher itself
      // Ctrl+Alt+W → close active window  (Super+Q)
      if (ctrl && alt && key === 'w') {
        e.preventDefault(); onClose && onClose(); return;
      }
      // Ctrl+Alt+M → minimize
      if (ctrl && alt && key === 'm') {
        e.preventDefault(); onMinimize && onMinimize(); return;
      }
      // Ctrl+Alt+Space → toggle tiling  (Super+Space)
      if (ctrl && alt && key === ' ') {
        e.preventDefault(); onToggleTile && onToggleTile(); return;
      }
      // Meta+Space → toggle tiling
      if (meta && key === ' ') {
        e.preventDefault(); onToggleTile && onToggleTile(); return;
      }
      // Alt+Tab → cycle forward
      if (alt && !ctrl && key === 'Tab' && !shift) {
        e.preventDefault(); onCycleNext && onCycleNext(); return;
      }
      // Alt+Shift+Tab → cycle backward
      if (alt && shift && key === 'Tab') {
        e.preventDefault(); onCyclePrev && onCyclePrev(); return;
      }
      // Ctrl+Alt+arrows → move window (float mode)
      if (ctrl && alt) {
        if (key === 'ArrowLeft')  { e.preventDefault(); onMoveWindow && onMoveWindow('left'); return; }
        if (key === 'ArrowRight') { e.preventDefault(); onMoveWindow && onMoveWindow('right'); return; }
        if (key === 'ArrowUp')    { e.preventDefault(); onMoveWindow && onMoveWindow('up'); return; }
        if (key === 'ArrowDown')  { e.preventDefault(); onMoveWindow && onMoveWindow('down'); return; }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onNewTerm, onLauncher, onClose, onMinimize, onCycleNext, onCyclePrev, onToggleTile, onMoveWindow, onCheatsheet]);
}

// ── Keyboard cheatsheet overlay ───────────────────────────────────────────────
function KeyboardCheatsheet({ onClose }) {
  // Matches Gene's hyprland UserKeybinds.conf — browser-safe versions
  const BINDINGS = [
    { keys: 'Alt + Space',          action: 'App launcher  (rofi — your actual bind)' },
    { keys: 'Ctrl+Alt + T',         action: 'New terminal  (Super+Return equivalent)' },
    { keys: 'Ctrl+Alt + H',         action: 'This keybind cheatsheet  (Super+H)' },
    { keys: 'Ctrl+Alt + W',         action: 'Close active window  (Super+Q)' },
    { keys: 'Ctrl+Alt + M',         action: 'Minimize active window' },
    { keys: 'Ctrl+Alt + Space',     action: 'Toggle float ↔ dwindle tiling  (Super+Space)' },
    { keys: 'Alt + Tab',            action: 'Cycle windows forward' },
    { keys: 'Alt + Shift + Tab',    action: 'Cycle windows backward' },
    { keys: 'Ctrl+Alt + ← → ↑ ↓',  action: 'Move window  (float mode)' },
    { keys: 'Escape',               action: 'Close overlay / launcher' },
  ];

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
      zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'rgba(10,10,15,0.95)', border: '1px solid rgba(0,255,0,0.4)',
        borderRadius: 'var(--radius-xl)', padding: 28, minWidth: 420, maxWidth: '90vw',
        boxShadow: 'var(--shadow-window)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ color: 'var(--neon-cyan)', fontSize: '1rem', letterSpacing: 3, textShadow: 'var(--bloom-cyan)', marginBottom: 16, borderBottom: '2px solid var(--neon-purple)', paddingBottom: 8 }}>
          [KEYBOARD_BINDINGS]
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BINDINGS.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--neon-green)',
                textShadow: 'var(--glow-green-sm)', minWidth: 200, flexShrink: 0,
                background: 'rgba(0,255,0,0.07)', padding: '2px 8px', borderRadius: 3,
                border: '1px solid rgba(0,255,0,0.2)',
              }}>{b.keys}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{b.action}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
          Press [ESC] or click outside to dismiss
        </div>
      </div>
    </div>
  );
}

window.WMWindow = WMWindow;
window.dwindleLayout = dwindleLayout;
window.useKeyboardWM = useKeyboardWM;
window.KeyboardCheatsheet = KeyboardCheatsheet;

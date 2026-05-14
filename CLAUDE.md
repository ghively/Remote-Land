# NAS Terminal — CLAUDE.md

AI agent rulebook. Read this before touching any file in this repo.

---

## What this project is

**NAS Terminal** is a cyber-noir Linux server management UI — a tiling window manager interface for managing a remote Linux server (Ubuntu, Fedora, and other systemd distros). Aesthetic: CRT phosphor green, deep violet accent, cyan boot text. The vibe is a 1980s terminal crossed with a Hyprland rice.

**Stack:** Local React 18. JSX is precompiled offline by `frontend/build.js`
(a one-shot Node script that runs the vendored `babel.min.js` via Node's
`vm` module — no npm install required). The browser loads only the
precompiled `frontend/dist/*.js` bundles; Babel is never parsed at runtime.
Open `frontend/NAS Terminal.html` in any browser to run.

---

## How to run

```
# Local dev — open the HTML, no server needed. dist/ is committed.
frontend/NAS Terminal.html   ← double-click or drag into Chrome/Firefox/Edge

# After editing any .jsx file, rebuild the dist bundle:
node frontend/build.js       ← one-shot, no install

# Remote access — backend serves the frontend at http://host:port
cd backend && npm install --production
cp config.example.json config.json   # set apiKey, media URLs, AI config
node ../frontend/build.js            # only needed if .jsx changed
node server.js                       # visit http://your-server:3001
```

---

## Project structure

```
frontend/          ← browser UI (CDN React + Babel prototype)
backend/           ← Linux server agent (Sub-project 2, not yet built)
docs/
  superpowers/
    specs/         ← approved design specs
    plans/         ← implementation plans
CLAUDE.md          ← this file
```

---

## Design system — tokens are law

All colors, fonts, spacing, and motion values come from `frontend/colors_and_type.css`. **Never hardcode a hex value or pixel size.** Use the CSS custom properties.

| Role | Token | Value |
|------|-------|-------|
| Primary phosphor / green | `--neon-green` | #00ff00 |
| Accent / violet | `--neon-purple` | #8000ff |
| Boot text / titles | `--neon-cyan` | #00f3ff |
| Body background | `--bg-dark` | #050505 |
| Body text | `--text-primary` | #ccffcc |
| Dim text | `--text-dim` | rgba(0,255,0,0.6) |
| Glass panel fill | `--bg-glass` | rgba(10,10,15,0.75) |
| Body font | `--font-mono` | 'Courier New', monospace |
| Display / title font | `--font-display` | 'VT323', 'Share Tech Mono', monospace |
| System UI font | `--font-system` | 'JetBrains Mono', monospace |

**CRT effects** (scanline overlay + flicker animation) are defined in `frontend/wm-styles.css` and the inline `<style>` in `frontend/Developer Guide.html`. Preserve them in all changes.

**Rainbow border animation** is now driven by pure CSS via the `@property
--gradient-angle` animation on `:root` in `wm-styles.css`. Every `.wm-ring`
and `.rofi-ring` reads `var(--gradient-angle)` directly — no JS rAF loop.
A tiny shim in `NAS Terminal.html` exposes `window.__rainbowSetSpeed(secs)`
so SettingsPanel can still adjust the rotation speed at runtime.

---

## Component map

| File | Responsibility |
|------|---------------|
| `NASTerminal.jsx` | App root, login screen, boot sequence, status bar, window orchestration |
| `WindowManager.jsx` | Dwindle tiling layout (rects keyed by window id), drag/resize, keyboard shortcuts |
| `TerminalPane.jsx` | Terminal emulator pane (capped buffer, memoized lines) |
| `SystemPanels.jsx` | FileManager / SystemMonitor / LogViewer / DockerManager / ServiceManager / NetworkMap / CronEditor — all wired to backend endpoints |
| `MediaAPIPanels.jsx` | Emby, Radarr, Sonarr, SABnzbd panels (compact) |
| `MediaPanelsFull.jsx` | Full-size media panels |
| `BrowserPanel.jsx` | Embedded browser panel |
| `SettingsPanel.jsx` | Settings UI with custom-theme support |
| `AppLauncher.jsx` | Rofi-style app launcher overlay |
| `BackendContext.jsx` | Backend connection state + heartbeat + `usePoller` / `usePageVisible` shared hooks |

**State management:** All shared state lives in `NASTerminal.jsx` and flows down as props. No external state library.

---

## Coding rules

1. **Build step is one Node script** — `frontend/build.js`. It uses the
   vendored `babel.min.js` via Node's `vm` module, so no npm install is
   needed. Rerun it after editing any `.jsx`. The dist/ directory is
   committed so users can open the HTML with no build step on their end.
2. **No npm in the frontend runtime.** Use local `<script>` tags or
   precompile a CDN script for any new dependency.
3. **New components** go in `frontend/` as `.jsx` files. Add a
   `<script src="dist/YourComponent.js"></script>` tag to
   `frontend/NAS Terminal.html`. Order matters — load dependencies
   before consumers.
4. **Never hardcode colors or pixel sizes.** Use tokens from
   `colors_and_type.css`. Status colors live as `--color-success`,
   `--color-warn`, `--color-error`.
5. **Rainbow border** is now CSS-only. Don't reintroduce a JS rAF loop.
6. **Gate every periodic effect** on visibility — use the shared
   `usePoller(fn, ms, enabled)` hook from `BackendContext.jsx` rather
   than raw `setInterval`. It pauses on hidden tabs by default.
7. **Do not migrate** to Vite, webpack, or TypeScript without an
   explicit user request.

---

## Backend / AI architecture (planned)

- `backend/` will contain a lightweight Linux service (Node.js or Python — decided in Sub-project 2 spec) exposing REST + WebSocket endpoints for: system stats, Docker, media APIs, and a real terminal session.
- **AI features** (chat panel, command suggestions, log analyzer, NL→shell) call the Claude API via the backend proxy. The API key never lives in the browser.
- See `docs/superpowers/specs/` for sub-project specs as they are written.

---

## Sub-project roadmap

| # | Sub-project | Status |
|---|-------------|--------|
| 1 | Project Foundation | ✅ Complete |
| 2 | Backend Server Agent | ✅ Complete |
| 3 | Frontend / Backend Wiring | ✅ Complete |
| 4 | AI Features | ✅ Complete |

# NAS Terminal — CLAUDE.md

AI agent rulebook. Read this before touching any file in this repo.

---

## What this project is

**NAS Terminal** is a cyber-noir Linux server management UI — a tiling window manager interface for managing a remote Linux server (Ubuntu, Fedora, and other systemd distros). Aesthetic: CRT phosphor green, deep violet accent, cyan boot text. The vibe is a 1980s terminal crossed with a Hyprland rice.

**Stack:** CDN React 18 + Babel standalone. No build step. No npm. Open `frontend/NAS Terminal.html` in any browser to run it.

---

## How to run

```
# Just open the file — no server, no install, no build
frontend/NAS Terminal.html   ← double-click or drag into Chrome/Firefox/Edge
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

**Rainbow border animation** is driven by the inline `<script>` at the bottom of `frontend/NAS Terminal.html`. Do not move it into React — it uses `requestAnimationFrame` outside the React lifecycle intentionally.

---

## Component map

| File | Responsibility |
|------|---------------|
| `NASTerminal.jsx` | App root, login screen, boot sequence, status bar, window orchestration |
| `WindowManager.jsx` | Dwindle tiling layout, drag, resize, keyboard shortcuts |
| `TerminalPane.jsx` | Terminal emulator pane |
| `SystemPanels.jsx` | CPU / RAM / disk / network stats panels |
| `MediaAPIPanels.jsx` | Emby, Radarr, Sonarr panels (compact) |
| `MediaPanelsFull.jsx` | Full-size media panels |
| `BrowserPanel.jsx` | Embedded browser panel |
| `SettingsPanel.jsx` | Settings UI |
| `AppLauncher.jsx` | Rofi-style app launcher overlay |

**State management:** All shared state lives in `NASTerminal.jsx` and flows down as props. No external state library.

---

## Coding rules

1. **No build tools.** All JSX is interpreted by Babel standalone at runtime.
2. **No npm.** Use CDN `<script>` tags for any new dependency.
3. **New components** go in `frontend/` as `.jsx` files. Add a `<script type="text/babel" src="YourComponent.jsx"></script>` tag to `frontend/NAS Terminal.html`. Order matters — load dependencies before consumers.
4. **Never hardcode colors.** Use tokens from `colors_and_type.css`.
5. **Never move the rainbow border script** out of the inline `<script>` at the bottom of `NAS Terminal.html`.
6. **Do not migrate** to Vite, webpack, or TypeScript without an explicit user request.
7. **Do not add** npm, package.json, or node_modules without an explicit user request.

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
| 4 | AI Features | Planned |

# NAS Terminal

Cyber-noir Linux server management UI. A tiling window manager interface for managing a remote Linux server — CRT phosphor green, deep violet accents, Hyprland-style dwindle layout, animated rainbow window borders.

## Quick Start

**Local dev** — open the HTML in a browser. JSX is precompiled into `frontend/dist/*.js` and committed to the repo, so there is no install step:
```
frontend/NAS Terminal.html
```
Leave the API_KEY field blank to enter **demo mode** (mock data, no backend).

**After editing any `.jsx` file**, rerun the one-shot precompiler:
```bash
node frontend/build.js     # uses the vendored babel.min.js via Node's vm
                           # — no npm install required.
```

**Remote access** — run the backend and open `http://your-server:3001`:
```bash
cd backend
npm install --production
cp config.example.json config.json
# Edit config.json — set apiKey, media/AI provider, etc.
node ../frontend/build.js   # only needed if you edited .jsx
node server.js
```
Then visit `http://your-server:3001` in any browser. The frontend is served automatically.

For a persistent deployment (systemd unit, deploy script, reverse proxy), see [backend/README.md](backend/README.md).

## What works

| Panel | Backed by |
|------|-----------|
| Terminal (xterm.js) | `WS /terminal` → `node-pty` shell |
| System Monitor | `GET /api/system/{stats,processes}` (real `/proc`) |
| Docker Manager | `GET /api/docker/containers` + `POST /api/docker/:id/{start,stop,restart}` + per-container CPU/mem/ports stats |
| File Manager | `GET/PUT/DELETE /api/files/*` — list, mkdir, rename, delete, read, edit, upload, download |
| Service Manager | `GET /api/services` + `POST /api/services/:name/{start,stop,restart,reload,enable,disable}` + journalctl log viewer |
| Network Map | `GET /api/network` — interfaces, ARP cache, active sockets |
| Cron Editor | `GET / PUT /api/cron` — round-trips the user crontab |
| Media (Emby / Radarr / Sonarr / SAB) | `GET /api/media/*` with last-good cache |
| AI Chat | `POST /api/ai/chat` (SSE streaming, tool calling) |
| Log Analyzer | `POST /api/ai/analyze-logs` (SSE streaming) |
| Shell suggester | `POST /api/ai/shell` (structured output) |

## AI providers

Two backend providers, switchable in `backend/config.json` or directly from the **Backend Config** panel inside the app:

| Provider   | `baseUrl`                          | Default models                                       |
|-----------|------------------------------------|------------------------------------------------------|
| `anthropic` (default) | `https://api.anthropic.com`              | `claude-sonnet-4-6` / `claude-haiku-4-5-20251001` / `claude-opus-4-7` |
| `openai`   | `https://api.openai.com/v1`              | `gpt-4o` for all three tasks                         |

The provider auto-detects from `baseUrl` when omitted. Tool calling and streaming work natively on both. The API key never lives in the browser — it's stored in `backend/config.json` and the read-API redacts it.

## Project structure

```
frontend/
  *.jsx              source JSX (edit these)
  dist/*.js          precompiled output (loaded by NAS Terminal.html)
  build.js           one-shot precompiler — no npm install needed
  wm-styles.css      window manager, panels, animations
  colors_and_type.css   design tokens (the only source of truth)
backend/
  server.js          Express app + route table
  ai.js              AI proxy — anthropic + openai providers
  files.js / services.js / network.js / cron.js / docker.js / system.js / media.js
  configstore.js     atomic config.json read/write with redaction
  terminal.js        WebSocket → node-pty
  __tests__/         Jest suites (run with `npm test`)
docs/superpowers/    design specs and implementation plans
CLAUDE.md            AI agent rulebook — read first
```

## Performance notes

- **No runtime Babel.** JSX is precompiled by `frontend/build.js`; the browser parses ~370 KB of plain JS instead of the 2.9 MB Babel runtime.
- **CSS-driven rainbow border** via `@property --gradient-angle` — no JS rAF loop.
- **All polling is visibility-gated** through the shared `usePoller(fn, ms, enabled)` hook in `BackendContext.jsx`. Background tabs stop hitting the backend.
- **Hardened iframe sandbox** in BrowserPanel: `allow-same-origin` is opt-in per origin, so embedded sites can't read this app's `localStorage`.
- **PTY teardown grace + SIGKILL fallback** to prevent zombie shells across rapid reconnect cycles.

## Tests

```bash
cd backend
npm test     # Jest — 11 suites, 138 tests last green
```

## Design system

All colors, fonts, spacing, and motion values come from `frontend/colors_and_type.css`. Status colors live as `--color-success`, `--color-warn`, `--color-error`. CLAUDE.md spells out the rules — never hardcode a hex value or pixel size.

## For AI agents

Read `CLAUDE.md` first. It covers the build step, the CSS-driven rainbow, the shared `usePoller` hook, the design tokens, and all coding constraints.

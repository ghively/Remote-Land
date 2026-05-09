# NAS Terminal

Cyber-noir Linux server management UI. A tiling window manager interface for managing a remote Linux server — CRT phosphor green, deep violet accents, Hyprland-style dwindle layout.

## Quick Start

**Local dev** — just open the file in a browser, no server needed:
```
frontend/NAS Terminal.html
```
Leave the API_KEY field blank for **demo mode** (mock data, no backend).

**Remote access** — run the backend and open `http://your-server:3001`:
```bash
cd backend
npm install --production
cp config.example.json config.json
# Edit config.json — set apiKey and any media/AI endpoints
node server.js
```
Then visit `http://your-server:3001` in any browser. The frontend is served automatically.

For a persistent deployment (systemd, reverse proxy), see [backend/README.md](backend/README.md).

## Project structure

```
frontend/     Browser UI — CDN React 18 + Babel prototype
backend/      Linux server agent — Express + ws + node-pty
docs/         Design specs and implementation plans
CLAUDE.md     AI agent rulebook — read this before editing code
```

## Design system

All tokens (colors, fonts, spacing, motion) are in `frontend/colors_and_type.css`. See `CLAUDE.md` for the full rules.

## Roadmap

| # | Sub-project | Status |
|---|-------------|--------|
| 1 | Project Foundation | ✅ Complete |
| 2 | Backend Server Agent — system stats, terminal WebSocket, Docker, media APIs | ✅ Complete |
| 3 | Frontend / Backend Wiring — replace mock data with live endpoints | ✅ Complete |
| 4 | AI Features — chat panel, command suggestions, log analyzer, NL→shell | ✅ Complete |

## For AI agents

Read `CLAUDE.md` first. It covers the full design system, component map, and all coding constraints.

# NAS Terminal

Cyber-noir Linux server management UI. A tiling window manager interface for managing a remote Linux server — CRT phosphor green, deep violet accents, Hyprland-style dwindle layout.

## Running the UI

No install. No build. Just open the file:

```
frontend/NAS Terminal.html
```

Double-click it or drag it into Chrome, Firefox, or Edge. The boot sequence plays, then you hit the login screen. Leave the API_KEY field blank for **demo mode** (mock data, no backend); fill it in to connect to a running backend agent.

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

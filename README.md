# NAS Terminal

Cyber-noir Linux server management UI. A tiling window manager interface for managing a remote Linux server — CRT phosphor green, deep violet accents, Hyprland-style dwindle layout.

## Running the UI

No install. No build. Just open the file:

```
frontend/NAS Terminal.html
```

Double-click it or drag it into Chrome, Firefox, or Edge. The boot sequence plays, then you hit the login screen (default creds: `root` / `root`).

## Project structure

```
frontend/     Browser UI — CDN React 18 + Babel prototype
backend/      Linux server agent (Sub-project 2, not yet built)
docs/         Design specs and implementation plans
CLAUDE.md     AI agent rulebook — read this before editing code
```

## Design system

All tokens (colors, fonts, spacing, motion) are in `frontend/colors_and_type.css`. See `CLAUDE.md` for the full rules.

## Roadmap

| # | Sub-project | Status |
|---|-------------|--------|
| 1 | Project Foundation | ✅ Complete |
| 2 | Backend Server Agent — system stats, terminal WebSocket, Docker, media APIs | Planned |
| 3 | Frontend / Backend Wiring — replace mock data with live endpoints | Planned |
| 4 | AI Features — chat panel, command suggestions, log analyzer, NL→shell | Planned |

## For AI agents

Read `CLAUDE.md` first. It covers the full design system, component map, and all coding constraints.

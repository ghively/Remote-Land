# NAS Terminal

Cyber-noir Linux server management UI. A tiling window manager interface for managing a remote Linux server — CRT phosphor green, deep violet accents, Hyprland-style dwindle layout.

## Running the UI

Two modes, pick whichever fits.

**Local / demo (no install).** Open `frontend/NAS Terminal.html` directly in
Chrome, Firefox, or Edge — double-click or drag it into a tab. Leave the
`API_KEY` field blank to enter **demo mode** (mock data, no backend
required).

**Single-host deploy.** Install the backend (see `backend/README.md` →
*Install (single-host deploy)*) and the same Express server hosts both the
API and the UI on port 3001. Browse to `http://<host>:3001/` and log in with
the API key from `backend/config.json`. **You do not need a separate web
server** — if a previous deployment looked like a "static HTML site", that's
because the backend wasn't serving the frontend; this is now built in.

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

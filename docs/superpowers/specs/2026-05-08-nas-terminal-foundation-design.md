# NAS Terminal — Sub-project 1: Project Foundation

**Date:** 2026-05-08
**Status:** Approved
**Author:** Gene Hively

---

## Overview

Set up the NAS Terminal repository for long-term AI-assisted development. The prototype (CDN React 18 + Babel, cyber-noir Linux server management UI) is complete and working. This sub-project establishes the project structure, documentation, and AI agent context that all future sub-projects depend on.

No build tooling changes. No code migration. The prototype continues to open directly in a browser.

---

## Project Decomposition

This is Sub-project 1 of 4. The full roadmap:

| # | Sub-project | Depends on |
|---|-------------|------------|
| 1 | **Project Foundation** ← this spec | — |
| 2 | Backend Server Agent | 1 |
| 3 | Frontend/Backend Wiring | 2 |
| 4 | AI Features (chat, suggestions, log analyzer, NL→shell) | 3 |

---

## Approach

Option B (Organized Foundation): rename `project/` → `frontend/`, add stub `backend/` directory, create `docs/superpowers/specs/`, write `CLAUDE.md`, write `.gitignore`, update `README.md`. No files inside `frontend/` change.

---

## Directory Structure

```
C:\Git\UI\
├── .claude/
├── .git/
├── CLAUDE.md                        ← AI agent rulebook (new)
├── .gitignore                       ← (new)
├── README.md                        ← updated project overview
├── frontend/                        ← renamed from project/
│   ├── assets/
│   ├── kitty/
│   ├── AppLauncher.jsx
│   ├── BrowserPanel.jsx
│   ├── colors_and_type.css          ← design token source of truth
│   ├── Developer Guide.html
│   ├── MediaAPIPanels.jsx
│   ├── MediaPanelsFull.jsx
│   ├── NAS Terminal.html            ← entry point (open in browser)
│   ├── NASTerminal.jsx              ← app root
│   ├── SettingsPanel.jsx
│   ├── SystemPanels.jsx
│   ├── TerminalPane.jsx
│   ├── WindowManager.jsx
│   └── wm-styles.css
├── backend/                         ← stub for Sub-project 2
│   └── README.md
└── docs/
    └── superpowers/
        └── specs/                   ← design specs
            └── 2026-05-08-nas-terminal-foundation-design.md
```

---

## CLAUDE.md Contents

### Project Identity
NAS Terminal is a cyber-noir Linux server management UI. Stack: CDN React 18 + Babel standalone. No build step — open `frontend/NAS Terminal.html` in any browser to run.

### Design System Rules
Token names from `frontend/colors_and_type.css` are law. Never hardcode hex values.

| Role | Token |
|------|-------|
| Primary phosphor / green | `--neon-green` (#00ff00) |
| Accent / violet | `--neon-purple` (#8000ff) |
| Boot text / titles | `--neon-cyan` (#00f3ff) |
| Body background | `--bg-dark` (#050505) |
| Body text | `--text-primary` (#ccffcc) |
| Dim text | `--text-dim` |
| Body font | `--font-mono` |
| Display/title font | `--font-display` |

CRT scanline overlay and flicker animation are defined in `wm-styles.css` and must be preserved in all changes.

### Component Map

| File | Responsibility |
|------|---------------|
| `NASTerminal.jsx` | App root, login screen, boot sequence, status bar, window orchestration |
| `WindowManager.jsx` | Dwindle tiling layout, drag, resize, keyboard shortcuts |
| `TerminalPane.jsx` | Terminal emulator pane |
| `SystemPanels.jsx` | CPU / RAM / disk / network stats panels |
| `MediaAPIPanels.jsx` | Emby, Radarr, Sonarr API panels (compact) |
| `MediaPanelsFull.jsx` | Full-size media panels |
| `BrowserPanel.jsx` | Embedded browser panel |
| `SettingsPanel.jsx` | Settings UI |
| `AppLauncher.jsx` | Rofi-style app launcher overlay |

All shared state lives in `NASTerminal.jsx` and flows down as props. No external state library.

### Coding Rules
- No build tools. All code is plain JSX interpreted by Babel standalone at runtime.
- No npm packages. Use CDN links only for new dependencies.
- New components go in `frontend/` as `.jsx` files with a `<script type="text/babel">` tag added to `NAS Terminal.html`. Order matters: dependencies first.
- The rainbow border animation is driven by the inline `<script>` at the bottom of `NAS Terminal.html`. Do not move it into React.
- Do not hardcode colors. Use CSS custom properties from `colors_and_type.css`.
- Do not migrate to Vite, webpack, or TypeScript without an explicit user request.

### Backend / AI Architecture (future)
- `backend/` will contain a lightweight Linux service (Sub-project 2) exposing REST + WebSocket endpoints for system stats, terminal, Docker, and media APIs.
- AI features (Sub-project 4) will call the Claude API via the backend proxy — never directly from the browser (no API key exposure).

---

## .gitignore

```
.superpowers/
*.DS_Store
Thumbs.db
```

---

## README.md (updated)

Contents:
- What NAS Terminal is
- How to run: open `frontend/NAS Terminal.html` in any browser — no server, no install
- Project structure overview (frontend / backend / docs)
- Sub-project roadmap
- Pointer to `CLAUDE.md` for AI agent context and `frontend/colors_and_type.css` for the design system

---

## Success Criteria

- [ ] `project/` renamed to `frontend/` with all contents intact
- [ ] `backend/README.md` stub exists
- [ ] `docs/superpowers/specs/` exists with this spec committed
- [ ] `CLAUDE.md` at repo root covers: identity, design tokens, component map, coding rules, backend/AI architecture plan
- [ ] `.gitignore` excludes `.superpowers/`, `*.DS_Store`, `Thumbs.db`
- [ ] `README.md` updated with project overview and run instructions
- [ ] Opening `frontend/NAS Terminal.html` in a browser still works identically to before
- [ ] All changes committed to `master`

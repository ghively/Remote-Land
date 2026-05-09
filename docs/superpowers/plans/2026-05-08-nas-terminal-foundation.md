# NAS Terminal Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the NAS Terminal repo with a clean directory structure, a thorough CLAUDE.md, .gitignore, and updated README so every future AI session has full project context from the start.

**Architecture:** No code changes — this is pure file organization and documentation. `project/` is renamed to `frontend/` (contents unchanged), a `backend/` stub signals where Sub-project 2 lives, and `CLAUDE.md` at the repo root documents the design system, component map, and coding rules.

**Tech Stack:** Git (bash/PowerShell), plain text/Markdown. No build tools, no npm.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Rename | `project/` → `frontend/` | Signals this is the browser UI layer |
| Create | `backend/README.md` | Stub that reserves space for Sub-project 2 |
| Create | `CLAUDE.md` | AI agent rulebook — read every session |
| Create | `.gitignore` | Excludes brainstorm session files and OS noise |
| Modify | `README.md` | Replaces handoff instructions with real project docs |

---

### Task 1: Rename project/ to frontend/

**Files:**
- Rename: `project/` → `frontend/` (all contents move, nothing inside changes)

- [ ] **Step 1: Rename the directory**

  On Windows PowerShell:
  ```powershell
  Rename-Item -Path "C:\Git\UI\project" -NewName "frontend"
  ```

  On Linux/macOS:
  ```bash
  mv project frontend
  ```

- [ ] **Step 2: Verify the prototype still works**

  Open `frontend/NAS Terminal.html` in a browser (double-click or drag into Chrome/Firefox/Edge).

  Expected: The NAS Terminal boot sequence plays, login screen appears, all panels load. No console errors about missing files.

- [ ] **Step 3: Commit**

  ```bash
  git add -A
  git commit --no-gpg-sign -m "refactor: rename project/ to frontend/

  Signals two-layer architecture (frontend + backend).
  No files inside the directory changed.

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 2: Create backend/ stub

**Files:**
- Create: `backend/README.md`

- [ ] **Step 1: Create the backend directory and README**

  ```bash
  mkdir backend
  ```

  Create `backend/README.md` with this content:

  ```markdown
  # Backend — NAS Terminal Server Agent

  **Status:** Planned (Sub-project 2)

  This directory will contain a lightweight Linux service that exposes:

  - REST endpoints: system stats (CPU, RAM, disk, network), Docker management, media API proxy (Emby, Radarr, Sonarr)
  - WebSocket endpoint: real terminal session (node-pty or similar)

  ## Target platforms
  Ubuntu, Fedora, and other systemd-based Linux distros.

  ## Design spec
  See `docs/superpowers/specs/` for the Sub-project 2 spec (written after Sub-project 1 is complete).
  ```

- [ ] **Step 2: Verify**

  ```bash
  cat backend/README.md
  ```

  Expected: Contents print cleanly with no encoding issues.

- [ ] **Step 3: Commit**

  ```bash
  git add backend/README.md
  git commit --no-gpg-sign -m "chore: add backend/ stub for Sub-project 2

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 3: Create .gitignore

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create .gitignore**

  Create `.gitignore` at the repo root with this exact content:

  ```
  # Brainstorming session files (visual companion server)
  .superpowers/

  # OS noise
  .DS_Store
  Thumbs.db
  desktop.ini
  ```

- [ ] **Step 2: Verify .superpowers/ is now ignored**

  ```bash
  git check-ignore -v .superpowers/
  ```

  Expected output: `.gitignore:2:.superpowers/	.superpowers/`

- [ ] **Step 3: Commit**

  ```bash
  git add .gitignore
  git commit --no-gpg-sign -m "chore: add .gitignore

  Excludes brainstorm session files and OS noise.

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 4: Write CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Create CLAUDE.md at the repo root**

  Create `CLAUDE.md` with this exact content:

  ```markdown
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
  | 2 | Backend Server Agent | Planned |
  | 3 | Frontend / Backend Wiring | Planned |
  | 4 | AI Features | Planned |
  ```

- [ ] **Step 2: Verify CLAUDE.md renders cleanly**

  ```bash
  # Check file exists and has content
  wc -l CLAUDE.md
  ```

  Expected: line count > 80.

- [ ] **Step 3: Commit**

  ```bash
  git add CLAUDE.md
  git commit --no-gpg-sign -m "docs: add CLAUDE.md AI agent rulebook

  Covers project identity, design tokens, component map,
  coding rules, and backend/AI architecture plan.

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 5: Update README.md

**Files:**
- Modify: `README.md` (replace handoff content entirely)

- [ ] **Step 1: Replace README.md content**

  Overwrite `README.md` with:

  ```markdown
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
  ```

- [ ] **Step 2: Verify**

  ```bash
  head -5 README.md
  ```

  Expected first line: `# NAS Terminal`

- [ ] **Step 3: Commit**

  ```bash
  git add README.md
  git commit --no-gpg-sign -m "docs: rewrite README with project overview and run instructions

  Replaces the Claude Design handoff instructions with a real
  project README covering structure, how to run, and roadmap.

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 6: Final verification

**Files:** None created — read-only checks.

- [ ] **Step 1: Verify full directory structure**

  ```bash
  find . -not -path './.git/*' -not -path './.superpowers/*' -not -path './.claude/*' | sort
  ```

  Expected output includes:
  ```
  ./CLAUDE.md
  ./.gitignore
  ./README.md
  ./backend/README.md
  ./docs/superpowers/plans/2026-05-08-nas-terminal-foundation.md
  ./docs/superpowers/specs/2026-05-08-nas-terminal-foundation-design.md
  ./frontend/NAS Terminal.html
  ./frontend/NASTerminal.jsx
  ./frontend/WindowManager.jsx
  ./frontend/colors_and_type.css
  ... (remaining frontend/ files)
  ```

  Expected absent: anything under `project/` (it's been renamed).

- [ ] **Step 2: Confirm prototype loads**

  Open `frontend/NAS Terminal.html` in a browser.

  Expected: Boot sequence → login screen → panels all load. No 404 errors in browser console for any `.jsx` or `.css` file.

- [ ] **Step 3: Check git log**

  ```bash
  git log --oneline -6
  ```

  Expected: 5 new commits on top of the initial commit, one per task above.

- [ ] **Step 4: Update Sub-project 1 status in CLAUDE.md**

  This step is already done — CLAUDE.md was written with `✅ Complete` for Sub-project 1.

---

## Self-Review Notes

- **Spec coverage:** All 7 success criteria from the spec map to tasks: `project/`→`frontend/` (Task 1), `backend/README.md` (Task 2), `.gitignore` (Task 3), `CLAUDE.md` (Task 4), `README.md` (Task 5), prototype loads (Task 6), commits throughout.
- **No placeholders:** All steps contain exact commands or exact file content.
- **Type consistency:** N/A — no code, no types.
- **No TDD:** This plan has no application code, so there are no unit tests. Verification is manual browser check (Task 1 Step 2, Task 6 Step 2) — appropriate for a static HTML prototype with no test harness.

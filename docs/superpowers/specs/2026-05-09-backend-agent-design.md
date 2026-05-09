# NAS Terminal — Sub-project 2: Backend Server Agent

**Date:** 2026-05-09
**Status:** Approved
**Author:** Gene Hively

---

## Overview

Build a lightweight Node.js backend agent that runs as a systemd service on the Linux server and exposes REST + WebSocket endpoints to the NAS Terminal browser UI. The agent is the data layer for all live information: system stats, Docker containers, media service status, and an interactive terminal session.

---

## Project Decomposition

| # | Sub-project | Status |
|---|-------------|--------|
| 1 | Project Foundation | ✅ Complete |
| 2 | **Backend Server Agent** ← this spec | In Progress |
| 3 | Frontend / Backend Wiring | Planned |
| 4 | AI Features | Planned |

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| Runtime | Node.js |
| HTTP framework | Express |
| WebSocket | `ws` library |
| PTY terminal | `node-pty` |
| Docker | `dockerode` |
| Media API proxy | `axios` |
| Deployment | systemd service |
| Target platforms | Ubuntu, Fedora, other systemd-based Linux distros |

---

## Architecture

Single Node.js process, systemd-managed. One Express app mounts all REST routes. One `ws` WebSocket server handles terminal sessions. Five focused modules — each owns one concern.

```
Browser (CDN React)
  │
  ├── REST fetch ──── X-API-Key header ──▶  Express (server.js :3001)
  │                                              ├── system.js  → /proc, df
  │                                              ├── docker.js  → /var/run/docker.sock
  │                                              ├── media.js   → Emby/Radarr/Sonarr HTTP
  │                                              └── terminal.js (ws upgrade)
  │
  └── WebSocket ──── ?token=<apiKey> ──▶  terminal.js → node-pty → bash
```

**Security boundary:** API key validated on every request before any data is returned or PTY spawned. Key lives only in `backend/config.json` on the server — never in the browser.

---

## File Structure

```
backend/
├── server.js             ← Express app, auth middleware, route mounting, WS upgrade
├── system.js             ← system stats (CPU, RAM, disk, network)
├── docker.js             ← Docker socket wrapper (list, start, stop, logs)
├── media.js              ← Emby / Radarr / Sonarr proxy functions
├── terminal.js           ← node-pty spawn + WebSocket session management
├── config.json           ← API key, ports, media URLs (gitignored — never committed)
├── config.example.json   ← template with placeholder values (committed)
├── package.json          ← dependencies
├── nas-terminal.service  ← systemd unit file
└── README.md             ← updated with install instructions
```

---

## REST API Endpoints

All routes prefixed `/api/`. All require `X-API-Key` header except `/api/health`.

### Health
```
GET /api/health
```
Returns `{ status: "ok" }`. No auth. Used by frontend to check connectivity before login.

### System Stats
```
GET /api/system/stats
```
Returns:
```json
{
  "cpu": { "percent": 38.2 },
  "ram": { "used": 6442450944, "total": 17179869184 },
  "disk": { "used": 214748364800, "total": 1099511627776 },
  "network": { "rxBytesPerSec": 12400, "txBytesPerSec": 3100 }
}
```
Reads: `/proc/stat` (CPU), `/proc/meminfo` (RAM), `df -B1` (disk), `/proc/net/dev` (network, delta over 1s).

```
GET /api/system/processes
```
Returns top 20 processes by CPU usage. Reads `/proc/[pid]/stat` and `/proc/[pid]/cmdline`.

### Docker
```
GET  /api/docker/containers         ← list all (name, image, status, uptime, id)
POST /api/docker/:id/start          ← start a stopped container
POST /api/docker/:id/stop           ← stop a running container
GET  /api/docker/:id/logs           ← last 100 lines (chunked response)
```
Uses `dockerode` connecting to `/var/run/docker.sock`.

### Media Proxy
```
GET /api/media/emby      ← active sessions, library counts, recent items
GET /api/media/radarr    ← queue length, upcoming releases, health status
GET /api/media/sonarr    ← queue length, upcoming episodes, health status
```
Proxies to local service URLs configured in `config.json`. Adds each service's own API key from config. Does not expose raw upstream responses — normalises to a consistent shape.

### WebSocket Terminal
```
WS /terminal?token=<apiKey>
```

**Protocol:**

Client → Server (JSON):
```json
{ "type": "input",  "data": "ls -la\n" }
{ "type": "resize", "cols": 120, "rows": 40 }
```

Server → Client (binary frames): raw PTY output bytes.

**Session lifecycle:**
1. Client connects with `?token=` query param
2. Server validates token — closes connection with code `4401` on failure
3. Server spawns `bash` (or configured shell) PTY at default size 80×24
4. Bidirectional streaming until client disconnects or PTY exits
5. PTY exit → server closes WebSocket with code `1000`

---

## Config

**`config.example.json`** (committed):
```json
{
  "apiKey": "change-me-to-a-long-random-string",
  "port": 3001,
  "shell": "/bin/bash",
  "media": {
    "emby":   { "url": "http://localhost:8096", "apiKey": "" },
    "radarr": { "url": "http://localhost:7878", "apiKey": "" },
    "sonarr": { "url": "http://localhost:8989", "apiKey": "" }
  }
}
```

**`config.json`** — copy of above with real values. Added to `.gitignore`. Never committed.

---

## Auth Middleware

Applied to all routes except `GET /api/health`:

```js
if (req.headers['x-api-key'] !== config.apiKey) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

WebSocket terminal validates `req.query.token` the same way — closes connection immediately on mismatch.

**CORS:** Allows `null` origin (file://) and `http://localhost:*`. No wildcard.

---

## Error Handling

| Failure | Behaviour |
|---------|-----------|
| `/proc` read fails | Return `{ error: "unavailable" }` for that metric only — don't crash |
| Docker socket missing at startup | Log warning, return `503` on all Docker routes |
| Media service unreachable | Return `{ status: "offline" }` for that service — don't crash |
| PTY spawn fails | Close WebSocket with code `1011` + error message |
| Unhandled promise rejection | Log to stderr (captured by journald) — process stays alive |

---

## systemd Deployment

**`nas-terminal.service`:**
```ini
[Unit]
Description=NAS Terminal Backend Agent
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=/opt/nas-terminal/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
User=nas-terminal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Install steps** (documented in `backend/README.md`):
```bash
# 1. Copy project to server
sudo cp -r backend/ /opt/nas-terminal/backend

# 2. Install dependencies
cd /opt/nas-terminal/backend && npm install --production

# 3. Create config
cp config.example.json config.json
nano config.json   # fill in apiKey and media service URLs

# 4. Create service user
sudo useradd -r -s /bin/false nas-terminal
sudo usermod -aG docker nas-terminal   # allow Docker socket access

# 5. Install and start service
sudo cp nas-terminal.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nas-terminal

# 6. Check status
sudo systemctl status nas-terminal
sudo journalctl -u nas-terminal -f
```

---

## Dependencies (package.json)

```json
{
  "name": "nas-terminal-backend",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "axios": "^1.6.0",
    "dockerode": "^4.0.0",
    "express": "^4.18.0",
    "node-pty": "^1.0.0",
    "ws": "^8.16.0"
  }
}
```

---

## Success Criteria

- [ ] `GET /api/health` returns `{ status: "ok" }` with no auth
- [ ] `GET /api/system/stats` returns CPU, RAM, disk, network values
- [ ] `GET /api/docker/containers` lists running containers from Docker socket
- [ ] `POST /api/docker/:id/stop` stops a container
- [ ] `GET /api/media/emby` returns proxied Emby data
- [ ] `GET /api/media/radarr` returns proxied Radarr data
- [ ] `GET /api/media/sonarr` returns proxied Sonarr data
- [ ] WebSocket `/terminal` spawns a real bash session, streams I/O
- [ ] Wrong API key → 401 on REST, code 4401 on WebSocket
- [ ] Missing Docker socket → 503 on Docker routes, other routes unaffected
- [ ] Offline media service → `{ status: "offline" }`, server doesn't crash
- [ ] `systemctl start nas-terminal` starts the service
- [ ] `systemctl enable nas-terminal` survives reboot
- [ ] `config.json` is gitignored — does not appear in `git status`

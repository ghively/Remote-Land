# NAS Terminal — Backend Agent

Node.js service exposing REST + WebSocket endpoints for system stats,
Docker management, media API proxy (Emby/Radarr/Sonarr), and a real
bash terminal session.

**Port:** 3001 (configurable in `config.json`)

## Prerequisites

- Node.js 18+
- Docker running (for container management endpoints)
- Emby, Radarr, Sonarr running locally (for media endpoints)

### Build tools (required for node-pty)

Ubuntu/Debian:
```bash
sudo apt-get install -y build-essential python3
```

Fedora/RHEL:
```bash
sudo dnf install -y gcc-c++ make python3
```

## Install

```bash
# 1. Copy backend to server
sudo cp -r backend/ /opt/nas-terminal/backend
cd /opt/nas-terminal/backend

# 2. Install Node dependencies
npm install --production

# 3. Create config from template
cp config.example.json config.json
nano config.json   # set apiKey, port, media service URLs + API keys

# 4. Create a dedicated service user
sudo useradd -r -s /bin/bash nas-terminal
sudo usermod -aG docker nas-terminal   # grants Docker socket access

# 5. Install systemd service
sudo cp nas-terminal.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nas-terminal

# 6. Verify
sudo systemctl status nas-terminal
curl http://localhost:3001/api/health
```

## Logs

```bash
sudo journalctl -u nas-terminal -f
```

## API

All routes require `x-api-key` header except `/api/health`.

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Ping — no auth |
| GET | /api/system/stats | CPU, RAM, disk, network |
| GET | /api/system/processes | Top 20 processes by CPU |
| GET | /api/docker/containers | List all containers |
| POST | /api/docker/:id/start | Start a container |
| POST | /api/docker/:id/stop | Stop a container |
| GET | /api/docker/:id/logs | Last 100 log lines |
| GET | /api/media/emby | Emby stats |
| GET | /api/media/radarr | Radarr queue + upcoming |
| GET | /api/media/sonarr | Sonarr queue + upcoming |
| WS | /terminal?token=KEY | Interactive bash session |

## Running tests

```bash
npm test
```

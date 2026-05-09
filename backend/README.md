# NAS Terminal — Backend Agent

Node.js service exposing REST + WebSocket endpoints for system stats,
Docker management, media API proxy (Emby/Radarr/Sonarr), AI chat, and a
real bash terminal session. **Also serves the frontend UI**, so the entire
app is accessible at `http://your-server:3001`.

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

## Remote Access

The backend serves the frontend UI automatically. Once running, open
`http://your-server:3001` in any browser — no separate web server needed.

For HTTPS or a custom domain, put nginx (or Caddy) in front:

```nginx
# nginx example — proxy to NAS Terminal
server {
    listen 443 ssl;
    server_name terminal.yourdomain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";   # WebSocket
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

The WebSocket endpoint (`/terminal`) requires the `upgrade` headers shown
above to work through a reverse proxy.

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
| POST | /api/ai/chat | SSE-streamed chat completion |
| POST | /api/ai/shell | NL→shell command suggestion |
| POST | /api/ai/analyze-logs | SSE-streamed summary of pasted log lines |
| WS | /terminal?token=KEY | Interactive bash session |

## AI features

Set `ai.baseUrl` and `ai.apiKey` in `config.json` to enable the chat panel,
NL→shell launcher mode, and log analyzer. The backend talks to any
OpenAI-compatible Chat Completions endpoint.

| Provider                       | `baseUrl`                                        |
|--------------------------------|---------------------------------------------------|
| OpenAI                         | `https://api.openai.com/v1`                       |
| OpenRouter                     | `https://openrouter.ai/api/v1`                    |
| Groq                           | `https://api.groq.com/openai/v1`                  |
| Together                       | `https://api.together.xyz/v1`                     |
| Ollama (local)                 | `http://localhost:11434/v1`                       |
| LM Studio (local)              | `http://localhost:1234/v1`                        |
| llama.cpp `server` (local)     | `http://localhost:8080/v1`                        |
| vLLM (local)                   | `http://localhost:8000/v1`                        |

Local servers (Ollama, LM Studio, llama.cpp) typically don't need an `apiKey`
— leave it blank. AI is treated as enabled whenever `apiKey` *or* `baseUrl`
is set. Per-feature model overrides: `chatModel`, `shellModel`, `logModel`.

`GET /api/health` exposes `ai: "configured" | "disabled"` (no auth).

### Chat extras

`POST /api/ai/chat` accepts two optional flags in the request body:

- `includeContext` (default `true`) — prepends a compact `<live-snapshot>`
  system message built from `/api/system/stats` + `/api/docker/containers`
  (CPU/RAM/disk/network/uptime/load + container roster). Set to `false` to
  skip the snapshot collection entirely.
- `useTools` (default `true`) — exposes a small **read-only** tool surface
  the model may call mid-response: `getSystemStats`, `getProcesses`,
  `listContainers`, `containerLogs(nameOrId)`, `mediaStatus(service)`.
  When the model emits `tool_calls`, the backend executes them, feeds
  results back, and continues — looping up to 5 iterations. Stream events
  for tool activity are surfaced as `{tool_call_start: {...}}` and
  `{tool_call_result: {id, name, ok}}`.

These are toggle-able from the chat panel toolbar (`[CTX:ON/OFF]` and
`[TOOLS:ON/OFF]`). Tool calling is read-only by design — there is no
backend tool that runs shell commands, modifies files, or starts/stops
containers from the AI loop. Mutating actions still require explicit
user confirmation through the existing UI.

## Running tests

```bash
npm test
```

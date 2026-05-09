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

## Install (single-host deploy)

The backend serves the React UI from the same port as the API, so a
single `systemctl start` is enough — no separate web server required.
The repo's `backend/` and `frontend/` directories must sit side-by-side
on the target machine; `server.js` resolves the UI directory as
`../frontend` relative to itself.

```bash
# 1. Copy BOTH trees to the server (preserve the side-by-side layout)
sudo mkdir -p /opt/nas-terminal
sudo cp -r backend/  /opt/nas-terminal/backend
sudo cp -r frontend/ /opt/nas-terminal/frontend
cd /opt/nas-terminal/backend

# 2. Install Node dependencies
sudo npm install --omit=dev

# 3. Create config from template
sudo cp config.example.json config.json
sudo nano config.json   # set apiKey, port, media URLs + keys, ai.{baseUrl,apiKey}

# 4. Create a dedicated service user (shell needed for `systemctl status` to
#    show the right user; node-pty itself doesn't need a login shell)
sudo useradd -r -s /bin/bash nas-terminal || true
sudo usermod -aG docker nas-terminal     # grants Docker socket access
sudo chown -R nas-terminal:nas-terminal /opt/nas-terminal

# 5. Install systemd service
sudo cp nas-terminal.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nas-terminal

# 6. Verify
sudo systemctl status nas-terminal
curl http://localhost:3001/api/health     # → {"status":"ok","ai":"..."}
curl -I http://localhost:3001/            # → 200 text/html (the UI)
```

Open `http://<host>:3001/` in a browser. Log in with the API key from
`config.json` (or leave blank for demo mode).

### Reverse-proxy / split-host deploy

If you want to put the UI behind nginx/Caddy with TLS termination, copy
only `frontend/` to the static root and proxy `/api/*` + `/terminal`
(WebSocket upgrade) to the backend on `:3001`. **Make sure the static
host serves `.jsx` files with `Content-Type: text/javascript` (or
`application/javascript`)** — the default `text/html` or `text/plain`
that some configs hand back will cause Babel-standalone to fail
silently and you'll see a blank or "static-looking" page.

nginx snippet:

```nginx
types { text/javascript jsx; }   # tell nginx that .jsx is JS
location / {
    root /var/www/nas-terminal;
    index "NAS Terminal.html";
}
location /api/     { proxy_pass http://127.0.0.1:3001; }
location /terminal {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

If the UI loads but doesn't render past the boot screen, the most
common causes are: (1) wrong MIME type on `.jsx`, (2) reverse proxy
buffering the SSE stream from `/api/ai/*` (add `proxy_buffering off;`
inside the `/api/` block), or (3) a Content-Security-Policy header
blocking `unpkg.com`/`cdn.jsdelivr.net` — both CDNs are required for
React, Babel-standalone, and xterm.js.

### Custom layout

If `backend/` and `frontend/` aren't side-by-side on the target host,
set `frontendDir` in `config.json` to the absolute path of the
frontend directory. Setting it to a non-existent path (or omitting it
when `../frontend` doesn't resolve) makes the backend log a warning at
startup and serve the API only.

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

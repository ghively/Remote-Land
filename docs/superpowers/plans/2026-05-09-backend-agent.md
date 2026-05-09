# NAS Terminal Backend Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js Express backend agent that exposes REST + WebSocket endpoints for system stats, Docker management, Emby/Radarr/Sonarr proxy, and a real bash terminal session — running as a systemd service on Linux.

**Architecture:** Single Node.js process with five focused modules (system, docker, media, terminal, server). `server.js` exports a `createApp(config)` factory for testability — the entry point calls it only when run directly. Auth is an Express middleware checking `x-api-key` header on every route except `/api/health`. WebSocket terminal uses the HTTP server's upgrade event.

**Tech Stack:** Node.js, Express 4, ws 8, node-pty 1, dockerode 4, axios 1, cors 2, Jest 29, supertest 6.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `backend/README.md` | Full install instructions |
| Modify | `.gitignore` | Add `backend/config.json` |
| Create | `backend/package.json` | Dependencies + test script |
| Create | `backend/config.example.json` | Config template |
| Create | `backend/server.js` | Express app factory + entry point |
| Create | `backend/system.js` | /proc stats (CPU, RAM, disk, network) |
| Create | `backend/docker.js` | Docker socket wrapper |
| Create | `backend/media.js` | Emby / Radarr / Sonarr proxy |
| Create | `backend/terminal.js` | node-pty + WebSocket session |
| Create | `backend/nas-terminal.service` | systemd unit file |
| Create | `backend/__tests__/server.test.js` | Auth + health + offline media tests |
| Create | `backend/__tests__/system.test.js` | Pure parser unit tests |
| Create | `backend/__tests__/docker.test.js` | Dockerode mock tests |
| Create | `backend/__tests__/media.test.js` | Axios mock tests |

---

### Task 1: Scaffold — package.json, config, .gitignore

**Files:**
- Create: `backend/package.json`
- Create: `backend/config.example.json`
- Modify: `.gitignore` (repo root)

- [ ] **Step 1: Add `backend/config.json` to .gitignore**

  Open `C:\Git\UI\.gitignore` and append:

  ```
  # Backend config (contains API key — never commit)
  backend/config.json
  ```

- [ ] **Step 2: Create `backend/package.json`**

  ```json
  {
    "name": "nas-terminal-backend",
    "version": "1.0.0",
    "main": "server.js",
    "scripts": {
      "start": "node server.js",
      "test": "jest --testPathPattern=__tests__"
    },
    "dependencies": {
      "axios": "^1.6.0",
      "cors": "^2.8.5",
      "dockerode": "^4.0.0",
      "express": "^4.18.0",
      "node-pty": "^1.0.0",
      "ws": "^8.16.0"
    },
    "devDependencies": {
      "jest": "^29.0.0",
      "supertest": "^6.3.0"
    }
  }
  ```

- [ ] **Step 3: Create `backend/config.example.json`**

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

- [ ] **Step 4: Create `backend/config.json` locally (never commit)**

  On your Linux server (or locally for dev):
  ```bash
  cp backend/config.example.json backend/config.json
  # Edit config.json — fill in a real apiKey and media service URLs
  ```

  Verify it is ignored:
  ```bash
  git check-ignore -v backend/config.json
  ```
  Expected: `.gitignore:N:backend/config.json   backend/config.json`

- [ ] **Step 5: Install dependencies (run on Linux server)**

  ```bash
  cd backend
  # node-pty requires native build tools
  # Ubuntu: sudo apt-get install -y build-essential python3
  # Fedora:  sudo dnf install -y gcc-c++ make python3
  npm install
  ```

  Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add .gitignore backend/package.json backend/config.example.json
  git commit --no-gpg-sign -m "chore: scaffold backend package and config

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 2: server.js — Express app, auth, health endpoint

**Files:**
- Create: `backend/server.js`
- Create: `backend/__tests__/server.test.js`

- [ ] **Step 1: Write the failing tests**

  Create `backend/__tests__/server.test.js`:

  ```js
  const request = require('supertest');
  const { createApp } = require('../server');

  const testConfig = {
    apiKey: 'test-key-abc123',
    port: 3001,
    shell: '/bin/bash',
    media: {
      emby:   { url: 'http://localhost:8096', apiKey: 'e' },
      radarr: { url: 'http://localhost:7878', apiKey: 'r' },
      sonarr: { url: 'http://localhost:8989', apiKey: 's' },
    },
  };

  let app;
  beforeAll(() => { app = createApp(testConfig); });

  test('GET /api/health returns 200 without auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('GET /api/system/stats returns 401 without API key', async () => {
    const res = await request(app).get('/api/system/stats');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  test('GET /api/system/stats returns 401 with wrong API key', async () => {
    const res = await request(app)
      .get('/api/system/stats')
      .set('x-api-key', 'wrong-key');
    expect(res.status).toBe(401);
  });

  test('GET /api/media/emby returns {status: offline} when service unreachable', async () => {
    const res = await request(app)
      .get('/api/media/emby')
      .set('x-api-key', 'test-key-abc123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'offline' });
  });
  ```

- [ ] **Step 2: Run tests — verify they fail**

  ```bash
  cd backend && npm test -- --testPathPattern=server
  ```

  Expected: FAIL — `Cannot find module '../server'`

- [ ] **Step 3: Create `backend/server.js`**

  ```js
  const express = require('express');
  const http = require('http');
  const cors = require('cors');
  const system = require('./system');
  const docker = require('./docker');
  const media = require('./media');
  const { attachTerminal } = require('./terminal');

  function createApp(config) {
    const app = express();

    app.use(cors({
      origin: (origin, cb) => {
        if (!origin || origin === 'null' || origin.startsWith('http://localhost')) {
          cb(null, true);
        } else {
          cb(new Error('Not allowed by CORS'));
        }
      },
    }));
    app.use(express.json());

    const auth = (req, res, next) => {
      if (req.headers['x-api-key'] !== config.apiKey) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    };

    app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

    app.get('/api/system/stats', auth, async (req, res) => {
      try { res.json(await system.getStats()); }
      catch (_) { res.json({ error: 'unavailable' }); }
    });

    app.get('/api/system/processes', auth, async (req, res) => {
      try { res.json(await system.getProcesses()); }
      catch (_) { res.json({ error: 'unavailable' }); }
    });

    app.get('/api/docker/containers', auth, async (req, res) => {
      try { res.json(await docker.getContainers()); }
      catch (_) { res.status(503).json({ error: 'Docker unavailable' }); }
    });

    app.post('/api/docker/:id/start', auth, async (req, res) => {
      try { await docker.startContainer(req.params.id); res.json({ ok: true }); }
      catch (err) { res.status(503).json({ error: err.message }); }
    });

    app.post('/api/docker/:id/stop', auth, async (req, res) => {
      try { await docker.stopContainer(req.params.id); res.json({ ok: true }); }
      catch (err) { res.status(503).json({ error: err.message }); }
    });

    app.get('/api/docker/:id/logs', auth, async (req, res) => {
      try { res.type('text/plain').send(await docker.getLogs(req.params.id)); }
      catch (err) { res.status(503).json({ error: err.message }); }
    });

    app.get('/api/media/emby', auth, async (req, res) => {
      try { res.json(await media.getEmbyData(config)); }
      catch (_) { res.json({ status: 'offline' }); }
    });

    app.get('/api/media/radarr', auth, async (req, res) => {
      try { res.json(await media.getRadarrData(config)); }
      catch (_) { res.json({ status: 'offline' }); }
    });

    app.get('/api/media/sonarr', auth, async (req, res) => {
      try { res.json(await media.getSonarrData(config)); }
      catch (_) { res.json({ status: 'offline' }); }
    });

    return app;
  }

  if (require.main === module) {
    const config = require('./config.json');
    const app = createApp(config);
    const server = http.createServer(app);
    attachTerminal(server, config);
    process.on('unhandledRejection', (err) => console.error('Unhandled:', err));
    server.listen(config.port, () =>
      console.log(`NAS Terminal backend listening on :${config.port}`)
    );
  }

  module.exports = { createApp };
  ```

  **Note:** `system`, `docker`, `media`, and `terminal` modules don't exist yet — tests will fail to import them. Create stub files so tests can run:

  Create `backend/system.js`:
  ```js
  async function getStats() { throw new Error('not implemented'); }
  async function getProcesses() { throw new Error('not implemented'); }
  module.exports = { getStats, getProcesses };
  ```

  Create `backend/docker.js`:
  ```js
  async function getContainers() { throw new Error('not implemented'); }
  async function startContainer() { throw new Error('not implemented'); }
  async function stopContainer() { throw new Error('not implemented'); }
  async function getLogs() { throw new Error('not implemented'); }
  module.exports = { getContainers, startContainer, stopContainer, getLogs };
  ```

  Create `backend/media.js`:
  ```js
  async function getEmbyData() { throw new Error('not implemented'); }
  async function getRadarrData() { throw new Error('not implemented'); }
  async function getSonarrData() { throw new Error('not implemented'); }
  module.exports = { getEmbyData, getRadarrData, getSonarrData };
  ```

  Create `backend/terminal.js`:
  ```js
  function attachTerminal(httpServer, config) {}
  module.exports = { attachTerminal };
  ```

- [ ] **Step 4: Run tests — verify they pass**

  ```bash
  cd backend && npm test -- --testPathPattern=server
  ```

  Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add backend/server.js backend/system.js backend/docker.js backend/media.js backend/terminal.js backend/__tests__/server.test.js
  git commit --no-gpg-sign -m "feat: add Express server with auth middleware and health endpoint

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 3: system.js — CPU, RAM, disk, network stats

**Files:**
- Modify: `backend/system.js` (replace stub)
- Create: `backend/__tests__/system.test.js`

- [ ] **Step 1: Write failing tests**

  Create `backend/__tests__/system.test.js`:

  ```js
  const { parseCpuLine, parseMemInfo, parseNetDev } = require('../system');

  test('parseCpuLine extracts busy and total from /proc/stat line', () => {
    // cpu  user nice system idle iowait irq softirq steal ...
    const line = 'cpu  100 10 50 800 5 2 3 0 0 0';
    const result = parseCpuLine(line);
    // total = 100+10+50+800+5+2+3 = 970
    // busy  = 100+10+50+2+3 = 165  (excl idle, iowait)
    expect(result.total).toBe(970);
    expect(result.busy).toBe(165);
  });

  test('parseMemInfo returns used RAM in bytes from /proc/meminfo', () => {
    const content = [
      'MemTotal:       16384000 kB',
      'MemFree:         4096000 kB',
      'Buffers:          512000 kB',
      'Cached:          4096000 kB',
      'SwapTotal:       2097152 kB',
    ].join('\n');
    const result = parseMemInfo(content);
    expect(result.total).toBe(16384000 * 1024);
    // used = MemTotal - MemFree - Buffers - Cached
    expect(result.used).toBe((16384000 - 4096000 - 512000 - 4096000) * 1024);
  });

  test('parseNetDev parses rx and tx bytes per interface', () => {
    const content = [
      'Inter-|   Receive    |  Transmit',
      ' face |bytes packets |bytes packets',
      '  eth0: 12345678    1000    0    0    0     0    0    0  87654321   500    0    0    0     0    0    0',
      '    lo:      1000      50    0    0    0     0    0    0      1000    50    0    0    0     0    0    0',
    ].join('\n');
    const result = parseNetDev(content);
    expect(result['eth0'].rx).toBe(12345678);
    expect(result['eth0'].tx).toBe(87654321);
    expect(result['lo'].rx).toBe(1000);
  });
  ```

- [ ] **Step 2: Run tests — verify they fail**

  ```bash
  cd backend && npm test -- --testPathPattern=system
  ```

  Expected: FAIL — `parseCpuLine is not a function`

- [ ] **Step 3: Replace `backend/system.js` with full implementation**

  ```js
  const fs = require('fs').promises;
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);

  function parseCpuLine(line) {
    const parts = line.trim().split(/\s+/);
    const [user, nice, system, idle, iowait, irq, softirq, steal] =
      parts.slice(1).map(Number);
    const total = user + nice + system + idle + iowait + irq + softirq + steal;
    const busy  = user + nice + system + irq + softirq + steal;
    return { total, busy };
  }

  function parseMemInfo(content) {
    const get = (key) => {
      const m = content.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
      return m ? parseInt(m[1]) * 1024 : 0;
    };
    const total = get('MemTotal');
    const free  = get('MemFree');
    const buffers = get('Buffers');
    const cached  = get('Cached');
    return { total, used: total - free - buffers - cached };
  }

  function parseNetDev(content) {
    const lines = content.trim().split('\n').slice(2);
    const result = {};
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const iface = parts[0].replace(':', '');
      result[iface] = { rx: parseInt(parts[1]), tx: parseInt(parts[9]) };
    }
    return result;
  }

  async function getStats() {
    // Sample 1: CPU + network at t=0
    const [stat1, netDev1] = await Promise.all([
      fs.readFile('/proc/stat', 'utf8'),
      fs.readFile('/proc/net/dev', 'utf8'),
    ]);

    await new Promise(r => setTimeout(r, 500));

    // Sample 2: CPU + network + RAM + disk at t=500ms
    const [stat2, netDev2, memContent, { stdout: dfOut }] = await Promise.all([
      fs.readFile('/proc/stat', 'utf8'),
      fs.readFile('/proc/net/dev', 'utf8'),
      fs.readFile('/proc/meminfo', 'utf8'),
      execAsync('df -B1 / --output=used,size'),
    ]);

    // CPU %
    const cpu1 = parseCpuLine(stat1.split('\n')[0]);
    const cpu2 = parseCpuLine(stat2.split('\n')[0]);
    const cpuPercent = ((cpu2.busy - cpu1.busy) / (cpu2.total - cpu1.total)) * 100;

    // RAM
    const ram = parseMemInfo(memContent);

    // Disk (root filesystem)
    const [usedStr, sizeStr] = dfOut.trim().split('\n')[1].trim().split(/\s+/);
    const disk = { used: parseInt(usedStr), total: parseInt(sizeStr) };

    // Network — sum non-loopback interfaces, convert 500ms window → per-second
    const net1 = parseNetDev(netDev1);
    const net2 = parseNetDev(netDev2);
    let rxDelta = 0, txDelta = 0;
    for (const iface of Object.keys(net2)) {
      if (iface === 'lo') continue;
      rxDelta += net2[iface].rx - (net1[iface]?.rx || 0);
      txDelta += net2[iface].tx - (net1[iface]?.tx || 0);
    }

    return {
      cpu:     { percent: Math.round(cpuPercent * 10) / 10 },
      ram,
      disk,
      network: { rxBytesPerSec: rxDelta * 2, txBytesPerSec: txDelta * 2 },
    };
  }

  async function getProcesses() {
    const { stdout } = await execAsync(
      "ps aux --sort=-%cpu | head -21 | tail -20 | awk '{print $1,$2,$3,$4,$11}'"
    );
    return stdout.trim().split('\n').map(line => {
      const [user, pid, cpu, mem, cmd] = line.split(' ');
      return { user, pid: parseInt(pid), cpu: parseFloat(cpu), mem: parseFloat(mem), cmd };
    });
  }

  module.exports = { getStats, getProcesses, parseCpuLine, parseMemInfo, parseNetDev };
  ```

- [ ] **Step 4: Run tests — verify they pass**

  ```bash
  cd backend && npm test -- --testPathPattern=system
  ```

  Expected: PASS — 3 tests pass.

- [ ] **Step 5: Smoke-test the endpoint (on Linux with real /proc)**

  ```bash
  node server.js &
  curl -s -H "x-api-key: $(jq -r .apiKey config.json)" http://localhost:3001/api/system/stats | jq .
  kill %1
  ```

  Expected: JSON with `cpu.percent`, `ram.total`, `disk.used`, `network.rxBytesPerSec`.

- [ ] **Step 6: Commit**

  ```bash
  git add backend/system.js backend/__tests__/system.test.js
  git commit --no-gpg-sign -m "feat: add system stats module (/proc CPU, RAM, disk, network)

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 4: docker.js — Docker socket integration

**Files:**
- Modify: `backend/docker.js` (replace stub)
- Create: `backend/__tests__/docker.test.js`

- [ ] **Step 1: Write failing tests**

  Create `backend/__tests__/docker.test.js`:

  ```js
  jest.mock('dockerode', () => {
    const mockContainer = {
      start: jest.fn().mockResolvedValue(undefined),
      stop:  jest.fn().mockResolvedValue(undefined),
      logs:  jest.fn().mockResolvedValue(Buffer.from('line1\nline2\n')),
    };
    return jest.fn().mockImplementation(() => ({
      listContainers: jest.fn().mockResolvedValue([{
        Id: 'abc123def45678',
        Names: ['/emby'],
        Image: 'emby/embyserver:latest',
        Status: 'Up 2 days',
        State: 'running',
      }]),
      getContainer: jest.fn().mockReturnValue(mockContainer),
    }));
  });

  const { getContainers, startContainer, stopContainer, getLogs } = require('../docker');

  test('getContainers returns normalized container list', async () => {
    const result = await getContainers();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id:     'abc123def456',
      name:   'emby',
      image:  'emby/embyserver:latest',
      status: 'Up 2 days',
      state:  'running',
    });
  });

  test('startContainer calls dockerode start on the container id', async () => {
    await expect(startContainer('abc123def456')).resolves.toBeUndefined();
  });

  test('stopContainer calls dockerode stop on the container id', async () => {
    await expect(stopContainer('abc123def456')).resolves.toBeUndefined();
  });

  test('getLogs returns log string from dockerode', async () => {
    const logs = await getLogs('abc123def456');
    expect(typeof logs).toBe('string');
    expect(logs).toContain('line1');
  });
  ```

- [ ] **Step 2: Run tests — verify they fail**

  ```bash
  cd backend && npm test -- --testPathPattern=docker
  ```

  Expected: FAIL — `getContainers` throws `not implemented`

- [ ] **Step 3: Replace `backend/docker.js` with full implementation**

  ```js
  const Dockerode = require('dockerode');
  const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

  async function getContainers() {
    const containers = await docker.listContainers({ all: true });
    return containers.map(c => ({
      id:     c.Id.slice(0, 12),
      name:   c.Names[0].replace(/^\//, ''),
      image:  c.Image,
      status: c.Status,
      state:  c.State,
    }));
  }

  async function startContainer(id) {
    await docker.getContainer(id).start();
  }

  async function stopContainer(id) {
    await docker.getContainer(id).stop();
  }

  async function getLogs(id) {
    const buf = await docker.getContainer(id).logs({
      stdout: true, stderr: true, tail: 100,
    });
    return buf.toString('utf8');
  }

  module.exports = { getContainers, startContainer, stopContainer, getLogs };
  ```

- [ ] **Step 4: Run tests — verify they pass**

  ```bash
  cd backend && npm test -- --testPathPattern=docker
  ```

  Expected: PASS — 4 tests pass.

- [ ] **Step 5: Smoke-test (on Linux with Docker running)**

  ```bash
  node server.js &
  curl -s -H "x-api-key: $(jq -r .apiKey config.json)" http://localhost:3001/api/docker/containers | jq .
  kill %1
  ```

  Expected: JSON array of containers. If Docker socket missing, returns `{ "error": "Docker unavailable" }` with status 503.

- [ ] **Step 6: Commit**

  ```bash
  git add backend/docker.js backend/__tests__/docker.test.js
  git commit --no-gpg-sign -m "feat: add Docker module (list, start, stop, logs via socket)

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 5: media.js — Emby / Radarr / Sonarr proxy

**Files:**
- Modify: `backend/media.js` (replace stub)
- Create: `backend/__tests__/media.test.js`

- [ ] **Step 1: Write failing tests**

  Create `backend/__tests__/media.test.js`:

  ```js
  jest.mock('axios');
  const axios = require('axios');
  const { getEmbyData, getRadarrData, getSonarrData } = require('../media');

  const testConfig = {
    media: {
      emby:   { url: 'http://localhost:8096', apiKey: 'emby-key' },
      radarr: { url: 'http://localhost:7878', apiKey: 'radarr-key' },
      sonarr: { url: 'http://localhost:8989', apiKey: 'sonarr-key' },
    },
  };

  test('getEmbyData returns normalized shape from Emby API', async () => {
    axios.get
      .mockResolvedValueOnce({ data: [{ Id: '1' }, { Id: '2' }] }) // /Sessions
      .mockResolvedValueOnce({ data: { ServerName: 'HomeServer', Version: '4.8.0' } }); // /System/Info

    const result = await getEmbyData(testConfig);
    expect(result).toEqual({
      activeSessions: 2,
      serverName: 'HomeServer',
      version: '4.8.0',
    });
  });

  test('getRadarrData returns normalized shape from Radarr API', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { totalRecords: 3 } })  // /queue
      .mockResolvedValueOnce({ data: [{ title: 'Movie A' }, { title: 'Movie B' }] }); // /calendar

    const result = await getRadarrData(testConfig);
    expect(result).toEqual({ queueSize: 3, upcoming: 2 });
  });

  test('getSonarrData returns normalized shape from Sonarr API', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { totalRecords: 1 } })  // /queue
      .mockResolvedValueOnce({ data: [{ title: 'Show S01E01' }] }); // /calendar

    const result = await getSonarrData(testConfig);
    expect(result).toEqual({ queueSize: 1, upcoming: 1 });
  });
  ```

- [ ] **Step 2: Run tests — verify they fail**

  ```bash
  cd backend && npm test -- --testPathPattern=media
  ```

  Expected: FAIL — `getEmbyData` throws `not implemented`

- [ ] **Step 3: Replace `backend/media.js` with full implementation**

  ```js
  const axios = require('axios');

  function today() { return new Date().toISOString().slice(0, 10); }
  function weekOut() { return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10); }

  async function getEmbyData(config) {
    const { url, apiKey } = config.media.emby;
    const headers = { 'X-Emby-Token': apiKey };
    const [sessions, info] = await Promise.all([
      axios.get(`${url}/Sessions`, { headers }),
      axios.get(`${url}/System/Info`, { headers }),
    ]);
    return {
      activeSessions: sessions.data.length,
      serverName:     info.data.ServerName,
      version:        info.data.Version,
    };
  }

  async function getRadarrData(config) {
    const { url, apiKey } = config.media.radarr;
    const headers = { 'X-Api-Key': apiKey };
    const [queue, calendar] = await Promise.all([
      axios.get(`${url}/api/v3/queue`, { headers }),
      axios.get(`${url}/api/v3/calendar?unmonitored=false&start=${today()}&end=${weekOut()}`, { headers }),
    ]);
    return {
      queueSize: queue.data.totalRecords,
      upcoming:  calendar.data.length,
    };
  }

  async function getSonarrData(config) {
    const { url, apiKey } = config.media.sonarr;
    const headers = { 'X-Api-Key': apiKey };
    const [queue, calendar] = await Promise.all([
      axios.get(`${url}/api/v3/queue`, { headers }),
      axios.get(`${url}/api/v3/calendar?unmonitored=false&start=${today()}&end=${weekOut()}`, { headers }),
    ]);
    return {
      queueSize: queue.data.totalRecords,
      upcoming:  calendar.data.length,
    };
  }

  module.exports = { getEmbyData, getRadarrData, getSonarrData };
  ```

- [ ] **Step 4: Run tests — verify they pass**

  ```bash
  cd backend && npm test -- --testPathPattern=media
  ```

  Expected: PASS — 3 tests pass.

- [ ] **Step 5: Run full test suite**

  ```bash
  cd backend && npm test
  ```

  Expected: PASS — all 11 tests pass (4 server + 3 system + 4 docker + 3 media... wait, server=4, system=3, docker=4, media=3 = 14 total).

  Expected: 14 tests pass, 0 failures.

- [ ] **Step 6: Commit**

  ```bash
  git add backend/media.js backend/__tests__/media.test.js
  git commit --no-gpg-sign -m "feat: add media proxy module (Emby, Radarr, Sonarr)

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 6: terminal.js — WebSocket PTY session

**Files:**
- Modify: `backend/terminal.js` (replace stub)

  Note: `node-pty` requires a real Linux environment to spawn a PTY. There are no unit tests for this module — it is verified by manual smoke test on the Linux server.

- [ ] **Step 1: Replace `backend/terminal.js` with full implementation**

  ```js
  const WebSocket = require('ws');
  const pty = require('node-pty');

  function attachTerminal(httpServer, config) {
    const wss = new WebSocket.Server({ noServer: true });

    httpServer.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (!url.pathname.startsWith('/terminal')) {
        socket.destroy();
        return;
      }
      if (url.searchParams.get('token') !== config.apiKey) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
    });

    wss.on('connection', (ws) => {
      const shell = config.shell || '/bin/bash';
      let ptyProcess;

      try {
        ptyProcess = pty.spawn(shell, [], {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd: process.env.HOME || '/',
          env: process.env,
        });
      } catch (err) {
        ws.close(1011, `PTY spawn failed: ${err.message}`);
        return;
      }

      ptyProcess.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(Buffer.from(data));
      });

      ptyProcess.onExit(() => {
        if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'Process exited');
      });

      ws.on('message', (raw) => {
        try {
          const { type, data, cols, rows } = JSON.parse(raw.toString());
          if (type === 'input')  ptyProcess.write(data);
          if (type === 'resize') ptyProcess.resize(Number(cols), Number(rows));
        } catch (_) {}
      });

      ws.on('close', () => { try { ptyProcess.kill(); } catch (_) {} });
    });
  }

  module.exports = { attachTerminal };
  ```

- [ ] **Step 2: Smoke-test the terminal WebSocket (on Linux)**

  Install `wscat` for one-time testing:
  ```bash
  npx wscat -c "ws://localhost:3001/terminal?token=$(jq -r .apiKey config.json)"
  ```

  Type `ls` and press Enter.

  Expected: PTY output streams back — directory listing appears.

  Test auth rejection:
  ```bash
  npx wscat -c "ws://localhost:3001/terminal?token=wrong"
  ```

  Expected: Connection rejected with HTTP 401.

- [ ] **Step 3: Commit**

  ```bash
  git add backend/terminal.js
  git commit --no-gpg-sign -m "feat: add WebSocket PTY terminal (node-pty + ws)

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 7: systemd service + README update

**Files:**
- Create: `backend/nas-terminal.service`
- Modify: `backend/README.md`

- [ ] **Step 1: Create `backend/nas-terminal.service`**

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

- [ ] **Step 2: Overwrite `backend/README.md` with install instructions**

  ```markdown
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
  sudo useradd -r -s /bin/false nas-terminal
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
  ```

- [ ] **Step 3: Run full test suite one final time**

  ```bash
  cd backend && npm test
  ```

  Expected: 14 tests pass, 0 failures.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/nas-terminal.service backend/README.md
  git commit --no-gpg-sign -m "feat: add systemd service unit and full install instructions

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

- [ ] **Step 5: Push**

  ```bash
  git push origin master
  ```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| `GET /api/health` no auth | Task 2 test |
| `GET /api/system/stats` CPU/RAM/disk/network | Task 3 |
| `GET /api/system/processes` | Task 3 |
| `GET /api/docker/containers` | Task 4 |
| `POST /api/docker/:id/start` | Task 4 |
| `POST /api/docker/:id/stop` | Task 4 |
| `GET /api/docker/:id/logs` | Task 4 |
| `GET /api/media/emby` | Task 5 |
| `GET /api/media/radarr` | Task 5 |
| `GET /api/media/sonarr` | Task 5 |
| WebSocket `/terminal` PTY | Task 6 |
| Wrong API key → 401 / code 4401 | Task 2 test + Task 6 impl |
| Missing Docker socket → 503 | Task 4 (error caught in server.js) |
| Offline media → `{status:offline}` | Task 2 test (verified at server layer) |
| systemd service | Task 7 |
| `backend/config.json` gitignored | Task 1 |

**Placeholder scan:** No TBD/TODO/vague steps. All code blocks are complete.

**Type consistency:**
- `parseCpuLine` defined in Task 3, used in Task 3 only ✓
- `parseMemInfo` defined in Task 3, used in Task 3 only ✓
- `parseNetDev` defined in Task 3, used in Task 3 only ✓
- `createApp(config)` defined in Task 2, referenced in Task 2 tests ✓
- `attachTerminal(httpServer, config)` stub in Task 2, implemented in Task 6 ✓
- `getEmbyData(config)` / `getRadarrData(config)` / `getSonarrData(config)` — config passed as parameter consistently ✓

**Test count:** server(4) + system(3) + docker(4) + media(3) = 14 total. Step 5 of Task 5 says 14 tests.

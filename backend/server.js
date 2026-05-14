const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const system = require('./system');
const docker = require('./docker');
const media = require('./media');
const ai = require('./ai');
const files = require('./files');
const services = require('./services');
const network = require('./network');
const cron = require('./cron');
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

  // ── Frontend static files ──────────────────────────────────────────────
  // Serve the cyber-noir UI so the entire app is accessible at http://host:port
  const frontendDir = path.resolve(__dirname, '..', 'frontend');

  // Root serves the main UI
  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDir, 'NAS Terminal.html'));
  });

  // Static assets (CSS, JSX components, images, etc.)
  app.use(express.static(frontendDir));

  // ── Auth middleware ────────────────────────────────────────────────────
  const auth = (req, res, next) => {
    if (req.headers['x-api-key'] !== config.apiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', ai: ai.isConfigured(config) ? 'configured' : 'disabled' })
  );

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

  app.post('/api/docker/:id/restart', auth, async (req, res) => {
    try { await docker.restartContainer(req.params.id); res.json({ ok: true }); }
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

  // ── Files ──────────────────────────────────────────────────────────────────
  app.get('/api/files/list', auth, async (req, res) => {
    try { res.json(await files.list(req.query.path || '/')); }
    catch (err) { res.status(err.code === 'EBADPATH' ? 400 : 500).json({ error: err.message }); }
  });
  app.get('/api/files/read', auth, async (req, res) => {
    try { res.json(await files.readText(req.query.path)); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.get('/api/files/download', auth, async (req, res) => {
    try { files.streamFile(req.query.path, res); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/files/mkdir', auth, async (req, res) => {
    try { res.json(await files.mkdir(req.body && req.body.path)); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.post('/api/files/rename', auth, async (req, res) => {
    try { res.json(await files.rename(req.body && req.body.from, req.body && req.body.to)); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });
  app.delete('/api/files', auth, async (req, res) => {
    try { res.json(await files.rm(req.query.path)); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });

  // ── Systemd services ───────────────────────────────────────────────────────
  app.get('/api/services', auth, async (req, res) => {
    try { res.json(await services.list({ state: req.query.state })); }
    catch (err) { res.status(503).json({ error: err.message }); }
  });
  app.get('/api/services/:name', auth, async (req, res) => {
    try { res.json(await services.status(req.params.name)); }
    catch (err) { res.status(503).json({ error: err.message }); }
  });
  app.get('/api/services/:name/logs', auth, async (req, res) => {
    try { res.type('text/plain').send(await services.recentLogs(req.params.name, parseInt(req.query.lines, 10) || 100)); }
    catch (err) { res.status(503).json({ error: err.message }); }
  });
  app.post('/api/services/:name/:verb', auth, async (req, res) => {
    try { res.json(await services.action(req.params.name, req.params.verb)); }
    catch (err) { res.status(503).json({ error: err.message }); }
  });

  // ── Network ────────────────────────────────────────────────────────────────
  app.get('/api/network', auth, async (req, res) => {
    try { res.json(await network.snapshot()); }
    catch (err) { res.status(503).json({ error: err.message }); }
  });

  // ── Cron ───────────────────────────────────────────────────────────────────
  app.get('/api/cron', auth, async (req, res) => {
    try { res.json(await cron.read()); }
    catch (err) { res.status(503).json({ error: err.message }); }
  });
  app.put('/api/cron', auth, async (req, res) => {
    try { res.json(await cron.write(req.body && req.body.body)); }
    catch (err) { res.status(400).json({ error: err.message }); }
  });

  // ── AI ──────────────────────────────────────────────────────────────────────
  // Map an internal error to the public-facing message in the spec error table.
  // Never echoes upstream body back to the client.
  const aiErrorMessage = (err) => {
    if (err && err.name === 'UpstreamError') {
      if (err.status === 401 || err.status === 403) return 'AI auth failed';
      if (err.status === 429) return 'AI rate limited';
      return 'AI temporarily unavailable';
    }
    if (err && /malformed|no JSON/i.test(err.message)) return 'AI returned malformed response';
    return 'AI temporarily unavailable';
  };

  app.post('/api/ai/chat', auth, async (req, res) => {
    if (!ai.isConfigured(config)) return res.status(503).json({ error: 'AI not configured' });
    if (!Array.isArray(req.body.messages) || req.body.messages.length === 0) {
      return res.status(400).json({ error: 'messages required' });
    }
    // Spec 4 keeps the v1 chat prompt static and treats tool calling as a
    // non-goal, so route defaults are OFF. The frontend AIChatPanel passes
    // {includeContext:true, useTools:true} explicitly when its toggles are on.
    const includeContext = req.body.includeContext === true;
    const useTools       = req.body.useTools       === true;
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache');
    res.setHeader('connection', 'keep-alive');
    try {
      for await (const event of ai.streamChat(config, req.body.messages, { includeContext, useTools })) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: aiErrorMessage(err) })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  });

  app.post('/api/ai/shell', auth, async (req, res) => {
    if (!ai.isConfigured(config)) return res.status(503).json({ error: 'AI not configured' });
    if (typeof req.body.intent !== 'string' || !req.body.intent.trim()) {
      return res.status(400).json({ error: 'intent required' });
    }
    try {
      res.json(await ai.suggestShell(config, req.body.intent));
    } catch (err) {
      if (err && err.name === 'UpstreamError' && err.status === 429) {
        if (err.retryAfter) res.setHeader('retry-after', err.retryAfter);
        return res.status(429).json({ error: 'AI rate limited' });
      }
      res.status(502).json({ error: aiErrorMessage(err) });
    }
  });

  app.post('/api/ai/analyze-logs', auth, async (req, res) => {
    if (!ai.isConfigured(config)) return res.status(503).json({ error: 'AI not configured' });
    if (!Array.isArray(req.body.lines) || req.body.lines.length === 0) {
      return res.status(400).json({ error: 'lines required' });
    }
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache');
    res.setHeader('connection', 'keep-alive');
    try {
      for await (const event of ai.streamLogAnalysis(config, req.body.lines)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: aiErrorMessage(err) })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
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

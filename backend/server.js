const express = require('express');
const http = require('http');
const cors = require('cors');
const system = require('./system');
const docker = require('./docker');
const media = require('./media');
const ai = require('./ai');
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

  // ── AI ──────────────────────────────────────────────────────────────────────
  app.post('/api/ai/chat', auth, async (req, res) => {
    if (!ai.isConfigured(config)) return res.status(503).json({ error: 'AI not configured' });
    if (!Array.isArray(req.body.messages) || req.body.messages.length === 0) {
      return res.status(400).json({ error: 'messages required' });
    }
    // Default: include a live system snapshot. Caller can opt out per-request.
    const includeContext = req.body.includeContext !== false;
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache');
    res.setHeader('connection', 'keep-alive');
    try {
      for await (const event of ai.streamChat(config, req.body.messages, { includeContext })) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
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
      res.status(502).json({ error: err.message });
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
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
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

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

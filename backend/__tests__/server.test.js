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

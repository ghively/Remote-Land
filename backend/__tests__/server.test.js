jest.mock('../ai', () => ({
  isConfigured:      jest.fn(() => false),
  streamChat:        jest.fn(),
  suggestShell:      jest.fn(),
  streamLogAnalysis: jest.fn(),
}));

const request = require('supertest');
const { createApp } = require('../server');
const ai = require('../ai');

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
afterEach(() => jest.clearAllMocks());

test('GET /api/health returns 200 without auth (ai disabled)', async () => {
  ai.isConfigured.mockReturnValue(false);
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok', ai: 'disabled' });
});

test('GET /api/health reports ai:"configured" when configured', async () => {
  ai.isConfigured.mockReturnValue(true);
  const res = await request(app).get('/api/health');
  expect(res.body).toEqual({ status: 'ok', ai: 'configured' });
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

// ── AI routes ───────────────────────────────────────────────────────────────

test('POST /api/ai/chat requires x-api-key', async () => {
  const res = await request(app).post('/api/ai/chat').send({ messages: [] });
  expect(res.status).toBe(401);
});

test('POST /api/ai/chat returns 503 when AI unconfigured', async () => {
  ai.isConfigured.mockReturnValue(false);
  const res = await request(app)
    .post('/api/ai/chat')
    .set('x-api-key', testConfig.apiKey)
    .send({ messages: [{ role: 'user', content: 'hi' }] });
  expect(res.status).toBe(503);
  expect(res.body).toEqual({ error: 'AI not configured' });
});

test('POST /api/ai/chat 400s on empty messages', async () => {
  ai.isConfigured.mockReturnValue(true);
  const res = await request(app)
    .post('/api/ai/chat')
    .set('x-api-key', testConfig.apiKey)
    .send({ messages: [] });
  expect(res.status).toBe(400);
});

test('POST /api/ai/chat streams SSE envelope from streamChat', async () => {
  ai.isConfigured.mockReturnValue(true);
  ai.streamChat.mockImplementation(async function* () {
    yield { delta: 'Hello' };
    yield { delta: ' world' };
    yield { done: true, usage: { prompt_tokens: 1 } };
  });
  const res = await request(app)
    .post('/api/ai/chat')
    .set('x-api-key', testConfig.apiKey)
    .send({ messages: [{ role: 'user', content: 'hi' }] });
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toContain('text/event-stream');
  expect(res.text).toContain('data: {"delta":"Hello"}');
  expect(res.text).toContain('data: {"delta":" world"}');
  expect(res.text).toContain('data: [DONE]');
});

test('POST /api/ai/chat surfaces upstream errors as a final error event with a generic message (no upstream body echo)', async () => {
  ai.isConfigured.mockReturnValue(true);
  ai.streamChat.mockImplementation(async function* () {
    throw Object.assign(new Error('upstream HTTP 500'), { name: 'UpstreamError', status: 500 });
  });
  const res = await request(app)
    .post('/api/ai/chat')
    .set('x-api-key', testConfig.apiKey)
    .send({ messages: [{ role: 'user', content: 'hi' }] });
  expect(res.status).toBe(200);
  expect(res.text).toContain('"error":"AI temporarily unavailable"');
  expect(res.text).not.toContain('upstream HTTP 500');
  expect(res.text).toContain('data: [DONE]');
});

test('POST /api/ai/chat maps upstream 401/403 to "AI auth failed"', async () => {
  ai.isConfigured.mockReturnValue(true);
  ai.streamChat.mockImplementation(async function* () {
    throw Object.assign(new Error('upstream HTTP 401'), { name: 'UpstreamError', status: 401 });
  });
  const res = await request(app)
    .post('/api/ai/chat')
    .set('x-api-key', testConfig.apiKey)
    .send({ messages: [{ role: 'user', content: 'hi' }] });
  expect(res.text).toContain('"error":"AI auth failed"');
});

test('POST /api/ai/shell returns parsed object', async () => {
  ai.isConfigured.mockReturnValue(true);
  ai.suggestShell.mockResolvedValue({ command: 'ls', explanation: 'x', danger: 'safe' });
  const res = await request(app)
    .post('/api/ai/shell')
    .set('x-api-key', testConfig.apiKey)
    .send({ intent: 'list files' });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ command: 'ls', explanation: 'x', danger: 'safe' });
});

test('POST /api/ai/shell maps malformed upstream output to 502 with generic message', async () => {
  ai.isConfigured.mockReturnValue(true);
  ai.suggestShell.mockRejectedValue(new Error('AI returned malformed shell suggestion'));
  const res = await request(app)
    .post('/api/ai/shell')
    .set('x-api-key', testConfig.apiKey)
    .send({ intent: 'list files' });
  expect(res.status).toBe(502);
  expect(res.body).toEqual({ error: 'AI returned malformed response' });
});

test('POST /api/ai/shell maps upstream 429 to 429 with retry-after passthrough', async () => {
  ai.isConfigured.mockReturnValue(true);
  ai.suggestShell.mockRejectedValue(
    Object.assign(new Error('upstream HTTP 429'), { name: 'UpstreamError', status: 429, retryAfter: '7' })
  );
  const res = await request(app)
    .post('/api/ai/shell')
    .set('x-api-key', testConfig.apiKey)
    .send({ intent: 'list files' });
  expect(res.status).toBe(429);
  expect(res.headers['retry-after']).toBe('7');
  expect(res.body).toEqual({ error: 'AI rate limited' });
});

test('POST /api/ai/shell maps upstream 401/403 to 502 "AI auth failed" without echoing the upstream body', async () => {
  ai.isConfigured.mockReturnValue(true);
  ai.suggestShell.mockRejectedValue(
    Object.assign(new Error('upstream HTTP 401'), { name: 'UpstreamError', status: 401 })
  );
  const res = await request(app)
    .post('/api/ai/shell')
    .set('x-api-key', testConfig.apiKey)
    .send({ intent: 'list files' });
  expect(res.status).toBe(502);
  expect(res.body).toEqual({ error: 'AI auth failed' });
});

test('POST /api/ai/shell 400s on missing intent', async () => {
  ai.isConfigured.mockReturnValue(true);
  const res = await request(app)
    .post('/api/ai/shell')
    .set('x-api-key', testConfig.apiKey)
    .send({});
  expect(res.status).toBe(400);
});

test('POST /api/ai/analyze-logs streams SSE envelope', async () => {
  ai.isConfigured.mockReturnValue(true);
  ai.streamLogAnalysis.mockImplementation(async function* () {
    yield { delta: 'Summary' };
    yield { done: true, usage: null };
  });
  const res = await request(app)
    .post('/api/ai/analyze-logs')
    .set('x-api-key', testConfig.apiKey)
    .send({ lines: ['line1', 'line2'] });
  expect(res.status).toBe(200);
  expect(res.text).toContain('data: {"delta":"Summary"}');
  expect(res.text).toContain('data: [DONE]');
});

test('POST /api/ai/analyze-logs 400s on empty lines', async () => {
  ai.isConfigured.mockReturnValue(true);
  const res = await request(app)
    .post('/api/ai/analyze-logs')
    .set('x-api-key', testConfig.apiKey)
    .send({ lines: [] });
  expect(res.status).toBe(400);
});

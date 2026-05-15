const fs = require('fs');
const path = require('path');
const os = require('os');

// We point configstore at a tempfile via NAS_CONFIG_PATH so the tests
// never touch the real backend/config.json. resetModules between tests
// makes sure each test loads a fresh copy with its own path.
let TMP, CFG;
beforeEach(() => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nas-cfg-'));
  CFG = path.join(TMP, 'config.json');
  fs.writeFileSync(CFG, JSON.stringify({
    apiKey: 'server-key',
    port: 3001,
    ai: { provider: 'anthropic', apiKey: 'sk-ant-existing', chatModel: 'claude-sonnet-4-6' },
    media: { emby: { url: 'http://e', apiKey: 'emby-key' } },
  }, null, 2));
  process.env.NAS_CONFIG_PATH = CFG;
  jest.resetModules();
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  delete process.env.NAS_CONFIG_PATH;
});

function load() { return require('../configstore'); }

test('redactConfig masks apiKey fields recursively without exposing values', () => {
  const { redactConfig } = load();
  const out = redactConfig({
    apiKey: 'top-secret',
    ai: { apiKey: 'sk-anthropic', provider: 'anthropic' },
    media: { emby: { apiKey: '' }, radarr: { apiKey: 'rad-key' } },
  });
  expect(out.apiKey).toBe('__set__');
  expect(out.ai.apiKey).toBe('__set__');
  expect(out.ai.provider).toBe('anthropic');
  expect(out.media.emby.apiKey).toBe(''); // blank stays blank
  expect(out.media.radarr.apiKey).toBe('__set__');
});

test('patchAiConfig writes only whitelisted keys and preserves the rest', () => {
  const { patchAiConfig, readConfig } = load();
  const next = patchAiConfig({
    provider:  'openai',
    chatModel: 'gpt-4o',
    apiKey:    'sk-openai-new',
    port:      9999,
    bogus:     'lol',
  });
  expect(next.ai.provider).toBe('openai');
  expect(next.ai.chatModel).toBe('gpt-4o');
  expect(next.ai.apiKey).toBe('sk-openai-new');
  expect(next.port).toBe(3001);
  expect(next.ai.bogus).toBeUndefined();

  // Persisted to disk.
  const reread = readConfig();
  expect(reread.ai.provider).toBe('openai');
});

test('patchAiConfig ignores the "__set__" sentinel for apiKey', () => {
  const { patchAiConfig } = load();
  const next = patchAiConfig({ apiKey: '__set__', provider: 'openai' });
  expect(next.ai.apiKey).toBe('sk-ant-existing');
  expect(next.ai.provider).toBe('openai');
});

test('writeConfigAtomic uses rename so partial writes can never corrupt config', () => {
  const { writeConfigAtomic, readConfig } = load();
  writeConfigAtomic({ apiKey: 'k', port: 3001, ai: {} });
  // The tmp file should be gone (renamed away).
  const leftovers = fs.readdirSync(TMP).filter(n => n.includes('.tmp.'));
  expect(leftovers).toEqual([]);
  expect(readConfig().port).toBe(3001);
});

test('readConfig returns the on-disk JSON', () => {
  const { readConfig } = load();
  const cfg = readConfig();
  expect(cfg.ai.provider).toBe('anthropic');
  expect(cfg.port).toBe(3001);
});

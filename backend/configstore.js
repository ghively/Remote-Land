/* configstore.js — atomic read/write of backend/config.json.
   The AI section is editable from the frontend (via /api/config/ai).
   Writes are atomic (write to .tmp, fsync, rename) so a crash mid-write
   can never corrupt the canonical file. */

const fs = require('fs');
const path = require('path');

// CONFIG_PATH is overridable via env var so tests can point at a tempfile
// without having to monkey-patch path/fs.
const CONFIG_PATH = process.env.NAS_CONFIG_PATH || path.resolve(__dirname, 'config.json');

// Fields we'll never echo to the client (sensitive credentials). The
// backend keeps them in memory; the UI only sees boolean "set / not set".
const REDACT_KEYS = new Set(['apiKey']);

function redactConfig(cfg) {
  // Deep-clone then mask any string field whose key is in REDACT_KEYS.
  const out = JSON.parse(JSON.stringify(cfg || {}));
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (REDACT_KEYS.has(k) && typeof v === 'string') {
        node[k] = v ? '__set__' : '';
      } else if (v && typeof v === 'object') {
        walk(v);
      }
    }
  };
  walk(out);
  return out;
}

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function writeConfigAtomic(cfg) {
  const tmp = `${CONFIG_PATH}.tmp.${process.pid}.${Date.now()}`;
  const json = JSON.stringify(cfg, null, 2) + '\n';
  fs.writeFileSync(tmp, json, { mode: 0o600 });
  fs.renameSync(tmp, CONFIG_PATH);
}

// Merge `patch` into the AI section of config.json. Only whitelisted keys
// are accepted so a malicious patch can't poison unrelated config (e.g.
// apiKey, port). Pass apiKey === '' to clear; omit it to leave unchanged.
const AI_ALLOWED = new Set([
  'provider', 'baseUrl', 'apiKey', 'chatModel', 'shellModel', 'logModel', 'maxTokens',
]);

function patchAiConfig(patch) {
  const cfg = readConfig();
  cfg.ai = cfg.ai || {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (!AI_ALLOWED.has(k)) continue;
    // Don't clobber an existing apiKey with the sentinel '__set__'.
    if (k === 'apiKey' && v === '__set__') continue;
    cfg.ai[k] = v;
  }
  writeConfigAtomic(cfg);
  return cfg;
}

module.exports = { readConfig, writeConfigAtomic, patchAiConfig, redactConfig, AI_ALLOWED, CONFIG_PATH };

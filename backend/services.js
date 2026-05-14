/* services.js — systemctl wrapper.
   list() returns visible systemd units (no sudo). Action endpoints
   (start/stop/restart/enable/disable) succeed only if the agent's user
   has rights — typically passwordless sudo or a polkit rule. We surface
   stderr in the error response so the UI can show actionable feedback. */

const { execFile } = require('child_process');

function run(cmd, args, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr && stderr.trim()) || err.message;
        reject(Object.assign(new Error(msg), { code: err.code, stderr }));
        return;
      }
      resolve(stdout);
    });
  });
}

function parseList(text) {
  // Lines from `systemctl list-units --type=service --no-pager --no-legend --plain`
  // look like: "ssh.service loaded active running OpenBSD Secure Shell server"
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/\s+/);
      if (parts.length < 4) return null;
      const [unit, load, active, sub, ...descParts] = parts;
      return {
        name: unit.replace(/\.service$/, ''),
        unit,
        load, active, sub,
        description: descParts.join(' '),
        running: active === 'active' && sub === 'running',
      };
    })
    .filter(Boolean);
}

async function list({ type = 'service', state = 'all' } = {}) {
  const args = [
    'list-units',
    `--type=${type}`,
    '--no-pager', '--no-legend', '--plain',
    '--all',
  ];
  const out = await run('systemctl', args);
  let units = parseList(out);
  if (state === 'running')      units = units.filter(u => u.running);
  else if (state === 'failed')  units = units.filter(u => u.active === 'failed' || u.sub === 'failed');
  return units;
}

async function status(name) {
  const out = await run('systemctl', ['show', name, '--property=ActiveState,SubState,LoadState,Description,UnitFileState']);
  const props = {};
  out.split('\n').forEach(line => {
    const i = line.indexOf('=');
    if (i > 0) props[line.slice(0, i)] = line.slice(i + 1);
  });
  return {
    name: name.replace(/\.service$/, ''),
    unit: name.endsWith('.service') ? name : `${name}.service`,
    active: props.ActiveState || 'unknown',
    sub: props.SubState || '',
    load: props.LoadState || '',
    enabled: props.UnitFileState || '',
    description: props.Description || '',
  };
}

async function action(name, verb) {
  const allowed = new Set(['start', 'stop', 'restart', 'reload', 'enable', 'disable']);
  if (!allowed.has(verb)) throw Object.assign(new Error(`unknown verb "${verb}"`), { code: 'EBADVERB' });
  if (!/^[a-z0-9@_.:-]+$/i.test(name)) throw Object.assign(new Error('bad unit name'), { code: 'EBADNAME' });
  await run('systemctl', [verb, name]);
  return { ok: true, name, verb };
}

async function recentLogs(name, lines = 100) {
  if (!/^[a-z0-9@_.:-]+$/i.test(name)) throw Object.assign(new Error('bad unit name'), { code: 'EBADNAME' });
  const out = await run('journalctl', ['-u', name, '-n', String(lines), '--no-pager', '--output=short']);
  return out;
}

module.exports = { list, status, action, recentLogs };

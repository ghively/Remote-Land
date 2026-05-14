/* cron.js — User crontab read/write.
   Reads via `crontab -l`; writes via `crontab -` with the new body on
   stdin. Operates strictly on the agent's own user crontab — never
   touches /etc/crontab or /etc/cron.d. */

const { execFile, spawn } = require('child_process');

function exec(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 4000, maxBuffer: 1 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        // crontab -l exits with 1 when there is no crontab. Treat that as empty.
        if (/no crontab/i.test(stderr || '')) resolve('');
        else reject(Object.assign(new Error((stderr || '').trim() || err.message), { code: err.code }));
      } else {
        resolve(stdout);
      }
    });
  });
}

function parseLine(line, idx) {
  const trimmed = line.trim();
  if (!trimmed) return { type: 'blank', line: '', idx };
  if (trimmed.startsWith('#')) return { type: 'comment', line, idx };
  // Match either "@reboot cmd" / "@hourly cmd" / etc. or the standard
  // 5-field schedule.
  const special = trimmed.match(/^(@(?:reboot|yearly|annually|monthly|weekly|daily|hourly))\s+(.+)$/);
  if (special) return { type: 'job', idx, schedule: special[1], command: special[2], line };
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 6) {
    return {
      type: 'job', idx, line,
      schedule: parts.slice(0, 5).join(' '),
      command: parts.slice(5).join(' '),
    };
  }
  return { type: 'unknown', line, idx };
}

async function read() {
  const raw = await exec('crontab', ['-l']);
  const lines = raw.split('\n');
  // Drop trailing blank that always appears.
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return {
    raw,
    entries: lines.map(parseLine),
  };
}

function write(body) {
  return new Promise((resolve, reject) => {
    if (typeof body !== 'string') return reject(new Error('body must be a string'));
    // Crontab files MUST end with a newline.
    const text = body.endsWith('\n') ? body : (body + '\n');
    const child = spawn('crontab', ['-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve({ ok: true });
      else reject(new Error(stderr.trim() || `crontab exited ${code}`));
    });
    child.stdin.end(text);
  });
}

module.exports = { read, write };

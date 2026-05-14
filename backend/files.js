/* files.js — File manager backend.
   Read-and-write operations on the server filesystem, scoped only by Unix
   permissions of the account running the agent (no extra sandboxing — the
   API key holder is trusted). Paths must be absolute and free of '..'. */

const fs = require('fs').promises;
const path = require('path');
const fssync = require('fs');

function safePath(p) {
  if (typeof p !== 'string' || !p.startsWith('/')) {
    const err = new Error('absolute path required');
    err.code = 'EBADPATH';
    throw err;
  }
  const norm = path.posix.normalize(p);
  if (norm === '/..' || norm.startsWith('/../') || norm.includes('/../')) {
    const err = new Error('path traversal rejected');
    err.code = 'EBADPATH';
    throw err;
  }
  return norm;
}

function permString(mode, isDir) {
  const triplet = (n) => `${n & 4 ? 'r' : '-'}${n & 2 ? 'w' : '-'}${n & 1 ? 'x' : '-'}`;
  return (isDir ? 'd' : '-')
    + triplet((mode >> 6) & 7)
    + triplet((mode >> 3) & 7)
    + triplet(mode & 7);
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

function fmtMtime(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')} ${hh}:${mm}`;
}

async function list(dir) {
  const root = safePath(dir);
  const names = await fs.readdir(root);
  const out = await Promise.all(names.map(async (name) => {
    const full = path.posix.join(root, name);
    try {
      const st = await fs.lstat(full);
      const isDir = st.isDirectory();
      return {
        name,
        type: isDir ? 'dir' : (st.isSymbolicLink() ? 'link' : 'file'),
        size: isDir ? '-' : fmtSize(st.size),
        bytes: st.size,
        perms: permString(st.mode, isDir),
        modified: fmtMtime(st.mtime),
      };
    } catch (_) {
      return { name, type: 'file', size: '?', perms: '----------', modified: '' };
    }
  }));
  out.sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    return a.name.localeCompare(b.name);
  });
  return { path: root, entries: out };
}

async function mkdir(p) {
  const target = safePath(p);
  await fs.mkdir(target, { recursive: false });
  return { ok: true, path: target };
}

async function rm(p) {
  const target = safePath(p);
  if (target === '/' || target === '/root' || target === '/etc') {
    const err = new Error('refusing to delete protected path');
    err.code = 'EPROTECTED';
    throw err;
  }
  const st = await fs.lstat(target);
  if (st.isDirectory()) await fs.rm(target, { recursive: true, force: false });
  else await fs.unlink(target);
  return { ok: true, path: target };
}

async function rename(from, to) {
  const src = safePath(from);
  const dst = safePath(to);
  await fs.rename(src, dst);
  return { ok: true, from: src, to: dst };
}

async function readText(p, maxBytes = 256 * 1024) {
  const target = safePath(p);
  const st = await fs.stat(target);
  if (st.size > maxBytes) {
    const err = new Error(`file too large (${fmtSize(st.size)} > ${fmtSize(maxBytes)})`);
    err.code = 'ETOOLARGE';
    throw err;
  }
  const buf = await fs.readFile(target);
  return { path: target, size: st.size, content: buf.toString('utf8') };
}

function streamFile(p, res) {
  const target = safePath(p);
  const st = fssync.statSync(target);
  if (!st.isFile()) throw new Error('not a file');
  res.setHeader('content-length', st.size);
  res.setHeader('content-type', 'application/octet-stream');
  res.setHeader('content-disposition', `attachment; filename="${path.basename(target).replace(/"/g, '')}"`);
  fssync.createReadStream(target).pipe(res);
}

module.exports = { list, mkdir, rm, rename, readText, streamFile, safePath };

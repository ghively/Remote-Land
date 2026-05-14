jest.mock('fs', () => {
  const lstat = jest.fn();
  const stat = jest.fn();
  const readdir = jest.fn();
  const mkdir = jest.fn();
  const rm = jest.fn();
  const unlink = jest.fn();
  const rename = jest.fn();
  const readFile = jest.fn();
  return {
    promises: { lstat, stat, readdir, mkdir, rm, unlink, rename, readFile },
    statSync: jest.fn(),
    createReadStream: jest.fn(),
  };
});

const fs = require('fs');
const files = require('../files');

beforeEach(() => jest.clearAllMocks());

describe('safePath', () => {
  test('accepts plain absolute paths', () => {
    expect(files.safePath('/home/user/x')).toBe('/home/user/x');
    expect(files.safePath('/etc')).toBe('/etc');
  });
  test('normalises ./ segments', () => {
    expect(files.safePath('/home/./user')).toBe('/home/user');
  });
  test('rejects relative paths', () => {
    expect(() => files.safePath('home/user')).toThrow(/absolute path required/);
    expect(() => files.safePath('')).toThrow(/absolute path required/);
    expect(() => files.safePath(null)).toThrow(/absolute path required/);
  });
  test('rejects path traversal', () => {
    expect(() => files.safePath('/home/../etc/shadow')).toThrow(/traversal/);
    expect(() => files.safePath('/../etc')).toThrow(/traversal/);
  });
});

describe('list', () => {
  test('returns sorted dir-first entries with permission strings', async () => {
    fs.promises.readdir.mockResolvedValue(['file.txt', 'subdir', 'aaa']);
    fs.promises.lstat.mockImplementation((p) => Promise.resolve({
      isDirectory: () => p.endsWith('subdir'),
      isSymbolicLink: () => false,
      size: p.endsWith('file.txt') ? 1500 : 0,
      // owner rwx, group rx, world rx → 0o755
      mode: p.endsWith('subdir') ? 0o40755 : 0o100644,
      mtime: new Date('2026-05-07T03:14:00Z'),
    }));
    const out = await files.list('/home');
    expect(out.path).toBe('/home');
    expect(out.entries.map(e => e.name)).toEqual(['subdir', 'aaa', 'file.txt']);
    const sub = out.entries[0];
    expect(sub.type).toBe('dir');
    expect(sub.perms.startsWith('d')).toBe(true);
    const file = out.entries[2];
    expect(file.type).toBe('file');
    expect(file.size).toMatch(/K$/);
    expect(file.perms.startsWith('-')).toBe(true);
  });

  test('tolerates lstat failures on individual entries', async () => {
    fs.promises.readdir.mockResolvedValue(['ok', 'broken']);
    fs.promises.lstat.mockImplementation((p) => p.endsWith('broken')
      ? Promise.reject(new Error('EACCES'))
      : Promise.resolve({ isDirectory: () => false, isSymbolicLink: () => false, size: 10, mode: 0o100644, mtime: new Date() }));
    const out = await files.list('/x');
    expect(out.entries).toHaveLength(2);
    expect(out.entries.find(e => e.name === 'broken').perms).toBe('----------');
  });
});

describe('mkdir', () => {
  test('creates a single directory non-recursively', async () => {
    fs.promises.mkdir.mockResolvedValue(undefined);
    const out = await files.mkdir('/tmp/new');
    expect(fs.promises.mkdir).toHaveBeenCalledWith('/tmp/new', { recursive: false });
    expect(out).toEqual({ ok: true, path: '/tmp/new' });
  });
  test('rejects path traversal before touching fs', async () => {
    await expect(files.mkdir('/tmp/../etc')).rejects.toThrow(/traversal/);
    expect(fs.promises.mkdir).not.toHaveBeenCalled();
  });
});

describe('rm', () => {
  test('unlinks a regular file', async () => {
    fs.promises.lstat.mockResolvedValue({ isDirectory: () => false });
    fs.promises.unlink.mockResolvedValue(undefined);
    const out = await files.rm('/tmp/junk');
    expect(fs.promises.unlink).toHaveBeenCalledWith('/tmp/junk');
    expect(out).toEqual({ ok: true, path: '/tmp/junk' });
  });
  test('recursively removes a directory', async () => {
    fs.promises.lstat.mockResolvedValue({ isDirectory: () => true });
    fs.promises.rm.mockResolvedValue(undefined);
    await files.rm('/tmp/dir');
    expect(fs.promises.rm).toHaveBeenCalledWith('/tmp/dir', { recursive: true, force: false });
  });
  test.each(['/', '/root', '/etc'])('refuses to delete protected path %s', async (p) => {
    await expect(files.rm(p)).rejects.toThrow(/protected/);
  });
});

describe('rename', () => {
  test('moves from src to dst when both paths are safe', async () => {
    fs.promises.rename.mockResolvedValue(undefined);
    const out = await files.rename('/a/x', '/a/y');
    expect(fs.promises.rename).toHaveBeenCalledWith('/a/x', '/a/y');
    expect(out).toEqual({ ok: true, from: '/a/x', to: '/a/y' });
  });
  test('rejects traversal in either path', async () => {
    await expect(files.rename('/a/../etc', '/b')).rejects.toThrow(/traversal/);
    await expect(files.rename('/a', '/../etc')).rejects.toThrow(/traversal/);
  });
});

describe('readText', () => {
  test('returns small text files inline', async () => {
    fs.promises.stat.mockResolvedValue({ size: 100 });
    fs.promises.readFile.mockResolvedValue(Buffer.from('hello world'));
    const out = await files.readText('/tmp/x.txt');
    expect(out).toEqual({ path: '/tmp/x.txt', size: 100, content: 'hello world' });
  });
  test('refuses files above the size cap', async () => {
    fs.promises.stat.mockResolvedValue({ size: 10 * 1024 * 1024 });
    await expect(files.readText('/tmp/big')).rejects.toThrow(/too large/);
    expect(fs.promises.readFile).not.toHaveBeenCalled();
  });
});

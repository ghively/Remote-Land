const { EventEmitter } = require('events');

jest.mock('child_process', () => ({
  execFile: jest.fn(),
  spawn: jest.fn(),
}));

const cp = require('child_process');
const cron = require('../cron');

function mockExec(stdout, stderr = '', error = null) {
  cp.execFile.mockImplementation((cmd, args, opts, cb) => {
    if (error) cb(Object.assign(new Error(error), { code: 1 }), stdout, stderr);
    else cb(null, stdout, stderr);
  });
}

beforeEach(() => jest.clearAllMocks());

describe('read', () => {
  test('parses a standard 5-field crontab', async () => {
    mockExec([
      '# Daily backup',
      '0 2 * * * /root/backup.sh',
      '*/5 * * * * df -h >> /var/log/disk.log',
      '@reboot /usr/local/bin/start-me',
      '',
    ].join('\n') + '\n');
    const out = await cron.read();
    expect(out.entries).toHaveLength(5);

    const [comment, job1, job2, special, blank] = out.entries;
    expect(comment).toMatchObject({ type: 'comment' });
    expect(job1).toMatchObject({ type: 'job', schedule: '0 2 * * *', command: '/root/backup.sh' });
    expect(job2.schedule).toBe('*/5 * * * *');
    expect(special).toMatchObject({ type: 'job', schedule: '@reboot', command: '/usr/local/bin/start-me' });
    expect(blank.type).toBe('blank');
  });

  test('returns empty raw when user has no crontab', async () => {
    cp.execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(Object.assign(new Error('exit 1'), { code: 1 }), '', 'no crontab for user');
    });
    const out = await cron.read();
    expect(out.raw).toBe('');
    expect(out.entries).toEqual([]);
  });

  test('surfaces unexpected crontab errors', async () => {
    cp.execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(Object.assign(new Error('exit 1'), { code: 1 }), '', 'permission denied');
    });
    await expect(cron.read()).rejects.toThrow(/permission denied/);
  });
});

describe('write', () => {
  function fakeChild(exitCode = 0, stderr = '') {
    const child = new EventEmitter();
    child.stdin = { end: jest.fn() };
    child.stderr = new EventEmitter();
    process.nextTick(() => {
      if (stderr) child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', exitCode);
    });
    return child;
  }

  test('writes body to crontab via stdin', async () => {
    const child = fakeChild(0);
    cp.spawn.mockReturnValue(child);
    const out = await cron.write('0 2 * * * /root/backup.sh');
    expect(cp.spawn).toHaveBeenCalledWith('crontab', ['-'], expect.any(Object));
    expect(child.stdin.end).toHaveBeenCalledWith('0 2 * * * /root/backup.sh\n');
    expect(out).toEqual({ ok: true });
  });

  test('appends a trailing newline if missing', async () => {
    const child = fakeChild(0);
    cp.spawn.mockReturnValue(child);
    await cron.write('* * * * * date');
    expect(child.stdin.end).toHaveBeenCalledWith('* * * * * date\n');
  });

  test('keeps existing trailing newline', async () => {
    const child = fakeChild(0);
    cp.spawn.mockReturnValue(child);
    await cron.write('* * * * * date\n');
    expect(child.stdin.end).toHaveBeenCalledWith('* * * * * date\n');
  });

  test('rejects non-string body', async () => {
    await expect(cron.write(undefined)).rejects.toThrow(/must be a string/);
    await expect(cron.write(123)).rejects.toThrow(/must be a string/);
    expect(cp.spawn).not.toHaveBeenCalled();
  });

  test('rejects on non-zero exit + surfaces stderr', async () => {
    const child = fakeChild(1, 'invalid schedule');
    cp.spawn.mockReturnValue(child);
    await expect(cron.write('not valid cron')).rejects.toThrow(/invalid schedule/);
  });
});

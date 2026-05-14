jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));
const { execFile } = require('child_process');
const services = require('../services');

// Helper: queue a sequence of fake execFile responses so each call sees the
// next one. execFile signature: (cmd, args, opts, cb).
function queueExec(responses) {
  let i = 0;
  execFile.mockImplementation((cmd, args, opts, cb) => {
    const r = responses[Math.min(i++, responses.length - 1)] || { stdout: '' };
    if (r.error) {
      const err = Object.assign(new Error(r.error), { code: r.code || 1 });
      cb(err, '', r.stderr || r.error);
    } else {
      cb(null, r.stdout || '', r.stderr || '');
    }
  });
}

beforeEach(() => jest.clearAllMocks());

describe('list', () => {
  test('parses systemctl list-units output into objects', async () => {
    queueExec([{
      stdout: [
        'ssh.service       loaded active   running OpenBSD Secure Shell server',
        'docker.service    loaded active   running Docker Application Container Engine',
        'snapd.service     loaded inactive dead    Snap Daemon',
      ].join('\n') + '\n',
    }]);
    const out = await services.list();
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({
      name: 'ssh', unit: 'ssh.service', active: 'active', sub: 'running', running: true,
      description: 'OpenBSD Secure Shell server',
    });
    expect(out[2].running).toBe(false);
    // The args passed to systemctl should include --type filter.
    const callArgs = execFile.mock.calls[0][1];
    expect(callArgs).toEqual(expect.arrayContaining(['list-units', '--type=service', '--all']));
  });

  test('state=running filter keeps only active+running units', async () => {
    queueExec([{
      stdout: [
        'a.service loaded active   running A',
        'b.service loaded inactive dead    B',
      ].join('\n'),
    }]);
    const out = await services.list({ state: 'running' });
    expect(out.map(u => u.name)).toEqual(['a']);
  });
});

describe('status', () => {
  test('parses systemctl show key=value output', async () => {
    queueExec([{
      stdout: [
        'ActiveState=active',
        'SubState=running',
        'LoadState=loaded',
        'Description=OpenBSD Secure Shell server',
        'UnitFileState=enabled',
      ].join('\n'),
    }]);
    const out = await services.status('ssh');
    expect(out).toMatchObject({
      name: 'ssh', unit: 'ssh.service', active: 'active', sub: 'running',
      enabled: 'enabled', description: 'OpenBSD Secure Shell server',
    });
  });
});

describe('action', () => {
  test.each(['start', 'stop', 'restart', 'reload', 'enable', 'disable'])(
    'invokes systemctl %s with the unit name',
    async (verb) => {
      queueExec([{ stdout: '' }]);
      const out = await services.action('ssh.service', verb);
      expect(out).toEqual({ ok: true, name: 'ssh.service', verb });
      const args = execFile.mock.calls[0][1];
      expect(args).toEqual([verb, 'ssh.service']);
    }
  );

  test('rejects unknown verbs before shelling out', async () => {
    await expect(services.action('ssh.service', 'destroy')).rejects.toThrow(/unknown verb/);
    expect(execFile).not.toHaveBeenCalled();
  });

  test('rejects bad unit names (shell metachars)', async () => {
    await expect(services.action('ssh; rm -rf /', 'start')).rejects.toThrow(/bad unit name/);
    expect(execFile).not.toHaveBeenCalled();
  });

  test('surfaces stderr on failure', async () => {
    queueExec([{ error: 'Failed to start ssh.service', stderr: 'Access denied', code: 5 }]);
    await expect(services.action('ssh', 'start')).rejects.toThrow(/Access denied/);
  });
});

describe('recentLogs', () => {
  test('shells out to journalctl with -n N', async () => {
    queueExec([{ stdout: 'May 07 12:00:00 host ssh[1]: Accepted publickey\n' }]);
    const out = await services.recentLogs('ssh.service', 50);
    expect(out).toMatch(/Accepted publickey/);
    const args = execFile.mock.calls[0][1];
    expect(args).toEqual(['-u', 'ssh.service', '-n', '50', '--no-pager', '--output=short']);
  });

  test('rejects bad unit names', async () => {
    await expect(services.recentLogs('foo|bar', 10)).rejects.toThrow(/bad unit name/);
  });
});

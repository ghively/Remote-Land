jest.mock('child_process', () => ({ execFile: jest.fn() }));
jest.mock('os', () => ({
  networkInterfaces: jest.fn(),
}));

const { execFile } = require('child_process');
const os = require('os');
const network = require('../network');

function execResponder(handler) {
  execFile.mockImplementation((cmd, args, opts, cb) => {
    const r = handler(cmd, args) || { stdout: '' };
    if (r.error) cb(new Error(r.error), '', r.stderr || r.error);
    else cb(null, r.stdout || '', '');
  });
}

beforeEach(() => jest.clearAllMocks());

describe('interfaces', () => {
  test('flattens os.networkInterfaces into a list', async () => {
    os.networkInterfaces.mockReturnValue({
      lo: [{ address: '127.0.0.1', family: 'IPv4', cidr: '127.0.0.1/8', mac: '00:00:00:00:00:00', internal: true }],
      eth0: [{ address: '192.168.1.100', family: 'IPv4', cidr: '192.168.1.100/24', mac: 'a8:b3:54:fe:dc:ba', internal: false }],
    });
    const out = await network.interfaces();
    expect(out.find(i => i.name === 'eth0').addresses[0].address).toBe('192.168.1.100');
    expect(out.find(i => i.name === 'lo').addresses[0].internal).toBe(true);
  });
});

describe('neighbors', () => {
  test('parses `ip neigh show` into {ip, iface, mac, state} rows', async () => {
    execResponder(() => ({
      stdout: [
        '192.168.1.1 dev eth0 lladdr 5c:5b:35:11:22:33 REACHABLE',
        '192.168.1.42 dev eth0 lladdr b8:27:eb:ab:cd:ef STALE',
        'fe80::1 dev eth0  router REACHABLE',
      ].join('\n'),
    }));
    const out = await network.neighbors();
    expect(out).toEqual(expect.arrayContaining([
      expect.objectContaining({ ip: '192.168.1.1', iface: 'eth0', mac: '5c:5b:35:11:22:33', state: 'REACHABLE' }),
      expect.objectContaining({ ip: '192.168.1.42', state: 'STALE' }),
    ]));
  });

  test('returns [] when ip is missing or fails', async () => {
    execResponder(() => ({ error: 'ENOENT' }));
    const out = await network.neighbors();
    expect(out).toEqual([]);
  });
});

describe('connections', () => {
  test('parses `ss -tunaH` into socket rows', async () => {
    execResponder((cmd, args) => {
      expect(cmd).toBe('ss');
      expect(args).toEqual(['-tunaH']);
      return {
        stdout: [
          'tcp ESTAB 0 0 192.168.1.100:22       192.168.1.42:54321',
          'udp UNCONN 0 0 0.0.0.0:5353           0.0.0.0:*',
        ].join('\n'),
      };
    });
    const out = await network.connections();
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ proto: 'tcp', state: 'ESTAB' });
  });

  test('honors limit option', async () => {
    execResponder(() => ({ stdout: Array.from({ length: 200 }, (_, i) => `tcp ESTAB 0 0 a:${i} b:1`).join('\n') }));
    const out = await network.connections({ limit: 10 });
    expect(out).toHaveLength(10);
  });

  test('returns [] when ss fails', async () => {
    execResponder(() => ({ error: 'ENOENT' }));
    expect(await network.connections()).toEqual([]);
  });
});

describe('snapshot', () => {
  test('combines interfaces + neighbors + connections', async () => {
    os.networkInterfaces.mockReturnValue({ eth0: [] });
    execResponder((cmd) => {
      if (cmd === 'ip') return { stdout: '192.168.1.1 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE\n' };
      if (cmd === 'ss') return { stdout: 'tcp ESTAB 0 0 a:1 b:2\n' };
      return { stdout: '' };
    });
    const snap = await network.snapshot();
    expect(snap.interfaces[0].name).toBe('eth0');
    expect(snap.neighbors[0].ip).toBe('192.168.1.1');
    expect(snap.connections).toHaveLength(1);
  });
});

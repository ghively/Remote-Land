const { parseCpuLine, parseMemInfo, parseNetDev } = require('../system');

test('parseCpuLine extracts busy and total from /proc/stat line', () => {
  // cpu  user nice system idle iowait irq softirq steal ...
  const line = 'cpu  100 10 50 800 5 2 3 0 0 0';
  const result = parseCpuLine(line);
  // total = 100+10+50+800+5+2+3 = 970
  // busy  = 100+10+50+2+3 = 165  (excl idle, iowait)
  expect(result.total).toBe(970);
  expect(result.busy).toBe(165);
});

test('parseMemInfo returns used RAM in bytes from /proc/meminfo', () => {
  const content = [
    'MemTotal:       16384000 kB',
    'MemFree:         4096000 kB',
    'Buffers:          512000 kB',
    'Cached:          4096000 kB',
    'SwapTotal:       2097152 kB',
  ].join('\n');
  const result = parseMemInfo(content);
  expect(result.total).toBe(16384000 * 1024);
  // used = MemTotal - MemFree - Buffers - Cached
  expect(result.used).toBe((16384000 - 4096000 - 512000 - 4096000) * 1024);
});

test('parseNetDev parses rx and tx bytes per interface', () => {
  const content = [
    'Inter-|   Receive    |  Transmit',
    ' face |bytes packets |bytes packets',
    '  eth0: 12345678    1000    0    0    0     0    0    0  87654321   500    0    0    0     0    0    0',
    '    lo:      1000      50    0    0    0     0    0    0      1000    50    0    0    0     0    0    0',
  ].join('\n');
  const result = parseNetDev(content);
  expect(result['eth0'].rx).toBe(12345678);
  expect(result['eth0'].tx).toBe(87654321);
  expect(result['lo'].rx).toBe(1000);
});

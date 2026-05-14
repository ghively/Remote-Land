jest.mock('dockerode', () => {
  const mockContainer = {
    start:   jest.fn().mockResolvedValue(undefined),
    stop:    jest.fn().mockResolvedValue(undefined),
    restart: jest.fn().mockResolvedValue(undefined),
    logs:    jest.fn().mockResolvedValue(Buffer.from('line1\nline2\n')),
    stats:   jest.fn().mockResolvedValue({
      cpu_stats: {
        cpu_usage: { total_usage: 200, percpu_usage: [50, 50, 50, 50] },
        system_cpu_usage: 1000,
        online_cpus: 4,
      },
      precpu_stats: {
        cpu_usage: { total_usage: 100, percpu_usage: [25, 25, 25, 25] },
        system_cpu_usage: 500,
      },
      memory_stats: { usage: 128 * 1024 * 1024 },
    }),
  };
  return jest.fn().mockImplementation(() => ({
    listContainers: jest.fn().mockResolvedValue([{
      Id: 'abc123def45678',
      Names: ['/emby'],
      Image: 'emby/embyserver:latest',
      Status: 'Up 2 days',
      State: 'running',
      Ports: [{ PublicPort: 8096, PrivatePort: 8096, Type: 'tcp' }],
      Created: Math.floor(Date.now() / 1000) - 86400 * 5, // 5d ago
    }]),
    getContainer: jest.fn().mockReturnValue(mockContainer),
  }));
});

const { getContainers, startContainer, stopContainer, restartContainer, getLogs } = require('../docker');

test('getContainers returns normalized container list with stats', async () => {
  const result = await getContainers();
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    id:     'abc123def456',
    name:   'emby',
    image:  'emby/embyserver:latest',
    status: 'Up 2 days',
    state:  'running',
    ports:  '8096:8096/tcp',
    mem:    128,
  });
  expect(typeof result[0].cpu).toBe('number');
  expect(result[0].created).toMatch(/d ago/);
});

test('startContainer calls dockerode start on the container id', async () => {
  await expect(startContainer('abc123def456')).resolves.toBeUndefined();
});

test('stopContainer calls dockerode stop on the container id', async () => {
  await expect(stopContainer('abc123def456')).resolves.toBeUndefined();
});

test('restartContainer calls dockerode restart on the container id', async () => {
  await expect(restartContainer('abc123def456')).resolves.toBeUndefined();
});

test('getLogs returns log string from dockerode', async () => {
  const logs = await getLogs('abc123def456');
  expect(typeof logs).toBe('string');
  expect(logs).toContain('line1');
});

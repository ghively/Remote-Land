jest.mock('dockerode', () => {
  const mockContainer = {
    start: jest.fn().mockResolvedValue(undefined),
    stop:  jest.fn().mockResolvedValue(undefined),
    logs:  jest.fn().mockResolvedValue(Buffer.from('line1\nline2\n')),
  };
  return jest.fn().mockImplementation(() => ({
    listContainers: jest.fn().mockResolvedValue([{
      Id: 'abc123def45678',
      Names: ['/emby'],
      Image: 'emby/embyserver:latest',
      Status: 'Up 2 days',
      State: 'running',
    }]),
    getContainer: jest.fn().mockReturnValue(mockContainer),
  }));
});

const { getContainers, startContainer, stopContainer, getLogs } = require('../docker');

test('getContainers returns normalized container list', async () => {
  const result = await getContainers();
  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    id:     'abc123def456',
    name:   'emby',
    image:  'emby/embyserver:latest',
    status: 'Up 2 days',
    state:  'running',
  });
});

test('startContainer calls dockerode start on the container id', async () => {
  await expect(startContainer('abc123def456')).resolves.toBeUndefined();
});

test('stopContainer calls dockerode stop on the container id', async () => {
  await expect(stopContainer('abc123def456')).resolves.toBeUndefined();
});

test('getLogs returns log string from dockerode', async () => {
  const logs = await getLogs('abc123def456');
  expect(typeof logs).toBe('string');
  expect(logs).toContain('line1');
});

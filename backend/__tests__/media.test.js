jest.mock('axios');
const axios = require('axios');
const { getEmbyData, getRadarrData, getSonarrData } = require('../media');

const testConfig = {
  media: {
    emby:   { url: 'http://localhost:8096', apiKey: 'emby-key' },
    radarr: { url: 'http://localhost:7878', apiKey: 'radarr-key' },
    sonarr: { url: 'http://localhost:8989', apiKey: 'sonarr-key' },
  },
};

test('getEmbyData returns normalized shape from Emby API', async () => {
  axios.get
    .mockResolvedValueOnce({ data: [{ Id: '1' }, { Id: '2' }] }) // /Sessions
    .mockResolvedValueOnce({ data: { ServerName: 'HomeServer', Version: '4.8.0' } }); // /System/Info

  const result = await getEmbyData(testConfig);
  expect(result).toEqual({
    activeSessions: 2,
    serverName: 'HomeServer',
    version: '4.8.0',
  });
});

test('getRadarrData returns normalized shape from Radarr API', async () => {
  axios.get
    .mockResolvedValueOnce({ data: { totalRecords: 3 } })  // /queue
    .mockResolvedValueOnce({ data: [{ title: 'Movie A' }, { title: 'Movie B' }] }); // /calendar

  const result = await getRadarrData(testConfig);
  expect(result).toEqual({ queueSize: 3, upcoming: 2 });
});

test('getSonarrData returns normalized shape from Sonarr API', async () => {
  axios.get
    .mockResolvedValueOnce({ data: { totalRecords: 1 } })  // /queue
    .mockResolvedValueOnce({ data: [{ title: 'Show S01E01' }] }); // /calendar

  const result = await getSonarrData(testConfig);
  expect(result).toEqual({ queueSize: 1, upcoming: 1 });
});

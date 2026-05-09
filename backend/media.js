const axios = require('axios');

const TIMEOUT_MS = 5000;

function today() { return new Date().toISOString().slice(0, 10); }
function weekOut() { return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10); }

async function getEmbyData(config) {
  const { url, apiKey } = config.media.emby;
  const headers = { 'X-Emby-Token': apiKey };
  const [sessions, info] = await Promise.all([
    axios.get(`${url}/Sessions`, { headers, timeout: TIMEOUT_MS }),
    axios.get(`${url}/System/Info`, { headers, timeout: TIMEOUT_MS }),
  ]);
  return {
    activeSessions: sessions.data.length,
    serverName:     info.data.ServerName,
    version:        info.data.Version,
  };
}

async function getRadarrData(config) {
  const { url, apiKey } = config.media.radarr;
  const headers = { 'X-Api-Key': apiKey };
  const [queue, calendar] = await Promise.all([
    axios.get(`${url}/api/v3/queue`, { headers, timeout: TIMEOUT_MS }),
    axios.get(`${url}/api/v3/calendar?unmonitored=false&start=${today()}&end=${weekOut()}`, { headers, timeout: TIMEOUT_MS }),
  ]);
  return {
    queueSize: queue.data.totalRecords,
    upcoming:  calendar.data.length,
  };
}

async function getSonarrData(config) {
  const { url, apiKey } = config.media.sonarr;
  const headers = { 'X-Api-Key': apiKey };
  const [queue, calendar] = await Promise.all([
    axios.get(`${url}/api/v3/queue`, { headers, timeout: TIMEOUT_MS }),
    axios.get(`${url}/api/v3/calendar?unmonitored=false&start=${today()}&end=${weekOut()}`, { headers, timeout: TIMEOUT_MS }),
  ]);
  return {
    queueSize: queue.data.totalRecords,
    upcoming:  calendar.data.length,
  };
}

module.exports = { getEmbyData, getRadarrData, getSonarrData };

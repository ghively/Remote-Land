const axios = require('axios');

const TIMEOUT_MS = 10000;       // bumped from 5s — flaky LAN was reading "offline"
const CACHE_TTL_MS = 30000;     // tolerate transient outages for 30s

// Per-service last-good cache so a single failed poll doesn't yank the
// summary card to "offline" while the service is briefly slow.
const cache = new Map();
function withCache(key, fn) {
  return async (...args) => {
    try {
      const value = await fn(...args);
      cache.set(key, { value, at: Date.now() });
      return value;
    } catch (err) {
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        return { ...hit.value, _stale: true };
      }
      throw err;
    }
  };
}

function today() { return new Date().toISOString().slice(0, 10); }
function weekOut() { return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10); }

const getEmbyData = withCache('emby', async function getEmbyData(config) {
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
});

const getRadarrData = withCache('radarr', async function getRadarrData(config) {
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
});

const getSonarrData = withCache('sonarr', async function getSonarrData(config) {
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
});

module.exports = { getEmbyData, getRadarrData, getSonarrData, _cache: cache };

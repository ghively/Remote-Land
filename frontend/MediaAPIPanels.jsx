/* MediaAPIPanels.jsx — Native Radarr, Sonarr, SABnzbd API panels
   Falls back gracefully to mock data when no API key/URL configured.
   Config stored in localStorage: nas_api_config
*/
const { useState, useEffect, useRef, useCallback } = React;

// ── Config helpers ────────────────────────────────────────────────────────────
const CFG_KEY = 'nas_api_config';

function loadConfig() {
  try {
    const s = localStorage.getItem(CFG_KEY);
    return s ? JSON.parse(s) : {
      radarr:  { url: 'http://nas.local:7878',  apiKey: '' },
      sonarr:  { url: 'http://nas.local:8989',  apiKey: '' },
      sabnzbd: { url: 'http://nas.local:8080',  apiKey: '' },
    };
  } catch { return { radarr: { url: '', apiKey: '' }, sonarr: { url: '', apiKey: '' }, sabnzbd: { url: '', apiKey: '' } }; }
}

function saveConfig(cfg) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch {}
}

// ── API fetch wrapper ─────────────────────────────────────────────────────────
async function apiFetch(base, path, apiKey, params = {}) {
  const url = new URL(`${base}/api/v3/${path}`);
  url.searchParams.set('apikey', apiKey);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function sabFetch(base, apiKey, params = {}) {
  const url = new URL(`${base}/api`);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('output', 'json');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Small shared components ───────────────────────────────────────────────────
function Btn({ label, cls = '', onClick, disabled }) {
  return <button className={`cmd-btn-sm ${cls}`} onClick={onClick} disabled={disabled}>{label}</button>;
}

function StatusPill({ text, color }) {
  const colors = {
    green:  { color: 'var(--color-success)', shadow: '0 0 5px var(--color-success)' },
    yellow: { color: 'var(--color-warn)', shadow: '0 0 5px var(--color-warn)' },
    red:    { color: 'var(--color-error)', shadow: '0 0 5px var(--color-error)' },
    cyan:   { color: 'var(--neon-cyan)', shadow: 'var(--bloom-cyan)' },
    dim:    { color: 'var(--text-dim)', shadow: 'none' },
  };
  const c = colors[color] || colors.dim;
  return (
    <span style={{ fontSize: '0.68rem', color: c.color, textShadow: c.shadow, letterSpacing: 1, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

function ApiNotice({ service, onConfigure }) {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ color: 'var(--neon-cyan)', fontSize: '0.9rem', letterSpacing: 2, textShadow: 'var(--bloom-cyan)' }}>
        [{service.toUpperCase()}_API]
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.8 }}>
        &gt; API KEY NOT CONFIGURED<br/>
        &gt; RUNNING IN DEMO MODE
      </div>
      <Btn label="[CONFIGURE API]" cls="cyan" onClick={onConfigure} />
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ pct, color = 'green' }) {
  const colors = { green: 'var(--neon-green)', yellow: 'var(--color-warn)', red: 'var(--color-error)', cyan: 'var(--neon-cyan)', purple: 'var(--neon-purple)' };
  return (
    <div style={{ flex: 1, height: 8, background: 'rgba(0,255,0,0.08)', border: '1px solid rgba(0,255,0,0.15)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: colors[color] || colors.green, transition: 'width 0.5s', boxShadow: `0 0 4px ${colors[color] || colors.green}` }} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BACKEND CONFIG PANEL
// Replaces the legacy per-service key editor. Per-service keys (Radarr,
// Sonarr, etc.) now live in backend/config.json on the server, never in
// the browser. This panel only configures how the browser reaches the
// NAS Terminal backend agent itself.
// ══════════════════════════════════════════════════════════════════════════════
// Static metadata used by the AI provider section below. Defaults mirror
// backend/ai.js's DEFAULT_MODELS so the UI suggests sensible values when
// switching providers.
const AI_PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com',
    models: { chat: 'claude-sonnet-4-6', shell: 'claude-haiku-4-5-20251001', logs: 'claude-opus-4-7' } },
  { id: 'openai',    label: 'OpenAI / compatible', baseUrl: 'https://api.openai.com/v1',
    models: { chat: 'gpt-4o', shell: 'gpt-4o', logs: 'gpt-4o' } },
];

function BackendConfigPanel({ onSave }) {
  const ctx = window.useBackend ? window.useBackend() : { host: 'nas.local', apiKey: '__demo__', api: null, isDemo: true };
  const [host, setHost]     = useState(ctx.host || 'nas.local');
  const [apiKey, setApiKey] = useState(ctx.apiKey === '__demo__' ? '' : (ctx.apiKey || ''));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // AI provider config — loaded from /api/config/ai when reachable. Local
  // state mirrors the form fields; on Save we PUT a patch back.
  const [aiCfg, setAiCfg] = useState(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiMsg, setAiMsg] = useState(null);

  useEffect(() => {
    if (ctx.isDemo || !ctx.api) return;
    let cancelled = false;
    (async () => {
      try {
        const cur = await ctx.api.readAiConfig();
        if (cancelled) return;
        const provider = cur.provider || (cur.baseUrl && /anthropic\.com/i.test(cur.baseUrl) ? 'anthropic' : 'openai');
        setAiCfg({
          provider,
          baseUrl:    cur.baseUrl    || AI_PROVIDERS.find(p => p.id === provider).baseUrl,
          apiKeySet:  cur.apiKey === '__set__',
          apiKey:     '',
          chatModel:  cur.chatModel  || '',
          shellModel: cur.shellModel || '',
          logModel:   cur.logModel   || '',
        });
      } catch (_) { /* no backend yet — section will show "connect first" */ }
    })();
    return () => { cancelled = true; };
  }, [ctx.isDemo, ctx.api]);

  // When the user switches provider, prefill baseUrl + model triple from
  // the matching preset so they don't have to type Anthropic-vs-OpenAI URLs.
  const onProviderChange = (nextId) => {
    const preset = AI_PROVIDERS.find(p => p.id === nextId);
    setAiCfg(c => ({
      ...c,
      provider:   nextId,
      baseUrl:    preset.baseUrl,
      chatModel:  preset.models.chat,
      shellModel: preset.models.shell,
      logModel:   preset.models.logs,
    }));
  };

  const saveAi = async () => {
    if (!ctx.api || !aiCfg) return;
    setAiSaving(true); setAiMsg(null);
    try {
      const patch = {
        provider:   aiCfg.provider,
        baseUrl:    aiCfg.baseUrl,
        chatModel:  aiCfg.chatModel,
        shellModel: aiCfg.shellModel,
        logModel:   aiCfg.logModel,
      };
      // Only send apiKey if the user actually typed something — otherwise
      // the existing key is preserved.
      if (aiCfg.apiKey) patch.apiKey = aiCfg.apiKey;
      await ctx.api.writeAiConfig(patch);
      setAiMsg({ ok: true, msg: '> AI CONFIG SAVED' });
      setAiCfg(c => ({ ...c, apiKey: '', apiKeySet: c.apiKeySet || !!aiCfg.apiKey }));
    } catch (err) {
      setAiMsg({ ok: false, msg: `> SAVE FAILED: ${err.message}` });
    } finally { setAiSaving(false); }
  };

  const test = async () => {
    setTesting(true); setTestResult(null);
    try {
      const api = window.makeApi(host, apiKey || '__demo__');
      await api.health();
      if (apiKey) await api.systemStats();
      setTestResult({ ok: true, msg: apiKey ? '> CONNECTION OK — KEY ACCEPTED' : '> BACKEND REACHABLE (no key — would enter demo mode)' });
    } catch (err) {
      const msg = /HTTP 401/.test(err.message) ? 'INVALID API KEY' : err.message.toUpperCase();
      setTestResult({ ok: false, msg: `> CONNECTION FAILED: ${msg}` });
    }
    setTesting(false);
  };

  const save = () => {
    const auth = JSON.parse(sessionStorage.getItem('nas_auth') || '{}');
    sessionStorage.setItem('nas_auth', JSON.stringify({
      ...auth, host, apiKey: apiKey || '__demo__',
    }));
    onSave && onSave();
    location.reload();
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', height: '100%', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
      <div style={{ color: 'var(--neon-cyan)', fontSize: '0.85rem', letterSpacing: 2, textShadow: 'var(--bloom-cyan)', borderBottom: '2px solid var(--neon-purple)', paddingBottom: 8 }}>
        BACKEND_CONFIGURATION
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.8 }}>
        &gt; Host of the NAS Terminal backend agent (port 3001).<br/>
        &gt; API key matches `apiKey` in backend/config.json on the server.<br/>
        &gt; Per-service keys (Radarr, Sonarr, Emby) live on the backend now.<br/>
        &gt; Leave API key blank to switch to demo mode.
      </div>

      <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,0,0.15)', borderRadius: 4, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ color: 'var(--neon-green)', fontSize: '0.8rem', letterSpacing: 2, fontWeight: 'bold', textShadow: 'var(--glow-green-sm)' }}>
          [BACKEND_AGENT]
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>HOST</div>
          <input className="logview-filter" style={{ width: '100%' }}
            value={host} onChange={e => setHost(e.target.value)} placeholder="nas.local" />
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>API_KEY</div>
          <input className="logview-filter" style={{ width: '100%' }} type="password"
            value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="leave blank for demo" />
        </div>
      </div>

      {testResult && (
        <div style={{ fontSize: '0.72rem', color: testResult.ok ? 'var(--neon-green)' : 'var(--color-error)',
                      textShadow: testResult.ok ? 'var(--glow-green-sm)' : '0 0 4px var(--color-error)', letterSpacing: 1 }}>
          {testResult.msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="cmd-btn" style={{ flex: 1, textAlign: 'center', letterSpacing: 2 }} onClick={test} disabled={testing}>
          {testing ? '[ TESTING... ]' : '[ TEST_CONNECTION ]'}
        </button>
        <button className="cmd-btn" style={{ flex: 1, textAlign: 'center', letterSpacing: 2 }} onClick={save}>
          [ SAVE_AND_RECONNECT ]
        </button>
      </div>

      {/* ── AI provider ─────────────────────────────────────────────── */}
      <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,0,0.15)', borderRadius: 4, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ color: 'var(--neon-green)', fontSize: '0.8rem', letterSpacing: 2, fontWeight: 'bold', textShadow: 'var(--glow-green-sm)' }}>
          [AI_PROVIDER]
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
          &gt; Backend uses this to call the AI for chat / shell suggestion / log analysis.<br/>
          &gt; Stored in backend/config.json on the server — the key never lives in the browser.
        </div>

        {ctx.isDemo && (
          <div style={{ fontSize: '0.72rem', color: 'var(--color-warn)' }}>
            &gt; Demo mode — save Backend Agent first, then AI provider becomes editable.
          </div>
        )}

        {!ctx.isDemo && !aiCfg && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            &gt; Loading current AI config from backend...
          </div>
        )}

        {!ctx.isDemo && aiCfg && (
          <>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>PROVIDER</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {AI_PROVIDERS.map(p => (
                  <button key={p.id}
                    className={`cmd-btn-sm${aiCfg.provider === p.id ? ' cyan' : ''}`}
                    onClick={() => onProviderChange(p.id)}
                    style={{ flex: 1, textAlign: 'center' }}
                  >{p.label}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>BASE_URL</div>
              <input className="logview-filter" style={{ width: '100%' }}
                value={aiCfg.baseUrl} onChange={e => setAiCfg(c => ({ ...c, baseUrl: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>
                API_KEY {aiCfg.apiKeySet && !aiCfg.apiKey && <span style={{ color: 'var(--color-success)' }}>[currently set — leave blank to keep]</span>}
              </div>
              <input className="logview-filter" style={{ width: '100%' }} type="password"
                value={aiCfg.apiKey}
                onChange={e => setAiCfg(c => ({ ...c, apiKey: e.target.value }))}
                placeholder={aiCfg.apiKeySet ? '••••• (unchanged)' : 'paste API key here'} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { k: 'chatModel',  label: 'CHAT_MODEL' },
                { k: 'shellModel', label: 'SHELL_MODEL' },
                { k: 'logModel',   label: 'LOG_MODEL' },
              ].map(f => (
                <div key={f.k} style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>{f.label}</div>
                  <input className="logview-filter" style={{ width: '100%' }}
                    value={aiCfg[f.k]} onChange={e => setAiCfg(c => ({ ...c, [f.k]: e.target.value }))} />
                </div>
              ))}
            </div>

            {aiMsg && (
              <div style={{ fontSize: '0.72rem', color: aiMsg.ok ? 'var(--neon-green)' : 'var(--color-error)' }}>
                {aiMsg.msg}
              </div>
            )}

            <button className="cmd-btn" style={{ textAlign: 'center', letterSpacing: 2 }} onClick={saveAi} disabled={aiSaving}>
              {aiSaving ? '[ SAVING... ]' : '[ SAVE_AI_CONFIG ]'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ══════════════════════════════════════════════════════════════════════════════
const MOCK_MOVIES = [
  { id: 1, title: 'Dune: Part Two',       year: 2024, status: 'downloaded', hasFile: true,  monitored: true,  sizeOnDisk: 14200000000, ratings: { imdb: { value: 8.5 } }, genres: ['Sci-Fi','Drama'] },
  { id: 2, title: 'Poor Things',           year: 2023, status: 'downloaded', hasFile: true,  monitored: true,  sizeOnDisk: 12100000000, ratings: { imdb: { value: 7.9 } }, genres: ['Fantasy','Drama'] },
  { id: 3, title: 'The Holdovers',         year: 2023, status: 'downloaded', hasFile: true,  monitored: true,  sizeOnDisk: 9400000000,  ratings: { imdb: { value: 7.9 } }, genres: ['Drama','Comedy'] },
  { id: 4, title: 'Oppenheimer',           year: 2023, status: 'downloaded', hasFile: true,  monitored: true,  sizeOnDisk: 18500000000, ratings: { imdb: { value: 8.3 } }, genres: ['Drama','History'] },
  { id: 5, title: 'Civil War',             year: 2024, status: 'missing',    hasFile: false, monitored: true,  sizeOnDisk: 0,           ratings: { imdb: { value: 7.4 } }, genres: ['Action','Drama'] },
  { id: 6, title: 'Furiosa',               year: 2024, status: 'missing',    hasFile: false, monitored: true,  sizeOnDisk: 0,           ratings: { imdb: { value: 7.2 } }, genres: ['Action'] },
  { id: 7, title: 'A Quiet Place: Day One',year: 2024, status: 'missing',    hasFile: false, monitored: false, sizeOnDisk: 0,           ratings: { imdb: { value: 6.8 } }, genres: ['Horror'] },
];

const MOCK_SERIES = [
  { id: 1, title: 'Shōgun',                   year: 2024, status: 'continuing', episodeCount: 10, episodeFileCount: 10, monitored: true,  network: 'FX',      genres: ['Drama','History'] },
  { id: 2, title: 'The Bear',                  year: 2022, status: 'continuing', episodeCount: 28, episodeFileCount: 28, monitored: true,  network: 'FX',      genres: ['Drama','Comedy'] },
  { id: 3, title: 'House of the Dragon',       year: 2022, status: 'continuing', episodeCount: 18, episodeFileCount: 18, monitored: true,  network: 'HBO',     genres: ['Fantasy','Drama'] },
  { id: 4, title: 'The Last of Us',            year: 2023, status: 'continuing', episodeCount: 17, episodeFileCount: 17, monitored: true,  network: 'HBO',     genres: ['Drama','Horror'] },
  { id: 5, title: 'Severance',                 year: 2022, status: 'continuing', episodeCount: 19, episodeFileCount: 18, monitored: true,  network: 'Apple TV',genres: ['Sci-Fi','Thriller'] },
  { id: 6, title: 'Fallout',                   year: 2024, status: 'continuing', episodeCount: 8,  episodeFileCount: 8,  monitored: true,  network: 'Amazon',  genres: ['Sci-Fi','Action'] },
  { id: 7, title: 'Silo',                      year: 2023, status: 'continuing', episodeCount: 20, episodeFileCount: 19, monitored: true,  network: 'Apple TV',genres: ['Sci-Fi'] },
];

const MOCK_RADARR_QUEUE = [
  { id: 101, title: 'Civil War (2024)',        status: 'downloading', sizeleft: 4200000000, size: 8400000000, timeleft: '00:42:00', protocol: 'usenet', quality: { quality: { name: '1080p Bluray' } } },
  { id: 102, title: 'Furiosa (2024)',          status: 'queued',      sizeleft: 9100000000, size: 9100000000, timeleft: '01:31:00', protocol: 'usenet', quality: { quality: { name: '4K UHD' } } },
];

const MOCK_SONARR_QUEUE = [
  { id: 201, title: 'Severance S02E10',        status: 'downloading', sizeleft: 1200000000, size: 2400000000, timeleft: '00:12:00', protocol: 'usenet', quality: { quality: { name: '1080p WEB' } } },
  { id: 202, title: 'Silo S02E01',             status: 'queued',      sizeleft: 2100000000, size: 2100000000, timeleft: '00:21:00', protocol: 'usenet', quality: { quality: { name: '1080p WEB' } } },
];

const MOCK_SAB_QUEUE = {
  queue: {
    status: 'Downloading',
    speed: '24.6 MB/s',
    kbpersec: '25190',
    mbleft: '14821.42',
    mb: '22450.80',
    timeleft: '0:09:47',
    slots: [
      { nzo_id: 'SABnzbd_nzo_1', filename: 'Civil.War.2024.1080p.Bluray.x265', status: 'Downloading', mbleft: '4200.00', mb: '8400.00', timeleft: '0:04:12', avg_age: '42d' },
      { nzo_id: 'SABnzbd_nzo_2', filename: 'Furiosa.2024.2160p.UHD.BluRay',    status: 'Queued',      mbleft: '9100.00', mb: '9100.00', timeleft: '0:09:07', avg_age: '12d' },
      { nzo_id: 'SABnzbd_nzo_3', filename: 'Severance.S02E10.1080p.WEB',       status: 'Downloading', mbleft: '1200.00', mb: '2400.00', timeleft: '0:01:12', avg_age: '3d' },
    ],
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// MEDIA SUMMARY CARD — shared between Radarr / Sonarr / Emby in v1.
// Backend's /api/media/* endpoints return summary fields only (queueSize +
// upcoming for Radarr/Sonarr; activeSessions/serverName/version for Emby).
// Full lists are flagged DEEP DATA and deferred to backend v2.
// ══════════════════════════════════════════════════════════════════════════════
function MediaSummaryCard({ service, accent, fetcher, demoData, fields, onOpenWebUI }) {
  const { isDemo, status } = window.useBackend ? window.useBackend() : { isDemo: true, status: 'demo' };
  const [data, setData]       = useState(isDemo ? demoData : null);
  const [offline, setOffline] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (isDemo) { setData(demoData); setOffline(false); }
  }, [isDemo, demoData]);
  const tick = React.useCallback(async () => {
    try {
      const d = await fetcher();
      if (d && d.status === 'offline') { setOffline(true); setData(null); setError(null); }
      else { setData(d); setOffline(false); setError(null); }
    } catch (err) { setError(err.message); setOffline(true); }
  }, [fetcher]);
  usePoller(tick, 30000, !isDemo && status === 'online');

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '2px solid var(--neon-purple)', paddingBottom: 8 }}>
        <span style={{ color: accent, fontSize: '0.95rem', letterSpacing: 3, fontWeight: 'bold', textShadow: `0 0 6px ${accent}` }}>
          [{service.toUpperCase()}_SUMMARY]
        </span>
        <span style={{ flex: 1 }} />
        {isDemo && <StatusPill text="DEMO MODE" color="dim" />}
        {!isDemo && offline && <StatusPill text={`${service.toUpperCase()} OFFLINE`} color="red" />}
        {!isDemo && !offline && data && <StatusPill text="ONLINE" color="green" />}
      </div>

      {error && !offline && (
        <div style={{ fontSize: '0.72rem', color: 'var(--color-warn)', textShadow: '0 0 4px var(--color-warn)' }}>
          &gt; ERR: {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {fields.map(({ label, key, format }) => {
          const raw = data && data[key];
          const display = data == null ? '--' : (format ? format(raw) : (raw == null ? '--' : raw));
          return (
            <div key={label} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,0,0.15)', borderRadius: 4, padding: '12px 14px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: 2, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: '1.4rem', color: accent, textShadow: `0 0 6px ${accent}`, letterSpacing: 1 }}>
                {display}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', lineHeight: 1.7, padding: '10px 12px',
                    border: '1px dashed rgba(0,255,0,0.2)', borderRadius: 4 }}>
        &gt; [ DEEP DATA — REQUIRES BACKEND v2 ]<br/>
        &gt; Full {service} lists (movies / episodes / queue items) are not exposed by the<br/>
        &gt; current backend. Use the upstream web UI for full management.
      </div>

      {onOpenWebUI && (
        <button className="cmd-btn" style={{ width: '100%', textAlign: 'center', letterSpacing: 2 }} onClick={onOpenWebUI}>
          [ OPEN {service.toUpperCase()} WEB UI ]
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RADARR PANEL — backend summary
// ══════════════════════════════════════════════════════════════════════════════
function RadarrPanel({ onOpenWebUI }) {
  const ctx = window.useBackend ? window.useBackend() : { api: null };
  const fetcher = useCallback(() => ctx.api ? ctx.api.radarr() : Promise.resolve({ status: 'offline' }), [ctx.api]);
  return (
    <MediaSummaryCard
      service="Radarr"
      accent="var(--neon-green)"
      fetcher={fetcher}
      demoData={{ queueSize: 3, upcoming: 5 }}
      fields={[
        { label: 'QUEUE',         key: 'queueSize' },
        { label: 'UPCOMING (7d)', key: 'upcoming'  },
      ]}
      onOpenWebUI={onOpenWebUI}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SONARR PANEL — backend summary
// ══════════════════════════════════════════════════════════════════════════════
function SonarrPanel({ onOpenWebUI }) {
  const ctx = window.useBackend ? window.useBackend() : { api: null };
  const fetcher = useCallback(() => ctx.api ? ctx.api.sonarr() : Promise.resolve({ status: 'offline' }), [ctx.api]);
  return (
    <MediaSummaryCard
      service="Sonarr"
      accent="var(--neon-cyan)"
      fetcher={fetcher}
      demoData={{ queueSize: 1, upcoming: 7 }}
      fields={[
        { label: 'QUEUE',         key: 'queueSize' },
        { label: 'UPCOMING (7d)', key: 'upcoming'  },
      ]}
      onOpenWebUI={onOpenWebUI}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SABNZBD PANEL
// ══════════════════════════════════════════════════════════════════════════════
function SABnzbdPanel({ onOpenWebUI }) {
  const [cfg] = useState(loadConfig);
  const hasKey = !!cfg.sabnzbd.apiKey;
  const [tab, setTab] = useState('queue');
  const [queueData, setQueueData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCfg, setShowCfg] = useState(false);
  const [paused, setPaused] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (hasKey) {
        const [q, h] = await Promise.all([
          sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, { mode: 'queue' }),
          sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, { mode: 'history', limit: 20 }),
        ]);
        setQueueData(q.queue);
        setHistory(h.history?.slots || []);
      } else {
        await new Promise(r => setTimeout(r, 300));
        setQueueData(MOCK_SAB_QUEUE.queue);
        setHistory([
          { nzo_id: 'hist_1', name: 'The.Bear.S03E01.1080p.WEB', status: 'Completed', size: '2.4 GB', completed: Date.now()/1000 - 3600, category: 'tv' },
          { nzo_id: 'hist_2', name: 'Dune.Part.Two.2024.4K.UHD',  status: 'Completed', size: '58.2 GB', completed: Date.now()/1000 - 7200, category: 'movies' },
          { nzo_id: 'hist_3', name: 'House.of.Dragon.S02E01.1080p', status: 'Failed',    size: '3.1 GB', completed: Date.now()/1000 - 10800, category: 'tv' },
        ]);
      }
    } catch(e) {
      setError(e.message);
      setQueueData(MOCK_SAB_QUEUE.queue);
    }
    setLoading(false);
  }, [hasKey, cfg]);

  usePoller(load, 8000, true);

  const doPause = async () => {
    try {
      // Optimistically reflect new state so the UI doesn't lag the next poll.
      setPaused(p => !p);
      setQueueData(q => q ? { ...q, status: paused ? 'Downloading' : 'Paused' } : q);
      if (hasKey) await sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, { mode: paused ? 'resume' : 'pause' });
    } catch {
      // Roll back optimistic toggle on failure.
      setPaused(p => !p);
    }
  };

  const doDelete = async (nzo_id) => {
    try {
      if (hasKey) await sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, { mode: 'queue', name: 'delete', value: nzo_id });
      setQueueData(q => q ? { ...q, slots: q.slots.filter(s => s.nzo_id !== nzo_id) } : q);
    } catch {}
  };

  const fmt = (mbStr) => {
    const mb = parseFloat(mbStr);
    return mb >= 1024 ? `${(mb/1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
  };

  const totalPct = queueData ? (() => {
    const total = parseFloat(queueData.mb);
    const left  = parseFloat(queueData.mbleft);
    return total > 0 ? ((total - left) / total) * 100 : 0;
  })() : 0;

  if (showCfg) return <BackendConfigPanel onSave={() => { setShowCfg(false); load(); }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid rgba(0,255,0,0.1)', background: 'rgba(0,0,0,0.5)', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--color-warn)', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: 2, textShadow: '0 0 5px var(--color-warn)', marginRight: 4 }}>[SABNZBD]</span>
        {['queue','history'].map(t => (
          <Btn key={t} label={`[${t.toUpperCase()}]`} cls={tab===t?'cyan':''} onClick={() => setTab(t)} />
        ))}
        <div style={{ flex: 1 }} />
        {error && <StatusPill text="API ERR — DEMO" color="yellow" />}
        {!hasKey && <StatusPill text="DEMO MODE" color="dim" />}
        <Btn label={paused ? '[RESUME]' : '[PAUSE]'} cls={paused ? 'cyan' : 'warn'} onClick={doPause} />
        <Btn label="[REFRESH]" onClick={load} disabled={loading} />
        <Btn label="[WEB UI]" cls="cyan" onClick={onOpenWebUI} />
        <Btn label="[CONFIG]" onClick={() => setShowCfg(true)} />
      </div>

      {/* Speed + overall progress banner */}
      {tab === 'queue' && queueData && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,255,0,0.08)', background: 'rgba(0,0,0,0.4)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.75rem' }}>
            <span style={{ color: paused ? 'var(--color-warn)' : 'var(--neon-green)', textShadow: paused ? '0 0 5px var(--color-warn)' : 'var(--glow-green-sm)' }}>
              STATUS: {paused ? 'PAUSED' : queueData.status?.toUpperCase()}
            </span>
            <span style={{ color: 'var(--neon-cyan)', textShadow: 'var(--bloom-cyan)' }}>
              {paused ? '0 MB/s' : queueData.speed}
            </span>
            <span style={{ color: 'var(--text-dim)' }}>
              {fmt(queueData.mbleft)} LEFT | ETA: {queueData.timeleft}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ProgressBar pct={totalPct} color={paused ? 'yellow' : 'cyan'} />
            <span style={{ fontSize: '0.72rem', color: 'var(--neon-cyan)', width: 36, textAlign: 'right', flexShrink: 0 }}>{totalPct.toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Queue slots */}
      {tab === 'queue' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
          {loading && !queueData ? <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem' }}>&gt; LOADING QUEUE...</div> :
           !queueData?.slots?.length ? <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem' }}>&gt; QUEUE IS EMPTY</div> :
           queueData.slots.map((slot, i) => {
             const mb = parseFloat(slot.mb);
             const mbl = parseFloat(slot.mbleft);
             const pct = mb > 0 ? ((mb - mbl) / mb) * 100 : 0;
             return (
               <div key={slot.nzo_id} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,0,0.15)', borderRadius: 4, padding: '10px 12px', marginBottom: 8 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                   <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                     <div style={{ color: 'var(--color-warn)', fontSize: '0.8rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 0 4px var(--color-warn)' }}>{slot.filename}</div>
                     <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', gap: 10, marginTop: 2 }}>
                       <span>AGE: {slot.avg_age}</span>
                       <span>ETA: {slot.timeleft}</span>
                       <span>{fmt(slot.mbleft)} left</span>
                     </div>
                   </div>
                   <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                     <StatusPill text={slot.status?.toUpperCase()} color={slot.status==='Downloading'?'cyan':'yellow'} />
                     <Btn label="[DEL]" cls="danger" onClick={() => doDelete(slot.nzo_id)} />
                   </div>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                   <ProgressBar pct={pct} color={slot.status==='Downloading'?'yellow':'dim'} />
                   <span style={{ fontSize: '0.7rem', color: 'var(--color-warn)', width: 36, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                 </div>
               </div>
             );
           })}
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
          {loading ? <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem' }}>&gt; LOADING HISTORY...</div> :
           history.map((item, i) => {
             const d = new Date(item.completed * 1000);
             const ts = `${d.toLocaleDateString()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
             return (
               <div key={item.nzo_id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderBottom: '1px solid rgba(0,255,0,0.05)', transition: 'background 0.1s' }}
                 onMouseEnter={e => e.currentTarget.style.background='rgba(0,255,0,0.03)'}
                 onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                 <span style={{ color: item.status === 'Completed' ? 'var(--color-success)' : 'var(--color-error)', fontSize: '0.75rem', flexShrink: 0 }}>●</span>
                 <div style={{ flex: 1, minWidth: 0 }}>
                   <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                   <div style={{ fontSize: '0.66rem', color: 'var(--text-dim)', display: 'flex', gap: 8 }}>
                     <span>{ts}</span>
                     <span style={{ color: 'var(--neon-purple)' }}>[{item.category?.toUpperCase()}]</span>
                     <span>{item.size}</span>
                   </div>
                 </div>
                 <StatusPill text={item.status?.toUpperCase()} color={item.status==='Completed'?'green':'red'} />
               </div>
             );
           })}
        </div>
      )}
    </div>
  );
}

// Export
Object.assign(window, { RadarrPanel, SonarrPanel, SABnzbdPanel, BackendConfigPanel, loadConfig });

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
    green:  { color: '#27c93f', shadow: '0 0 5px #27c93f' },
    yellow: { color: '#ffbd2e', shadow: '0 0 5px #ffbd2e' },
    red:    { color: '#ff5f56', shadow: '0 0 5px #ff5f56' },
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
  const colors = { green: 'var(--neon-green)', yellow: '#ffbd2e', red: '#ff5f56', cyan: 'var(--neon-cyan)', purple: 'var(--neon-purple)' };
  return (
    <div style={{ flex: 1, height: 8, background: 'rgba(0,255,0,0.08)', border: '1px solid rgba(0,255,0,0.15)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: colors[color] || colors.green, transition: 'width 0.5s', boxShadow: `0 0 4px ${colors[color] || colors.green}` }} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// API CONFIG PANEL
// ══════════════════════════════════════════════════════════════════════════════
function ApiConfigPanel({ onSave }) {
  const [cfg, setCfg] = useState(loadConfig);

  const update = (svc, field, val) => setCfg(c => ({ ...c, [svc]: { ...c[svc], [field]: val } }));

  const save = () => {
    saveConfig(cfg);
    onSave && onSave(cfg);
  };

  const services = [
    { id: 'radarr',  label: 'RADARR',  port: 7878, doc: 'Settings → General → API Key' },
    { id: 'sonarr',  label: 'SONARR',  port: 8989, doc: 'Settings → General → API Key' },
    { id: 'sabnzbd', label: 'SABNZBD', port: 8080, doc: 'Config → General → API Key' },
  ];

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', height: '100%', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
      <div style={{ color: 'var(--neon-cyan)', fontSize: '0.85rem', letterSpacing: 2, textShadow: 'var(--bloom-cyan)', borderBottom: '2px solid var(--neon-purple)', paddingBottom: 8 }}>
        API_CONFIGURATION
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.8 }}>
        &gt; Enter your NAS host URLs and API keys below.<br/>
        &gt; Keys are stored in browser localStorage only.<br/>
        &gt; Leave blank to use demo/mock data.
      </div>

      {services.map(svc => (
        <div key={svc.id} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,0,0.15)', borderRadius: 4, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ color: 'var(--neon-green)', fontSize: '0.8rem', letterSpacing: 2, fontWeight: 'bold', textShadow: 'var(--glow-green-sm)' }}>
            [{svc.label}] — :{svc.port}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>&gt; Find key: {svc.doc}</div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>BASE URL</div>
            <input className="logview-filter" style={{ width: '100%' }}
              placeholder={`http://nas.local:${svc.port}`}
              value={cfg[svc.id].url}
              onChange={e => update(svc.id, 'url', e.target.value)}
            />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4 }}>API KEY</div>
            <input className="logview-filter" style={{ width: '100%' }}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={cfg[svc.id].apiKey}
              onChange={e => update(svc.id, 'apiKey', e.target.value)}
              type="password"
            />
          </div>
        </div>
      ))}

      <button className="cmd-btn" style={{ width: '100%', textAlign: 'center', letterSpacing: 2 }} onClick={save}>
        [ SAVE_CONFIG ]
      </button>
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
// RADARR PANEL
// ══════════════════════════════════════════════════════════════════════════════
function RadarrPanel({ onOpenWebUI }) {
  const [cfg] = useState(loadConfig);
  const hasKey = !!cfg.radarr.apiKey;
  const [tab, setTab] = useState('movies'); // movies | queue | search
  const [movies, setMovies] = useState([]);
  const [queue, setQueue]   = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [showCfg, setShowCfg] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (hasKey) {
        const [mv, q] = await Promise.all([
          apiFetch(cfg.radarr.url, 'movie', cfg.radarr.apiKey),
          apiFetch(cfg.radarr.url, 'queue', cfg.radarr.apiKey),
        ]);
        setMovies(mv);
        setQueue(q.records || q);
      } else {
        await new Promise(r => setTimeout(r, 400));
        setMovies(MOCK_MOVIES);
        setQueue(MOCK_RADARR_QUEUE);
      }
    } catch(e) {
      setError(e.message);
      setMovies(MOCK_MOVIES);
      setQueue(MOCK_RADARR_QUEUE);
    }
    setLoading(false);
  }, [hasKey, cfg]);

  useEffect(() => { load(); }, [load]);

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      if (hasKey) {
        const r = await apiFetch(cfg.radarr.url, 'movie/lookup', cfg.radarr.apiKey, { term: search });
        setSearchResults(r.slice(0, 12));
      } else {
        await new Promise(r => setTimeout(r, 500));
        setSearchResults([
          { tmdbId: 1001, title: 'Alien: Romulus', year: 2024, status: 'released', overview: 'A new chapter in the Alien franchise.', genres: ['Horror','Sci-Fi'] },
          { tmdbId: 1002, title: 'Deadpool & Wolverine', year: 2024, status: 'released', overview: 'Wade Wilson teams up with Wolverine.', genres: ['Action','Comedy'] },
          { tmdbId: 1003, title: 'Twisters', year: 2024, status: 'released', overview: 'Storm chasers face deadly tornadoes.', genres: ['Action','Thriller'] },
        ]);
      }
    } catch(e) { setSearchResults([]); }
    setSearching(false);
  };

  const fmt = (bytes) => {
    if (!bytes) return '0 B';
    const gb = bytes / 1e9;
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`;
  };

  const filteredMovies = movies.filter(m => {
    const matchText = !search || m.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'missing' && !m.hasFile) || (filter === 'downloaded' && m.hasFile);
    return matchText && matchFilter;
  });

  if (showCfg) return <ApiConfigPanel onSave={() => { setShowCfg(false); load(); }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid rgba(0,255,0,0.1)', background: 'rgba(0,0,0,0.5)', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--neon-green)', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: 2, textShadow: 'var(--glow-green-sm)', marginRight: 4 }}>[RADARR]</span>
        {['movies','queue','search'].map(t => (
          <Btn key={t} label={`[${t.toUpperCase()}${t==='movies'?` (${movies.length})`:t==='queue'?` (${queue.length})`:''}]`} cls={tab===t?'cyan':''} onClick={() => setTab(t)} />
        ))}
        <div style={{ flex: 1 }} />
        {error && <StatusPill text="API ERR — DEMO" color="yellow" />}
        {!hasKey && <StatusPill text="DEMO MODE" color="dim" />}
        <Btn label="[REFRESH]" onClick={load} disabled={loading} />
        <Btn label="[WEB UI]" cls="cyan" onClick={onOpenWebUI} />
        <Btn label="[CONFIG]" onClick={() => setShowCfg(true)} />
      </div>

      {/* Movies tab */}
      {tab === 'movies' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 6, padding: '5px 10px', borderBottom: '1px solid rgba(0,255,0,0.08)', flexShrink: 0, flexWrap: 'wrap' }}>
            <input className="logview-filter" style={{ flex: 1, minWidth: 140 }} placeholder="$ filter --movies" value={search} onChange={e => setSearch(e.target.value)} />
            {['all','downloaded','missing'].map(f => (
              <Btn key={f} label={`[${f.toUpperCase()}]`} cls={filter===f?'cyan':''} onClick={() => setFilter(f)} />
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
            {loading ? <div style={{ padding: 20, color: 'var(--text-dim)', textAlign: 'center', fontSize: '0.8rem' }}>&gt; LOADING MOVIE DATABASE...</div> : filteredMovies.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderBottom: '1px solid rgba(0,255,0,0.05)', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(0,255,0,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <span style={{ color: m.hasFile ? '#27c93f' : '#ff5f56', fontSize: '0.75rem', width: 10, flexShrink: 0 }}>●</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>{m.year}</span>
                    {m.ratings?.imdb && <span>IMDB: {m.ratings.imdb.value}</span>}
                    {m.genres?.slice(0,2).map(g => <span key={g} style={{ color: 'var(--neon-purple)' }}>[{g}]</span>)}
                  </div>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', flexShrink: 0 }}>{fmt(m.sizeOnDisk)}</span>
                <StatusPill text={m.hasFile ? 'DOWNLOADED' : 'MISSING'} color={m.hasFile ? 'green' : 'red'} />
                {!m.hasFile && <Btn label="[SEARCH]" cls="cyan" onClick={() => { setTab('search'); setSearch(m.title); }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queue tab */}
      {tab === 'queue' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
          {loading ? <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem' }}>&gt; LOADING QUEUE...</div> :
           queue.length === 0 ? <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem' }}>&gt; QUEUE IS EMPTY</div> :
           queue.map(item => {
             const pct = item.size > 0 ? ((item.size - item.sizeleft) / item.size) * 100 : 0;
             return (
               <div key={item.id} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,0,0.15)', borderRadius: 4, padding: '10px 12px', marginBottom: 8 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                   <div style={{ flex: 1, minWidth: 0 }}>
                     <div style={{ color: 'var(--neon-green)', fontSize: '0.82rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: 'var(--glow-green-sm)' }}>{item.title}</div>
                     <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', gap: 10, marginTop: 2 }}>
                       <span>{item.quality?.quality?.name || 'Unknown'}</span>
                       <span style={{ color: 'var(--neon-purple)' }}>{item.protocol?.toUpperCase()}</span>
                       <span>ETA: {item.timeleft}</span>
                     </div>
                   </div>
                   <StatusPill text={item.status?.toUpperCase()} color={item.status==='downloading'?'cyan':item.status==='queued'?'yellow':'dim'} />
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                   <ProgressBar pct={pct} color={item.status==='downloading'?'cyan':'dim'} />
                   <span style={{ fontSize: '0.7rem', color: 'var(--neon-cyan)', width: 36, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                 </div>
                 <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: 4 }}>
                   {fmt(item.size - item.sizeleft)} / {fmt(item.size)}
                 </div>
               </div>
             );
           })}
        </div>
      )}

      {/* Search tab */}
      {tab === 'search' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderBottom: '1px solid rgba(0,255,0,0.08)', flexShrink: 0 }}>
            <input className="logview-filter" style={{ flex: 1 }} placeholder="$ movie-lookup --title ..."
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()} />
            <Btn label={searching ? '[SEARCHING...]' : '[LOOKUP]'} cls="cyan" onClick={doSearch} disabled={searching} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 10, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
            {searchResults.map((r, i) => (
              <div key={i} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,0,0.15)', borderRadius: 4, padding: '10px 12px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--neon-green)', fontSize: '0.85rem', fontWeight: 'bold', textShadow: 'var(--glow-green-sm)' }}>{r.title} ({r.year})</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.6 }}>{r.overview?.slice(0, 120)}{r.overview?.length > 120 ? '…' : ''}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {r.genres?.slice(0,3).map(g => <span key={g} style={{ fontSize: '0.65rem', color: 'var(--neon-purple)', border: '1px solid rgba(128,0,255,0.3)', borderRadius: 2, padding: '1px 5px' }}>[{g}]</span>)}
                  </div>
                </div>
                <Btn label="[+ ADD]" cls="cyan" onClick={() => {}} />
              </div>
            ))}
            {searchResults.length === 0 && !searching && <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center' }}>&gt; ENTER TITLE AND PRESS [LOOKUP]</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SONARR PANEL
// ══════════════════════════════════════════════════════════════════════════════
function SonarrPanel({ onOpenWebUI }) {
  const [cfg] = useState(loadConfig);
  const hasKey = !!cfg.sonarr.apiKey;
  const [tab, setTab] = useState('series');
  const [series, setSeries] = useState([]);
  const [queue, setQueue]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [showCfg, setShowCfg] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (hasKey) {
        const [sv, q] = await Promise.all([
          apiFetch(cfg.sonarr.url, 'series', cfg.sonarr.apiKey),
          apiFetch(cfg.sonarr.url, 'queue', cfg.sonarr.apiKey),
        ]);
        setSeries(sv);
        setQueue(q.records || q);
      } else {
        await new Promise(r => setTimeout(r, 350));
        setSeries(MOCK_SERIES);
        setQueue(MOCK_SONARR_QUEUE);
      }
    } catch(e) {
      setError(e.message);
      setSeries(MOCK_SERIES);
      setQueue(MOCK_SONARR_QUEUE);
    }
    setLoading(false);
  }, [hasKey, cfg]);

  useEffect(() => { load(); }, [load]);

  const filteredSeries = series.filter(s => !search || s.title.toLowerCase().includes(search.toLowerCase()));

  if (showCfg) return <ApiConfigPanel onSave={() => { setShowCfg(false); load(); }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid rgba(0,255,0,0.1)', background: 'rgba(0,0,0,0.5)', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--neon-cyan)', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: 2, textShadow: 'var(--bloom-cyan)', marginRight: 4 }}>[SONARR]</span>
        {['series','queue'].map(t => (
          <Btn key={t} label={`[${t.toUpperCase()}${t==='series'?` (${series.length})`:` (${queue.length})`}]`} cls={tab===t?'cyan':''} onClick={() => setTab(t)} />
        ))}
        <div style={{ flex: 1 }} />
        {error && <StatusPill text="API ERR — DEMO" color="yellow" />}
        {!hasKey && <StatusPill text="DEMO MODE" color="dim" />}
        <Btn label="[REFRESH]" onClick={load} disabled={loading} />
        <Btn label="[WEB UI]" cls="cyan" onClick={onOpenWebUI} />
        <Btn label="[CONFIG]" onClick={() => setShowCfg(true)} />
      </div>

      {tab === 'series' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '5px 10px', borderBottom: '1px solid rgba(0,255,0,0.08)', flexShrink: 0 }}>
            <input className="logview-filter" style={{ width: '100%' }} placeholder="$ filter --series" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
            {loading ? <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem' }}>&gt; LOADING SERIES DATABASE...</div> : filteredSeries.map(s => {
              const pct = s.episodeCount > 0 ? (s.episodeFileCount / s.episodeCount) * 100 : 0;
              const complete = s.episodeFileCount >= s.episodeCount;
              return (
                <div key={s.id} style={{ padding: '7px 12px', borderBottom: '1px solid rgba(0,255,0,0.05)', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(0,255,0,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ color: complete ? '#27c93f' : '#ffbd2e', fontSize: '0.75rem', width: 10, flexShrink: 0 }}>●</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', gap: 8 }}>
                        <span>{s.year}</span>
                        <span style={{ color: 'var(--neon-purple)' }}>{s.network}</span>
                        <span>{s.episodeFileCount}/{s.episodeCount} eps</span>
                        {s.genres?.slice(0,2).map(g => <span key={g}>[{g}]</span>)}
                      </div>
                    </div>
                    <StatusPill text={s.status?.toUpperCase()} color={s.status==='continuing'?'cyan':'dim'} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 20 }}>
                    <ProgressBar pct={pct} color={complete ? 'green' : 'yellow'} />
                    <span style={{ fontSize: '0.68rem', color: complete ? '#27c93f' : '#ffbd2e', width: 36, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'queue' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
          {loading ? <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem' }}>&gt; LOADING QUEUE...</div> :
           queue.length === 0 ? <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem' }}>&gt; QUEUE IS EMPTY</div> :
           queue.map(item => {
             const pct = item.size > 0 ? ((item.size - item.sizeleft) / item.size) * 100 : 0;
             return (
               <div key={item.id} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,0,0.15)', borderRadius: 4, padding: '10px 12px', marginBottom: 8 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                   <div style={{ flex: 1, minWidth: 0 }}>
                     <div style={{ color: 'var(--neon-cyan)', fontSize: '0.82rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: 'var(--bloom-cyan)' }}>{item.title}</div>
                     <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', gap: 10, marginTop: 2 }}>
                       <span>{item.quality?.quality?.name || 'Unknown'}</span>
                       <span style={{ color: 'var(--neon-purple)' }}>{item.protocol?.toUpperCase()}</span>
                       <span>ETA: {item.timeleft}</span>
                     </div>
                   </div>
                   <StatusPill text={item.status?.toUpperCase()} color={item.status==='downloading'?'cyan':'yellow'} />
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                   <ProgressBar pct={pct} color="cyan" />
                   <span style={{ fontSize: '0.7rem', color: 'var(--neon-cyan)', width: 36, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                 </div>
               </div>
             );
           })}
        </div>
      )}
    </div>
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

  useEffect(() => { load(); const iv = setInterval(load, 8000); return () => clearInterval(iv); }, [load]);

  const doPause = async () => {
    try {
      if (hasKey) await sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, { mode: paused ? 'resume' : 'pause' });
      setPaused(p => !p);
    } catch {}
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

  if (showCfg) return <ApiConfigPanel onSave={() => { setShowCfg(false); load(); }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid rgba(0,255,0,0.1)', background: 'rgba(0,0,0,0.5)', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ color: '#ffbd2e', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: 2, textShadow: '0 0 5px #ffbd2e', marginRight: 4 }}>[SABNZBD]</span>
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
            <span style={{ color: paused ? '#ffbd2e' : 'var(--neon-green)', textShadow: paused ? '0 0 5px #ffbd2e' : 'var(--glow-green-sm)' }}>
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
                     <div style={{ color: '#ffbd2e', fontSize: '0.8rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 0 4px #ffbd2e' }}>{slot.filename}</div>
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
                   <span style={{ fontSize: '0.7rem', color: '#ffbd2e', width: 36, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
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
                 <span style={{ color: item.status === 'Completed' ? '#27c93f' : '#ff5f56', fontSize: '0.75rem', flexShrink: 0 }}>●</span>
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
Object.assign(window, { RadarrPanel, SonarrPanel, SABnzbdPanel, ApiConfigPanel, loadConfig });

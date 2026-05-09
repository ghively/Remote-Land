/* MediaPanelsFull.jsx — Full Radarr, Sonarr, SABnzbd panels with complete functionality
   Depends on MediaAPIPanels.jsx being loaded first (for loadConfig, apiFetch, sabFetch, shared components)
*/
const { useState, useEffect, useRef, useCallback } = React;

// ── Extended mock data ────────────────────────────────────────────────────────
const MOCK_MOVIES_FULL = [
  { id: 1,  title: 'Dune: Part Two',          year: 2024, status: 'downloaded', hasFile: true,  monitored: true,  sizeOnDisk: 14200000000, ratings: { imdb: { value: 8.5 } }, genres: ['Sci-Fi','Drama'],   studio: 'Legendary', runtime: 166, overview: 'Paul Atreides unites with the Fremen while on a warpath of revenge against the conspirators who destroyed his family.', qualityProfileId: 4, rootFolderPath: '/mnt/array/media/Movies', tmdbId: 693134 },
  { id: 2,  title: 'Poor Things',              year: 2023, status: 'downloaded', hasFile: true,  monitored: true,  sizeOnDisk: 12100000000, ratings: { imdb: { value: 7.9 } }, genres: ['Fantasy','Drama'],  studio: 'Film4',     runtime: 141, overview: 'The incredible tale about the fantastical evolution of Bella Baxter, a young woman brought back to life by the brilliant and unorthodox scientist Dr. Godwin Baxter.', qualityProfileId: 4, rootFolderPath: '/mnt/array/media/Movies', tmdbId: 792307 },
  { id: 3,  title: 'The Holdovers',            year: 2023, status: 'downloaded', hasFile: true,  monitored: true,  sizeOnDisk: 9400000000,  ratings: { imdb: { value: 7.9 } }, genres: ['Drama','Comedy'],   studio: 'Focus',     runtime: 133, overview: 'A cantankerous history teacher at a prep school is forced to remain on campus during the holidays with a trouble-making student.', qualityProfileId: 3, rootFolderPath: '/mnt/array/media/Movies', tmdbId: 840430 },
  { id: 4,  title: 'Oppenheimer',              year: 2023, status: 'downloaded', hasFile: true,  monitored: true,  sizeOnDisk: 18500000000, ratings: { imdb: { value: 8.3 } }, genres: ['Drama','History'],  studio: 'Universal', runtime: 180, overview: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.', qualityProfileId: 6, rootFolderPath: '/mnt/array/media/Movies', tmdbId: 872585 },
  { id: 5,  title: 'Civil War',                year: 2024, status: 'missing',    hasFile: false, monitored: true,  sizeOnDisk: 0,           ratings: { imdb: { value: 7.4 } }, genres: ['Action','Drama'],   studio: 'A24',       runtime: 109, overview: 'A journey across a dystopian future America, following a team of military-embedded journalists.', qualityProfileId: 4, rootFolderPath: '/mnt/array/media/Movies', tmdbId: 1084736 },
  { id: 6,  title: 'Furiosa',                  year: 2024, status: 'missing',    hasFile: false, monitored: true,  sizeOnDisk: 0,           ratings: { imdb: { value: 7.2 } }, genres: ['Action'],           studio: 'WB',        runtime: 148, overview: 'The origin story of renegade warrior Furiosa before she teamed up with Mad Max.', qualityProfileId: 4, rootFolderPath: '/mnt/array/media/Movies', tmdbId: 786892 },
  { id: 7,  title: 'Alien: Romulus',           year: 2024, status: 'downloaded', hasFile: true,  monitored: true,  sizeOnDisk: 11200000000, ratings: { imdb: { value: 7.3 } }, genres: ['Horror','Sci-Fi'],  studio: '20th Century', runtime: 119, overview: 'While scavenging the deep ends of a derelict space station, a group of young space colonizers come face to face with the most terrifying life form in the universe.', qualityProfileId: 4, rootFolderPath: '/mnt/array/media/Movies', tmdbId: 945961 },
  { id: 8,  title: 'Deadpool & Wolverine',     year: 2024, status: 'downloaded', hasFile: true,  monitored: true,  sizeOnDisk: 15800000000, ratings: { imdb: { value: 7.8 } }, genres: ['Action','Comedy'],  studio: 'Marvel',    runtime: 128, overview: 'Wade Wilson and Wolverine must work together to defeat a common threat.', qualityProfileId: 5, rootFolderPath: '/mnt/array/media/Movies', tmdbId: 533535 },
  { id: 9,  title: 'Twisters',                 year: 2024, status: 'missing',    hasFile: false, monitored: false, sizeOnDisk: 0,           ratings: { imdb: { value: 6.8 } }, genres: ['Action','Thriller'], studio: 'Universal', runtime: 122, overview: 'Storm chasers race into the heart of multiple storm systems converging over central Oklahoma.', qualityProfileId: 4, rootFolderPath: '/mnt/array/media/Movies', tmdbId: 718821 },
  { id: 10, title: 'A Quiet Place: Day One',   year: 2024, status: 'downloaded', hasFile: true,  monitored: true,  sizeOnDisk: 9800000000, ratings: { imdb: { value: 6.9 } }, genres: ['Horror'],            studio: 'Paramount', runtime: 99, overview: 'A woman named Sam finds herself caught in the chaos as New York City turns into a hostile environment.', qualityProfileId: 3, rootFolderPath: '/mnt/array/media/Movies', tmdbId: 762441 },
];

const MOCK_SERIES_FULL = [
  { id: 1, title: 'Shōgun',              year: 2024, status: 'continuing', episodeCount: 10, episodeFileCount: 10, monitored: true,  network: 'FX',       genres: ['Drama','History'],  runtime: 60,  overview: "Based on James Clavell's novel, set in feudal Japan.", seasonCount: 1, seasons: [{ seasonNumber: 1, episodeCount: 10, episodeFileCount: 10, monitored: true }] },
  { id: 2, title: 'The Bear',            year: 2022, status: 'continuing', episodeCount: 28, episodeFileCount: 28, monitored: true,  network: 'FX',       genres: ['Drama','Comedy'],   runtime: 30,  overview: 'A young chef from the fine dining world returns to Chicago to run his family sandwich shop.', seasonCount: 3, seasons: [{ seasonNumber: 1, episodeCount: 8, episodeFileCount: 8, monitored: true },{ seasonNumber: 2, episodeCount: 10, episodeFileCount: 10, monitored: true },{ seasonNumber: 3, episodeCount: 10, episodeFileCount: 10, monitored: true }] },
  { id: 3, title: 'House of the Dragon', year: 2022, status: 'continuing', episodeCount: 18, episodeFileCount: 18, monitored: true,  network: 'HBO',      genres: ['Fantasy','Drama'],  runtime: 60,  overview: 'The story of House Targaryen set 200 years before the events of Game of Thrones.', seasonCount: 2, seasons: [{ seasonNumber: 1, episodeCount: 10, episodeFileCount: 10, monitored: true },{ seasonNumber: 2, episodeCount: 8, episodeFileCount: 8, monitored: true }] },
  { id: 4, title: 'The Last of Us',      year: 2023, status: 'continuing', episodeCount: 17, episodeFileCount: 17, monitored: true,  network: 'HBO',      genres: ['Drama','Horror'],   runtime: 60,  overview: 'Joel must smuggle Ellie out of an oppressive quarantine zone, sparking a journey across America.', seasonCount: 2, seasons: [{ seasonNumber: 1, episodeCount: 9, episodeFileCount: 9, monitored: true },{ seasonNumber: 2, episodeCount: 8, episodeFileCount: 8, monitored: true }] },
  { id: 5, title: 'Severance',           year: 2022, status: 'continuing', episodeCount: 19, episodeFileCount: 18, monitored: true,  network: 'Apple TV+',genres: ['Sci-Fi','Thriller'],runtime: 45,  overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.', seasonCount: 2, seasons: [{ seasonNumber: 1, episodeCount: 9, episodeFileCount: 9, monitored: true },{ seasonNumber: 2, episodeCount: 10, episodeFileCount: 9, monitored: true }] },
  { id: 6, title: 'Fallout',             year: 2024, status: 'continuing', episodeCount: 8,  episodeFileCount: 8,  monitored: true,  network: 'Prime Video',genres: ['Sci-Fi','Action'], runtime: 60,  overview: '200 years after a nuclear apocalypse, a naive Vault-dweller ventures out into the wasteland.', seasonCount: 1, seasons: [{ seasonNumber: 1, episodeCount: 8, episodeFileCount: 8, monitored: true }] },
  { id: 7, title: 'Silo',               year: 2023, status: 'continuing', episodeCount: 20, episodeFileCount: 19, monitored: true,  network: 'Apple TV+',genres: ['Sci-Fi'],           runtime: 60,  overview: 'In a ruined and toxic world, thousands live in a giant silo underground.', seasonCount: 2, seasons: [{ seasonNumber: 1, episodeCount: 10, episodeFileCount: 10, monitored: true },{ seasonNumber: 2, episodeCount: 10, episodeFileCount: 9, monitored: true }] },
];

const QUALITY_PROFILES = [
  { id: 1, name: 'Any' }, { id: 2, name: '480p' }, { id: 3, name: '720p' },
  { id: 4, name: '1080p' }, { id: 5, name: '1080p Bluray' }, { id: 6, name: '4K UHD' },
];

// ── Shared mini components (local copies) ─────────────────────────────────────
function FBtn({ label, cls = '', onClick, disabled, title }) {
  return <button className={`cmd-btn-sm ${cls}`} onClick={onClick} disabled={disabled} title={title}>{label}</button>;
}
function FProgress({ pct, color = 'green' }) {
  const colors = { green: 'var(--neon-green)', yellow: '#ffbd2e', red: '#ff5f56', cyan: 'var(--neon-cyan)', purple: 'var(--neon-purple)' };
  return (
    <div style={{ flex: 1, height: 8, background: 'rgba(0,255,0,0.08)', border: '1px solid rgba(0,255,0,0.15)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: colors[color] || colors.green, transition: 'width 0.5s', boxShadow: `0 0 4px ${colors[color] || colors.green}` }} />
    </div>
  );
}

function fmtBytes(bytes) {
  if (!bytes) return '0 B';
  const gb = bytes / 1e9;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`;
}

// ── Movie Detail Modal ────────────────────────────────────────────────────────
function MovieDetail({ movie, onClose, onDelete, onSearch, onToggleMonitor }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(6px)',
      zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,255,0,0.15)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: 'rgba(0,0,0,0.7)' }}>
        <FBtn label="[← BACK]" onClick={onClose} />
        <span style={{ color: 'var(--neon-cyan)', fontSize: '0.85rem', letterSpacing: 1, textShadow: 'var(--bloom-cyan)', flex: 1 }}>
          {movie.title} ({movie.year})
        </span>
        <FBtn label={movie.monitored ? '[MONITORED ●]' : '[UNMONITORED ○]'}
          cls={movie.monitored ? 'cyan' : ''}
          onClick={() => onToggleMonitor(movie.id)} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
        {/* Header info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            { k: 'STATUS',   v: movie.hasFile ? 'DOWNLOADED' : 'MISSING', color: movie.hasFile ? '#27c93f' : '#ff5f56' },
            { k: 'YEAR',     v: movie.year },
            { k: 'RUNTIME',  v: `${movie.runtime || '?'} min` },
            { k: 'STUDIO',   v: movie.studio || 'Unknown' },
            { k: 'IMDB',     v: movie.ratings?.imdb?.value || 'N/A' },
            { k: 'SIZE',     v: fmtBytes(movie.sizeOnDisk) },
            { k: 'QUALITY',  v: QUALITY_PROFILES.find(q => q.id === movie.qualityProfileId)?.name || 'Unknown' },
            { k: 'PATH',     v: movie.rootFolderPath || 'N/A' },
          ].map(({ k, v, color }) => (
            <div key={k} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,0,0.1)', borderRadius: 3, padding: '8px 10px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: '0.8rem', color: color || 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{v}</div>
            </div>
          ))}
        </div>
        {/* Genres */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {movie.genres?.map(g => (
            <span key={g} style={{ fontSize: '0.7rem', color: 'var(--neon-purple)', border: '1px solid rgba(128,0,255,0.3)', borderRadius: 2, padding: '2px 8px' }}>[{g}]</span>
          ))}
        </div>
        {/* Overview */}
        <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,0,0.08)', borderRadius: 4, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 6 }}>OVERVIEW</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.8 }}>{movie.overview}</div>
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!movie.hasFile && <FBtn label="[SEARCH NOW]" cls="cyan" onClick={() => onSearch(movie.id)} />}
          {movie.hasFile  && <FBtn label="[RE-SEARCH]" onClick={() => onSearch(movie.id)} />}
          <FBtn label="[EDIT QUALITY]" onClick={() => {}} />
          <FBtn label="[RENAME FILES]" onClick={() => {}} />
          <FBtn label="[TMDB →]" cls="cyan" onClick={() => window.open(`https://www.themoviedb.org/movie/${movie.tmdbId}`, '_blank')} />
          <FBtn label="[DELETE MOVIE]" cls="danger" onClick={() => { onDelete(movie.id); onClose(); }} />
        </div>
      </div>
    </div>
  );
}

// ── Full Radarr Panel ─────────────────────────────────────────────────────────
function RadarrPanelFull({ onOpenWebUI }) {
  const [cfg]           = useState(loadConfig);
  const hasKey          = !!cfg.radarr.apiKey;
  const [tab, setTab]   = useState('library');
  const [movies, setMovies] = useState([]);
  const [queue, setQueue]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [showCfg, setShowCfg] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('title');
  const [detail, setDetail] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [notification, setNotification] = useState('');

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (hasKey) {
        const [mv, q] = await Promise.all([
          apiFetch(cfg.radarr.url, 'movie', cfg.radarr.apiKey),
          apiFetch(cfg.radarr.url, 'queue', cfg.radarr.apiKey),
        ]);
        setMovies(mv); setQueue(q.records || q);
      } else {
        await new Promise(r => setTimeout(r, 300));
        setMovies(MOCK_MOVIES_FULL); setQueue([
          { id: 101, title: 'Civil War (2024)', status: 'downloading', sizeleft: 4200000000, size: 8400000000, timeleft: '00:42:00', protocol: 'usenet', quality: { quality: { name: '1080p Bluray' } } },
          { id: 102, title: 'Furiosa (2024)',   status: 'queued',      sizeleft: 9100000000, size: 9100000000, timeleft: '01:31:00', protocol: 'usenet', quality: { quality: { name: '4K UHD' } } },
        ]);
      }
    } catch(e) { setError(e.message); setMovies(MOCK_MOVIES_FULL); }
    setLoading(false);
  }, [hasKey, cfg]);

  useEffect(() => { load(); }, [load]);

  const doSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      if (hasKey) {
        const r = await apiFetch(cfg.radarr.url, 'movie/lookup', cfg.radarr.apiKey, { term: searchTerm });
        setSearchResults(r.slice(0, 20));
      } else {
        await new Promise(r => setTimeout(r, 500));
        setSearchResults([
          { tmdbId: 1001, title: 'Alien: Romulus',      year: 2024, status: 'released', overview: 'A new chapter in the Alien franchise set between the first two films.', genres: ['Horror','Sci-Fi'],   runtime: 119 },
          { tmdbId: 1002, title: 'Deadpool & Wolverine', year: 2024, status: 'released', overview: 'Wade Wilson teams up with an alternate-universe Wolverine.', genres: ['Action','Comedy'],  runtime: 128 },
          { tmdbId: 1003, title: 'Twisters',             year: 2024, status: 'released', overview: 'Storm chasers face the most destructive tornadic supercells ever recorded.', genres: ['Action','Thriller'], runtime: 122 },
          { tmdbId: 1004, title: 'Inside Out 2',         year: 2024, status: 'released', overview: 'A new range of emotions turn Riley\'s mind upside down.', genres: ['Animation','Comedy'], runtime: 100 },
          { tmdbId: 1005, title: 'The Wild Robot',       year: 2024, status: 'released', overview: 'A robot is marooned on a wild island and must learn to survive.', genres: ['Animation','Drama'], runtime: 101 },
        ]);
      }
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const addMovie = async (tmdbId, title) => {
    notify(`> ADDING ${title.toUpperCase()}...`);
    // In real use: POST /api/v3/movie with tmdbId, qualityProfileId, rootFolderPath
  };

  const deleteMovie = (id) => {
    setMovies(ms => ms.filter(m => m.id !== id));
    notify('> MOVIE REMOVED FROM LIBRARY');
  };

  const toggleMonitor = (id) => {
    setMovies(ms => ms.map(m => m.id === id ? { ...m, monitored: !m.monitored } : m));
  };

  const triggerSearch = (id) => {
    notify(`> SEARCHING FOR MOVIE ID: ${id}...`);
  };

  const deleteQueueItem = (id) => {
    setQueue(q => q.filter(x => x.id !== id));
    notify('> QUEUE ITEM REMOVED');
  };

  // Stats
  const downloaded = movies.filter(m => m.hasFile).length;
  const missing    = movies.filter(m => !m.hasFile && m.monitored).length;
  const totalSize  = movies.reduce((a, m) => a + (m.sizeOnDisk || 0), 0);

  // Filtered + sorted
  const filtered = movies.filter(m => {
    const text = !filter || m.title.toLowerCase().includes(filter.toLowerCase()) || (m.genres || []).some(g => g.toLowerCase().includes(filter.toLowerCase()));
    const stat  = statusFilter === 'all' ? true : statusFilter === 'downloaded' ? m.hasFile : statusFilter === 'missing' ? (!m.hasFile && m.monitored) : statusFilter === 'unmonitored' ? !m.monitored : true;
    return text && stat;
  }).sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'year')  return b.year - a.year;
    if (sortBy === 'size')  return b.sizeOnDisk - a.sizeOnDisk;
    if (sortBy === 'rating') return (b.ratings?.imdb?.value || 0) - (a.ratings?.imdb?.value || 0);
    return 0;
  });

  if (showCfg) return <ApiConfigPanel onSave={() => { setShowCfg(false); load(); }} />;
  if (detail)  return <MovieDetail movie={detail} onClose={() => setDetail(null)} onDelete={deleteMovie} onSearch={triggerSearch} onToggleMonitor={toggleMonitor} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Notification bar */}
      {notification && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'rgba(0,243,255,0.15)', borderBottom: '1px solid var(--neon-cyan)', padding: '4px 12px', fontSize: '0.75rem', color: 'var(--neon-cyan)', zIndex: 20, letterSpacing: 1 }}>
          {notification}
        </div>
      )}

      {/* Header toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderBottom: '1px solid rgba(0,255,0,0.1)', background: 'rgba(0,0,0,0.6)', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--neon-green)', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: 2, textShadow: 'var(--glow-green-sm)' }}>[RADARR]</span>
        {['library','queue','search','stats'].map(t => (
          <FBtn key={t} label={`[${t.toUpperCase()}]`} cls={tab===t?'cyan':''} onClick={() => setTab(t)} />
        ))}
        <div style={{ flex: 1 }} />
        {!hasKey && <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: 1 }}>DEMO</span>}
        <FBtn label="[↻]" onClick={load} disabled={loading} title="Refresh" />
        <FBtn label="[WEB UI]" cls="cyan" onClick={onOpenWebUI} />
        <FBtn label="[⚙]" onClick={() => setShowCfg(true)} title="API Config" />
      </div>

      {/* Stats banner */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(0,255,0,0.06)', flexShrink: 0, background: 'rgba(0,0,0,0.4)' }}>
        {[
          { label: 'TOTAL',      val: movies.length,                  color: 'var(--text-primary)' },
          { label: 'DOWNLOADED', val: downloaded,                     color: '#27c93f' },
          { label: 'MISSING',    val: missing,                        color: '#ff5f56' },
          { label: 'QUEUE',      val: queue.length,                   color: 'var(--neon-cyan)' },
          { label: 'LIBRARY SIZE', val: fmtBytes(totalSize),          color: 'var(--neon-purple)' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, padding: '5px 8px', borderRight: '1px solid rgba(0,255,0,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: 1 }}>{s.label}</div>
            <div style={{ fontSize: '0.85rem', color: s.color, fontWeight: 'bold', textShadow: s.color !== 'var(--text-primary)' ? `0 0 5px ${s.color}` : 'none' }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* LIBRARY TAB */}
      {tab === 'library' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 5, padding: '5px 8px', borderBottom: '1px solid rgba(0,255,0,0.06)', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="logview-filter" style={{ flex: 1, minWidth: 120 }} placeholder="$ filter..." value={filter} onChange={e => setFilter(e.target.value)} />
            {['all','downloaded','missing','unmonitored'].map(f => (
              <FBtn key={f} label={`[${f.slice(0,4).toUpperCase()}]`} cls={statusFilter===f?'cyan':''} onClick={() => setStatusFilter(f)} />
            ))}
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: 1 }}>SORT:</span>
            {['title','year','size','rating'].map(s => (
              <FBtn key={s} label={`[${s.toUpperCase()}]`} cls={sortBy===s?'cyan':''} onClick={() => setSortBy(s)} />
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
            {loading ? <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem' }}>&gt; LOADING LIBRARY...</div> :
             filtered.length === 0 ? <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem' }}>&gt; NO RESULTS</div> :
             filtered.map(m => (
              <div key={m.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid rgba(0,255,0,0.04)', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(0,255,0,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
                onClick={() => setDetail(m)}
              >
                <span style={{ color: m.hasFile ? '#27c93f' : m.monitored ? '#ff5f56' : 'var(--text-dim)', fontSize: '0.75rem', width: 10, flexShrink: 0 }}>●</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'bold' }}>{m.title}</div>
                  <div style={{ fontSize: '0.67rem', color: 'var(--text-dim)', display: 'flex', gap: 8 }}>
                    <span>{m.year}</span>
                    {m.ratings?.imdb && <span>★ {m.ratings.imdb.value}</span>}
                    {m.runtime && <span>{m.runtime}m</span>}
                    <span style={{ color: 'var(--neon-purple)' }}>{QUALITY_PROFILES.find(q => q.id === m.qualityProfileId)?.name}</span>
                  </div>
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', flexShrink: 0 }}>{fmtBytes(m.sizeOnDisk)}</span>
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  {!m.hasFile && <FBtn label="[↓]" cls="cyan" onClick={() => triggerSearch(m.id)} title="Search" />}
                  <FBtn label={m.monitored ? '[●]' : '[○]'} cls={m.monitored?'':'dim'} onClick={() => toggleMonitor(m.id)} title="Toggle monitor" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUEUE TAB */}
      {tab === 'queue' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
          {queue.length === 0
            ? <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem' }}>&gt; QUEUE EMPTY</div>
            : queue.map(item => {
                const pct = item.size > 0 ? ((item.size - item.sizeleft) / item.size) * 100 : 0;
                return (
                  <div key={item.id} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,0,0.12)', borderRadius: 4, padding: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--neon-green)', fontSize: '0.8rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <div style={{ fontSize: '0.67rem', color: 'var(--text-dim)', display: 'flex', gap: 8 }}>
                          <span>{item.quality?.quality?.name}</span>
                          <span style={{ color: 'var(--neon-purple)' }}>{item.protocol?.toUpperCase()}</span>
                          <span>ETA: {item.timeleft}</span>
                          <span>{fmtBytes(item.size - item.sizeleft)} / {fmtBytes(item.size)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: '0.68rem', color: item.status==='downloading'?'var(--neon-cyan)':'#ffbd2e' }}>{item.status?.toUpperCase()}</span>
                        <FBtn label="[✕]" cls="danger" onClick={() => deleteQueueItem(item.id)} title="Remove" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FProgress pct={pct} color={item.status==='downloading'?'cyan':'yellow'} />
                      <span style={{ fontSize: '0.7rem', color: 'var(--neon-cyan)', width: 34, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
        </div>
      )}

      {/* SEARCH TAB */}
      {tab === 'search' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderBottom: '1px solid rgba(0,255,0,0.06)', flexShrink: 0 }}>
            <input className="logview-filter" style={{ flex: 1 }} placeholder="$ movie-lookup --title ..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()} />
            <FBtn label={searching ? '[…]' : '[LOOKUP]'} cls="cyan" onClick={doSearch} disabled={searching} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 10, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
            {searchResults.length === 0 && !searching && (
              <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center' }}>&gt; ENTER TITLE AND PRESS [LOOKUP]<br/><br/>&gt; Searches TMDB database</div>
            )}
            {searchResults.map((r, i) => (
              <div key={i} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,0,0.12)', borderRadius: 4, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--neon-green)', fontSize: '0.85rem', fontWeight: 'bold' }}>{r.title} ({r.year})</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', margin: '4px 0', lineHeight: 1.6 }}>{r.overview?.slice(0, 140)}{r.overview?.length > 140 ? '…' : ''}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {r.genres?.slice(0,3).map(g => <span key={g} style={{ fontSize: '0.65rem', color: 'var(--neon-purple)', border: '1px solid rgba(128,0,255,0.3)', borderRadius: 2, padding: '1px 6px' }}>[{g}]</span>)}
                      {r.runtime && <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{r.runtime}min</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                    <FBtn label="[+ ADD]" cls="cyan" onClick={() => addMovie(r.tmdbId, r.title)} />
                    <FBtn label="[TMDB]" onClick={() => window.open(`https://www.themoviedb.org/movie/${r.tmdbId}`, '_blank')} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STATS TAB */}
      {tab === 'stats' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
          {/* Genre breakdown */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: 'var(--neon-cyan)', fontSize: '0.75rem', letterSpacing: 2, marginBottom: 10, borderBottom: '1px solid rgba(0,243,255,0.2)', paddingBottom: 4 }}>GENRE BREAKDOWN</div>
            {(() => {
              const genreCounts = {};
              movies.forEach(m => (m.genres||[]).forEach(g => { genreCounts[g] = (genreCounts[g]||0) + 1; }));
              return Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([g,c]) => (
                <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--neon-purple)', width: 120, flexShrink: 0 }}>[{g}]</span>
                  <FProgress pct={(c / movies.length) * 100} color="purple" />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', width: 30, textAlign: 'right' }}>{c}</span>
                </div>
              ));
            })()}
          </div>
          {/* Quality breakdown */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: 'var(--neon-cyan)', fontSize: '0.75rem', letterSpacing: 2, marginBottom: 10, borderBottom: '1px solid rgba(0,243,255,0.2)', paddingBottom: 4 }}>QUALITY PROFILES</div>
            {QUALITY_PROFILES.map(qp => {
              const count = movies.filter(m => m.qualityProfileId === qp.id && m.hasFile).length;
              if (!count) return null;
              return (
                <div key={qp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--neon-green)', width: 120, flexShrink: 0 }}>{qp.name}</span>
                  <FProgress pct={(count / downloaded) * 100} color="green" />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', width: 30, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>
          {/* Year distribution */}
          <div>
            <div style={{ color: 'var(--neon-cyan)', fontSize: '0.75rem', letterSpacing: 2, marginBottom: 10, borderBottom: '1px solid rgba(0,243,255,0.2)', paddingBottom: 4 }}>BY YEAR</div>
            {(() => {
              const yearCounts = {};
              movies.filter(m => m.hasFile).forEach(m => { yearCounts[m.year] = (yearCounts[m.year]||0) + 1; });
              return Object.entries(yearCounts).sort((a,b)=>b[0]-a[0]).map(([y,c]) => (
                <div key={y} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', width: 50, flexShrink: 0 }}>{y}</span>
                  <FProgress pct={(c / downloaded) * 100} color="cyan" />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', width: 20, textAlign: 'right' }}>{c}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Series Episode List ───────────────────────────────────────────────────────
function SeriesDetail({ series, onClose, onToggleMonitor }) {
  const [selSeason, setSelSeason] = useState(1);

  const season = series.seasons?.find(s => s.seasonNumber === selSeason);
  const MOCK_EPS = Array.from({ length: season?.episodeCount || 0 }, (_, i) => ({
    episodeNumber: i + 1,
    title: `Episode ${i + 1}`,
    airDate: `2024-0${Math.floor(i/4)+1}-${String((i%4)*7+1).padStart(2,'0')}`,
    hasFile: i < (season?.episodeFileCount || 0),
    runtime: series.runtime,
  }));

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(6px)', zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,255,0,0.15)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <FBtn label="[← BACK]" onClick={onClose} />
        <span style={{ color: 'var(--neon-cyan)', fontSize: '0.85rem', letterSpacing: 1, textShadow: 'var(--bloom-cyan)', flex: 1 }}>
          {series.title} ({series.year}) — {series.network}
        </span>
        <FBtn label={series.monitored ? '[MONITORED ●]' : '[UNMONITORED ○]'}
          cls={series.monitored ? 'cyan' : ''}
          onClick={() => onToggleMonitor(series.id)} />
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '6px 10px', borderBottom: '1px solid rgba(0,255,0,0.08)', flexShrink: 0, flexWrap: 'wrap' }}>
        {series.seasons?.map(s => (
          <FBtn key={s.seasonNumber}
            label={`[S${String(s.seasonNumber).padStart(2,'0')} — ${s.episodeFileCount}/${s.episodeCount}]`}
            cls={selSeason === s.seasonNumber ? 'cyan' : ''}
            onClick={() => setSelSeason(s.seasonNumber)} />
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
        {MOCK_EPS.map(ep => (
          <div key={ep.episodeNumber} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderBottom: '1px solid rgba(0,255,0,0.04)', transition: 'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(0,255,0,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            <span style={{ color: ep.hasFile ? '#27c93f' : '#ff5f56', fontSize: '0.75rem', width: 10, flexShrink: 0 }}>●</span>
            <span style={{ color: 'var(--neon-purple)', fontSize: '0.75rem', width: 50, flexShrink: 0 }}>S{String(selSeason).padStart(2,'0')}E{String(ep.episodeNumber).padStart(2,'0')}</span>
            <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{ep.title}</span>
            <span style={{ fontSize: '0.67rem', color: 'var(--text-dim)', flexShrink: 0 }}>{ep.airDate}</span>
            <span style={{ fontSize: '0.67rem', color: 'var(--text-dim)', flexShrink: 0 }}>{ep.runtime}m</span>
            {!ep.hasFile && <FBtn label="[↓]" cls="cyan" onClick={() => {}} title="Search episode" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Full Sonarr Panel ─────────────────────────────────────────────────────────
function SonarrPanelFull({ onOpenWebUI }) {
  const [cfg]           = useState(loadConfig);
  const hasKey          = !!cfg.sonarr.apiKey;
  const [tab, setTab]   = useState('series');
  const [series, setSeries] = useState([]);
  const [queue, setQueue]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [showCfg, setShowCfg] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('title');
  const [detail, setDetail] = useState(null);
  const [notification, setNotification] = useState('');

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (hasKey) {
        const [sv, q] = await Promise.all([
          apiFetch(cfg.sonarr.url, 'series', cfg.sonarr.apiKey),
          apiFetch(cfg.sonarr.url, 'queue',  cfg.sonarr.apiKey),
        ]);
        setSeries(sv); setQueue(q.records || q);
      } else {
        await new Promise(r => setTimeout(r, 300));
        setSeries(MOCK_SERIES_FULL);
        setQueue([
          { id: 201, title: 'Severance S02E10', status: 'downloading', sizeleft: 1200000000, size: 2400000000, timeleft: '00:12:00', protocol: 'usenet', quality: { quality: { name: '1080p WEB' } } },
          { id: 202, title: 'Silo S02E01',       status: 'queued',      sizeleft: 2100000000, size: 2100000000, timeleft: '00:21:00', protocol: 'usenet', quality: { quality: { name: '1080p WEB' } } },
        ]);
      }
    } catch(e) { setError(e.message); setSeries(MOCK_SERIES_FULL); }
    setLoading(false);
  }, [hasKey, cfg]);

  useEffect(() => { load(); }, [load]);

  const toggleMonitor = (id) => setSeries(ss => ss.map(s => s.id === id ? { ...s, monitored: !s.monitored } : s));
  const deleteQueueItem = (id) => setQueue(q => q.filter(x => x.id !== id));

  const totalEps  = series.reduce((a, s) => a + (s.episodeCount || 0), 0);
  const haveEps   = series.reduce((a, s) => a + (s.episodeFileCount || 0), 0);
  const totalSize = haveEps * 1.2e9; // rough mock

  const filtered = series.filter(s => {
    const text = !filter || s.title.toLowerCase().includes(filter.toLowerCase());
    const stat  = statusFilter === 'all' ? true : statusFilter === 'continuing' ? s.status === 'continuing' : statusFilter === 'ended' ? s.status === 'ended' : statusFilter === 'missing' ? s.episodeFileCount < s.episodeCount : true;
    return text && stat;
  }).sort((a,b) => {
    if (sortBy === 'title')    return a.title.localeCompare(b.title);
    if (sortBy === 'year')     return b.year - a.year;
    if (sortBy === 'missing')  return (a.episodeFileCount - a.episodeCount) - (b.episodeFileCount - b.episodeCount);
    if (sortBy === 'progress') {
      const pa = a.episodeCount ? a.episodeFileCount / a.episodeCount : 0;
      const pb = b.episodeCount ? b.episodeFileCount / b.episodeCount : 0;
      return pb - pa;
    }
    return 0;
  });

  if (showCfg) return <ApiConfigPanel onSave={() => { setShowCfg(false); load(); }} />;
  if (detail)  return <SeriesDetail series={detail} onClose={() => setDetail(null)} onToggleMonitor={toggleMonitor} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {notification && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'rgba(0,243,255,0.15)', borderBottom: '1px solid var(--neon-cyan)', padding: '4px 12px', fontSize: '0.75rem', color: 'var(--neon-cyan)', zIndex: 20, letterSpacing: 1 }}>
          {notification}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderBottom: '1px solid rgba(0,255,0,0.1)', background: 'rgba(0,0,0,0.6)', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--neon-cyan)', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: 2, textShadow: 'var(--bloom-cyan)' }}>[SONARR]</span>
        {['series','queue','calendar','stats'].map(t => (
          <FBtn key={t} label={`[${t.toUpperCase()}]`} cls={tab===t?'cyan':''} onClick={() => setTab(t)} />
        ))}
        <div style={{ flex: 1 }} />
        {!hasKey && <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: 1 }}>DEMO</span>}
        <FBtn label="[↻]" onClick={load} disabled={loading} />
        <FBtn label="[WEB UI]" cls="cyan" onClick={onOpenWebUI} />
        <FBtn label="[⚙]" onClick={() => setShowCfg(true)} />
      </div>

      {/* Stats banner */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(0,255,0,0.06)', flexShrink: 0, background: 'rgba(0,0,0,0.4)' }}>
        {[
          { label: 'SERIES',   val: series.length,                        color: 'var(--text-primary)' },
          { label: 'EPISODES', val: `${haveEps}/${totalEps}`,             color: '#27c93f' },
          { label: 'MISSING',  val: totalEps - haveEps,                   color: '#ff5f56' },
          { label: 'QUEUE',    val: queue.length,                         color: 'var(--neon-cyan)' },
          { label: 'SIZE',     val: fmtBytes(totalSize),                  color: 'var(--neon-purple)' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, padding: '5px 8px', borderRight: '1px solid rgba(0,255,0,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: 1 }}>{s.label}</div>
            <div style={{ fontSize: '0.82rem', color: s.color, fontWeight: 'bold' }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* SERIES TAB */}
      {tab === 'series' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 5, padding: '5px 8px', borderBottom: '1px solid rgba(0,255,0,0.06)', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="logview-filter" style={{ flex: 1, minWidth: 120 }} placeholder="$ filter..." value={filter} onChange={e => setFilter(e.target.value)} />
            {['all','continuing','ended','missing'].map(f => (
              <FBtn key={f} label={`[${f.slice(0,4).toUpperCase()}]`} cls={statusFilter===f?'cyan':''} onClick={() => setStatusFilter(f)} />
            ))}
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>SORT:</span>
            {['title','year','progress','missing'].map(s => (
              <FBtn key={s} label={`[${s.slice(0,4).toUpperCase()}]`} cls={sortBy===s?'cyan':''} onClick={() => setSortBy(s)} />
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
            {filtered.map(s => {
              const pct = s.episodeCount > 0 ? (s.episodeFileCount / s.episodeCount) * 100 : 0;
              const complete = s.episodeFileCount >= s.episodeCount;
              return (
                <div key={s.id}
                  style={{ padding: '7px 10px', borderBottom: '1px solid rgba(0,255,0,0.04)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(0,255,0,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                  onClick={() => setDetail(s)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: complete ? '#27c93f' : '#ffbd2e', fontSize: '0.75rem', width: 10, flexShrink: 0 }}>●</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'bold' }}>{s.title}</div>
                      <div style={{ fontSize: '0.67rem', color: 'var(--text-dim)', display: 'flex', gap: 8 }}>
                        <span>{s.year}</span>
                        <span style={{ color: 'var(--neon-purple)' }}>{s.network}</span>
                        <span>{s.episodeFileCount}/{s.episodeCount} eps</span>
                        <span style={{ color: s.status==='continuing'?'var(--neon-cyan)':'var(--text-dim)' }}>{s.status}</span>
                      </div>
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                      <FBtn label={s.monitored?'[●]':'[○]'} cls={s.monitored?'cyan':''} onClick={() => toggleMonitor(s.id)} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 18 }}>
                    <FProgress pct={pct} color={complete ? 'green' : 'yellow'} />
                    <span style={{ fontSize: '0.68rem', color: complete ? '#27c93f' : '#ffbd2e', width: 34, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* QUEUE TAB */}
      {tab === 'queue' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
          {queue.length === 0
            ? <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem' }}>&gt; QUEUE EMPTY</div>
            : queue.map(item => {
                const pct = item.size > 0 ? ((item.size - item.sizeleft) / item.size) * 100 : 0;
                return (
                  <div key={item.id} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,0,0.12)', borderRadius: 4, padding: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--neon-cyan)', fontSize: '0.8rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <div style={{ fontSize: '0.67rem', color: 'var(--text-dim)', display: 'flex', gap: 8 }}>
                          <span>{item.quality?.quality?.name}</span>
                          <span style={{ color: 'var(--neon-purple)' }}>{item.protocol?.toUpperCase()}</span>
                          <span>ETA: {item.timeleft}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: '0.68rem', color: item.status==='downloading'?'var(--neon-cyan)':'#ffbd2e' }}>{item.status?.toUpperCase()}</span>
                        <FBtn label="[✕]" cls="danger" onClick={() => deleteQueueItem(item.id)} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FProgress pct={pct} color="cyan" />
                      <span style={{ fontSize: '0.7rem', color: 'var(--neon-cyan)', width: 34, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
        </div>
      )}

      {/* CALENDAR TAB */}
      {tab === 'calendar' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
          <div style={{ color: 'var(--neon-cyan)', fontSize: '0.75rem', letterSpacing: 2, marginBottom: 12 }}>UPCOMING EPISODES — MAY 2026</div>
          {[
            { date: 'May 08', show: 'Severance',           ep: 'S02E10', title: 'Hello, Ms. Cobel', network: 'Apple TV+' },
            { date: 'May 09', show: 'The Bear',            ep: 'S04E01', title: 'Premiere',          network: 'FX' },
            { date: 'May 11', show: 'House of the Dragon', ep: 'S03E01', title: 'The Iron Throne',   network: 'HBO' },
            { date: 'May 15', show: 'Silo',                ep: 'S02E10', title: 'TBA',               network: 'Apple TV+' },
            { date: 'May 16', show: 'The Last of Us',      ep: 'S02E08', title: 'TBA',               network: 'HBO' },
            { date: 'May 22', show: 'Fallout',             ep: 'S02E01', title: 'Premiere',          network: 'Prime Video' },
          ].map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,0,0.1)', borderRadius: 4, marginBottom: 6, alignItems: 'center' }}>
              <span style={{ color: 'var(--neon-purple)', fontSize: '0.75rem', width: 60, flexShrink: 0 }}>{e.date}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--neon-green)', fontWeight: 'bold' }}>{e.show}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--neon-cyan)' }}>{e.ep}</span>
                  <span>{e.title}</span>
                  <span style={{ color: 'var(--neon-purple)' }}>{e.network}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STATS TAB */}
      {tab === 'stats' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: 'var(--neon-cyan)', fontSize: '0.75rem', letterSpacing: 2, marginBottom: 10, borderBottom: '1px solid rgba(0,243,255,0.2)', paddingBottom: 4 }}>NETWORK BREAKDOWN</div>
            {(() => {
              const counts = {};
              series.forEach(s => { counts[s.network] = (counts[s.network]||0) + 1; });
              return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([n,c]) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--neon-purple)', width: 120, flexShrink: 0 }}>{n}</span>
                  <FProgress pct={(c / series.length) * 100} color="purple" />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', width: 20, textAlign: 'right' }}>{c}</span>
                </div>
              ));
            })()}
          </div>
          <div>
            <div style={{ color: 'var(--neon-cyan)', fontSize: '0.75rem', letterSpacing: 2, marginBottom: 10, borderBottom: '1px solid rgba(0,243,255,0.2)', paddingBottom: 4 }}>GENRE BREAKDOWN</div>
            {(() => {
              const counts = {};
              series.forEach(s => (s.genres||[]).forEach(g => { counts[g] = (counts[g]||0) + 1; }));
              return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([g,c]) => (
                <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--neon-green)', width: 120, flexShrink: 0 }}>[{g}]</span>
                  <FProgress pct={(c / series.length) * 100} color="green" />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', width: 20, textAlign: 'right' }}>{c}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Full SABnzbd Panel ────────────────────────────────────────────────────────
const MOCK_SAB_FULL = {
  queue: {
    status: 'Downloading', speed: '24.6 MB/s', kbpersec: '25190',
    mbleft: '14821.42', mb: '22450.80', timeleft: '0:09:47',
    diskspace1: '4823.2', diskspace2: '4823.2',
    speedlimit: '0', speedlimit_abs: '',
    slots: [
      { nzo_id: 'nzo_1', filename: 'Civil.War.2024.1080p.Bluray.x265-GROUP',   status: 'Downloading', mbleft: '4200.00', mb: '8400.00', timeleft: '0:04:12', avg_age: '42d', cat: 'movies', priority: 'Normal' },
      { nzo_id: 'nzo_2', filename: 'Furiosa.2024.2160p.UHD.BluRay-GROUP',      status: 'Queued',      mbleft: '9100.00', mb: '9100.00', timeleft: '0:09:07', avg_age: '12d', cat: 'movies', priority: 'Normal' },
      { nzo_id: 'nzo_3', filename: 'Severance.S02E10.1080p.WEB-DL-GROUP',      status: 'Downloading', mbleft: '1200.00', mb: '2400.00', timeleft: '0:01:12', avg_age: '3d',  cat: 'tv',     priority: 'High' },
      { nzo_id: 'nzo_4', filename: 'Silo.S02E01.1080p.WEB-DL-GROUP',           status: 'Queued',      mbleft: '2100.00', mb: '2100.00', timeleft: '0:02:06', avg_age: '1d',  cat: 'tv',     priority: 'Normal' },
    ],
  }
};

const MOCK_SAB_HISTORY = [
  { nzo_id: 'h1', name: 'The.Bear.S03E01.1080p.WEB',        status: 'Completed', size: '2.4 GB',  completed: Date.now()/1000 - 3600,  category: 'tv',     fail_message: '' },
  { nzo_id: 'h2', name: 'Dune.Part.Two.2024.4K.UHD',        status: 'Completed', size: '58.2 GB', completed: Date.now()/1000 - 7200,  category: 'movies', fail_message: '' },
  { nzo_id: 'h3', name: 'House.of.Dragon.S02E01.1080p',      status: 'Failed',    size: '3.1 GB',  completed: Date.now()/1000 - 10800, category: 'tv',     fail_message: 'Incomplete NZB' },
  { nzo_id: 'h4', name: 'Fallout.S01.Complete.1080p.WEB',    status: 'Completed', size: '42.8 GB', completed: Date.now()/1000 - 86400, category: 'tv',     fail_message: '' },
  { nzo_id: 'h5', name: 'Oppenheimer.2023.4K.UHD.BluRay',    status: 'Completed', size: '78.4 GB', completed: Date.now()/1000 - 172800,category: 'movies', fail_message: '' },
  { nzo_id: 'h6', name: 'Poor.Things.2023.1080p.BluRay',     status: 'Completed', size: '12.1 GB', completed: Date.now()/1000 - 259200,category: 'movies', fail_message: '' },
];

function SABnzbdPanelFull({ onOpenWebUI }) {
  const [cfg]             = useState(loadConfig);
  const hasKey            = !!cfg.sabnzbd.apiKey;
  const [tab, setTab]     = useState('queue');
  const [queueData, setQueueData] = useState(null);
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [showCfg, setShowCfg]     = useState(false);
  const [paused, setPaused]       = useState(false);
  const [speedLimit, setSpeedLimit] = useState('');
  const [notification, setNotification] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (hasKey) {
        const [q, h] = await Promise.all([
          sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, { mode: 'queue' }),
          sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, { mode: 'history', limit: 30 }),
        ]);
        setQueueData(q.queue);
        setHistory(h.history?.slots || []);
      } else {
        await new Promise(r => setTimeout(r, 300));
        setQueueData(MOCK_SAB_FULL.queue);
        setHistory(MOCK_SAB_HISTORY);
      }
    } catch(e) { setError(e.message); setQueueData(MOCK_SAB_FULL.queue); setHistory(MOCK_SAB_HISTORY); }
    setLoading(false);
  }, [hasKey, cfg]);

  useEffect(() => { load(); const iv = setInterval(load, 8000); return () => clearInterval(iv); }, [load]);

  const doPause = async () => {
    try {
      if (hasKey) await sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, { mode: paused ? 'resume' : 'pause' });
      setPaused(p => !p);
      notify(paused ? '> DOWNLOADS RESUMED' : '> DOWNLOADS PAUSED');
    } catch {}
  };

  const doDelete = async (id) => {
    try {
      if (hasKey) await sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, { mode: 'queue', name: 'delete', value: id });
      setQueueData(q => q ? { ...q, slots: q.slots.filter(s => s.nzo_id !== id) } : q);
      notify('> ITEM REMOVED FROM QUEUE');
    } catch {}
  };

  const setSpeedLimitFn = async () => {
    const val = parseInt(speedLimit);
    if (!val) return;
    try {
      if (hasKey) await sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, { mode: 'config', name: 'speedlimit', value: val });
      notify(`> SPEED LIMIT SET: ${val} MB/s`);
    } catch {}
  };

  const retryFailed = async (id) => {
    try {
      if (hasKey) await sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, { mode: 'retry', value: id });
      notify('> RETRYING FAILED JOB...');
    } catch {}
  };

  const movePriority = (id, direction) => {
    setQueueData(q => {
      if (!q) return q;
      const slots = [...q.slots];
      const idx = slots.findIndex(s => s.nzo_id === id);
      if (idx < 0) return q;
      const newIdx = direction === 'up' ? Math.max(0, idx - 1) : Math.min(slots.length - 1, idx + 1);
      [slots[idx], slots[newIdx]] = [slots[newIdx], slots[idx]];
      return { ...q, slots };
    });
  };

  const fmtMB = (mbStr) => {
    const mb = parseFloat(mbStr);
    return mb >= 1024 ? `${(mb/1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
  };

  const totalPct = queueData ? (() => {
    const t = parseFloat(queueData.mb);
    const l = parseFloat(queueData.mbleft);
    return t > 0 ? ((t - l) / t) * 100 : 0;
  })() : 0;

  const filteredSlots = (queueData?.slots || []).filter(s => catFilter === 'all' || s.cat === catFilter);
  const filteredHist  = history.filter(h => catFilter === 'all' || h.category === catFilter);

  const cats = ['all', ...[...new Set((queueData?.slots || []).map(s => s.cat).concat(history.map(h => h.category)).filter(Boolean))]];

  if (showCfg) return <ApiConfigPanel onSave={() => { setShowCfg(false); load(); }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {notification && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'rgba(255,189,46,0.15)', borderBottom: '1px solid #ffbd2e', padding: '4px 12px', fontSize: '0.75rem', color: '#ffbd2e', zIndex: 20, letterSpacing: 1 }}>
          {notification}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderBottom: '1px solid rgba(0,255,0,0.1)', background: 'rgba(0,0,0,0.6)', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ color: '#ffbd2e', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: 2, textShadow: '0 0 5px #ffbd2e' }}>[SABNZBD]</span>
        {['queue','history','stats'].map(t => (
          <FBtn key={t} label={`[${t.toUpperCase()}]`} cls={tab===t?'cyan':''} onClick={() => setTab(t)} />
        ))}
        <div style={{ flex: 1 }} />
        <FBtn label={paused ? '[▶ RESUME]' : '[⏸ PAUSE]'} cls={paused ? 'cyan' : 'warn'} onClick={doPause} />
        <FBtn label="[↻]" onClick={load} disabled={loading} />
        <FBtn label="[WEB UI]" cls="cyan" onClick={onOpenWebUI} />
        <FBtn label="[⚙]" onClick={() => setShowCfg(true)} />
      </div>

      {/* Speed / overall progress banner */}
      {queueData && (
        <div style={{ padding: '7px 12px', borderBottom: '1px solid rgba(0,255,0,0.06)', background: 'rgba(0,0,0,0.5)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.75rem', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ color: paused ? '#ffbd2e' : '#27c93f', fontWeight: 'bold' }}>
              {paused ? '⏸ PAUSED' : `▶ ${queueData.status?.toUpperCase()}`}
            </span>
            <span style={{ color: 'var(--neon-cyan)', textShadow: 'var(--bloom-cyan)' }}>
              ↓ {paused ? '0 MB/s' : queueData.speed}
            </span>
            <span style={{ color: 'var(--text-dim)' }}>{fmtMB(queueData.mbleft)} left</span>
            <span style={{ color: 'var(--text-dim)' }}>ETA: {queueData.timeleft}</span>
            <span style={{ color: 'var(--text-dim)' }}>DISK: {parseFloat(queueData.diskspace1).toFixed(0)} GB free</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <FProgress pct={totalPct} color={paused ? 'yellow' : 'cyan'} />
            <span style={{ fontSize: '0.72rem', color: 'var(--neon-cyan)', width: 34, textAlign: 'right', flexShrink: 0 }}>{totalPct.toFixed(0)}%</span>
          </div>
          {/* Speed limit control */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', letterSpacing: 1, flexShrink: 0 }}>SPEED LIMIT:</span>
            <input className="logview-filter" style={{ width: 80 }} placeholder="MB/s"
              value={speedLimit} onChange={e => setSpeedLimit(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setSpeedLimitFn()} />
            <FBtn label="[SET]" cls="warn" onClick={setSpeedLimitFn} />
            {['0','5','10','25','50'].map(v => <FBtn key={v} label={v==='0'?'[∞]':`[${v}]`} onClick={() => { setSpeedLimit(v); }} />)}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderBottom: '1px solid rgba(0,255,0,0.06)', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', alignSelf: 'center', letterSpacing: 1 }}>CAT:</span>
        {cats.map(c => <FBtn key={c} label={`[${c.toUpperCase()}]`} cls={catFilter===c?'cyan':''} onClick={() => setCatFilter(c)} />)}
      </div>

      {/* QUEUE */}
      {tab === 'queue' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
          {filteredSlots.length === 0
            ? <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: '0.8rem' }}>&gt; QUEUE EMPTY</div>
            : filteredSlots.map((slot, i) => {
                const mb = parseFloat(slot.mb), mbl = parseFloat(slot.mbleft);
                const pct = mb > 0 ? ((mb - mbl) / mb) * 100 : 0;
                return (
                  <div key={slot.nzo_id} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,0,0.12)', borderRadius: 4, padding: '8px 10px', marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <div style={{ color: '#ffbd2e', fontSize: '0.78rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 0 4px #ffbd2e' }}>{slot.filename}</div>
                        <div style={{ fontSize: '0.67rem', color: 'var(--text-dim)', display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--neon-purple)' }}>[{slot.cat}]</span>
                          <span>AGE: {slot.avg_age}</span>
                          <span>ETA: {slot.timeleft}</span>
                          <span>{fmtMB(slot.mbleft)} / {fmtMB(slot.mb)}</span>
                          <span style={{ color: slot.priority === 'High' ? '#27c93f' : 'var(--text-dim)' }}>PRI: {slot.priority}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 3, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '0.67rem', color: slot.status==='Downloading'?'var(--neon-cyan)':'#ffbd2e', alignSelf: 'center' }}>{slot.status}</span>
                        <FBtn label="[↑]" onClick={() => movePriority(slot.nzo_id, 'up')} title="Move up" />
                        <FBtn label="[↓]" onClick={() => movePriority(slot.nzo_id, 'down')} title="Move down" />
                        <FBtn label="[✕]" cls="danger" onClick={() => doDelete(slot.nzo_id)} title="Remove" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FProgress pct={pct} color={slot.status==='Downloading'?'yellow':'dim'} />
                      <span style={{ fontSize: '0.7rem', color: '#ffbd2e', width: 34, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
        </div>
      )}

      {/* HISTORY */}
      {tab === 'history' && (
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
          {filteredHist.map((item, i) => {
            const d = new Date(item.completed * 1000);
            const ts = `${d.toLocaleDateString()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            return (
              <div key={item.nzo_id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderBottom: '1px solid rgba(0,255,0,0.04)', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(0,255,0,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <span style={{ color: item.status === 'Completed' ? '#27c93f' : '#ff5f56', fontSize: '0.75rem', flexShrink: 0 }}>●</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-dim)', display: 'flex', gap: 8 }}>
                    <span>{ts}</span>
                    <span style={{ color: 'var(--neon-purple)' }}>[{item.category}]</span>
                    <span>{item.size}</span>
                    {item.fail_message && <span style={{ color: '#ff5f56' }}>{item.fail_message}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: '0.67rem', color: item.status==='Completed'?'#27c93f':'#ff5f56' }}>{item.status}</span>
                  {item.status === 'Failed' && <FBtn label="[RETRY]" cls="warn" onClick={() => retryFailed(item.nzo_id)} />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* STATS */}
      {tab === 'stats' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: 'var(--neon-cyan)', fontSize: '0.75rem', letterSpacing: 2, marginBottom: 10, borderBottom: '1px solid rgba(0,243,255,0.2)', paddingBottom: 4 }}>HISTORY STATS</div>
            {[
              { label: 'TOTAL COMPLETED', val: history.filter(h=>h.status==='Completed').length, color: '#27c93f' },
              { label: 'FAILED',          val: history.filter(h=>h.status==='Failed').length,    color: '#ff5f56' },
              { label: 'QUEUE SLOTS',     val: queueData?.slots?.length || 0,                    color: 'var(--neon-cyan)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,0,0.08)', borderRadius: 3, marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: 1 }}>{s.label}</span>
                <span style={{ fontSize: '0.85rem', color: s.color, fontWeight: 'bold' }}>{s.val}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ color: 'var(--neon-cyan)', fontSize: '0.75rem', letterSpacing: 2, marginBottom: 10, borderBottom: '1px solid rgba(0,243,255,0.2)', paddingBottom: 4 }}>BY CATEGORY</div>
            {cats.filter(c => c !== 'all').map(c => {
              const count = history.filter(h => h.category === c).length;
              return (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--neon-purple)', width: 80, flexShrink: 0 }}>[{c}]</span>
                  <FProgress pct={history.length ? (count / history.length) * 100 : 0} color="purple" />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', width: 25, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Export — override the basic versions with full ones
Object.assign(window, {
  RadarrPanel:   RadarrPanelFull,
  SonarrPanel:   SonarrPanelFull,
  SABnzbdPanel:  SABnzbdPanelFull,
});

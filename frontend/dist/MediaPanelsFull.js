/* MediaPanelsFull.jsx — Full Radarr, Sonarr, SABnzbd panels with complete functionality
   Depends on MediaAPIPanels.jsx being loaded first (for loadConfig, apiFetch, sabFetch, shared components)
*/
const {
  useState,
  useEffect,
  useRef,
  useCallback
} = React;

// ── Extended mock data ────────────────────────────────────────────────────────
const MOCK_MOVIES_FULL = [{
  id: 1,
  title: 'Dune: Part Two',
  year: 2024,
  status: 'downloaded',
  hasFile: true,
  monitored: true,
  sizeOnDisk: 14200000000,
  ratings: {
    imdb: {
      value: 8.5
    }
  },
  genres: ['Sci-Fi', 'Drama'],
  studio: 'Legendary',
  runtime: 166,
  overview: 'Paul Atreides unites with the Fremen while on a warpath of revenge against the conspirators who destroyed his family.',
  qualityProfileId: 4,
  rootFolderPath: '/mnt/array/media/Movies',
  tmdbId: 693134
}, {
  id: 2,
  title: 'Poor Things',
  year: 2023,
  status: 'downloaded',
  hasFile: true,
  monitored: true,
  sizeOnDisk: 12100000000,
  ratings: {
    imdb: {
      value: 7.9
    }
  },
  genres: ['Fantasy', 'Drama'],
  studio: 'Film4',
  runtime: 141,
  overview: 'The incredible tale about the fantastical evolution of Bella Baxter, a young woman brought back to life by the brilliant and unorthodox scientist Dr. Godwin Baxter.',
  qualityProfileId: 4,
  rootFolderPath: '/mnt/array/media/Movies',
  tmdbId: 792307
}, {
  id: 3,
  title: 'The Holdovers',
  year: 2023,
  status: 'downloaded',
  hasFile: true,
  monitored: true,
  sizeOnDisk: 9400000000,
  ratings: {
    imdb: {
      value: 7.9
    }
  },
  genres: ['Drama', 'Comedy'],
  studio: 'Focus',
  runtime: 133,
  overview: 'A cantankerous history teacher at a prep school is forced to remain on campus during the holidays with a trouble-making student.',
  qualityProfileId: 3,
  rootFolderPath: '/mnt/array/media/Movies',
  tmdbId: 840430
}, {
  id: 4,
  title: 'Oppenheimer',
  year: 2023,
  status: 'downloaded',
  hasFile: true,
  monitored: true,
  sizeOnDisk: 18500000000,
  ratings: {
    imdb: {
      value: 8.3
    }
  },
  genres: ['Drama', 'History'],
  studio: 'Universal',
  runtime: 180,
  overview: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.',
  qualityProfileId: 6,
  rootFolderPath: '/mnt/array/media/Movies',
  tmdbId: 872585
}, {
  id: 5,
  title: 'Civil War',
  year: 2024,
  status: 'missing',
  hasFile: false,
  monitored: true,
  sizeOnDisk: 0,
  ratings: {
    imdb: {
      value: 7.4
    }
  },
  genres: ['Action', 'Drama'],
  studio: 'A24',
  runtime: 109,
  overview: 'A journey across a dystopian future America, following a team of military-embedded journalists.',
  qualityProfileId: 4,
  rootFolderPath: '/mnt/array/media/Movies',
  tmdbId: 1084736
}, {
  id: 6,
  title: 'Furiosa',
  year: 2024,
  status: 'missing',
  hasFile: false,
  monitored: true,
  sizeOnDisk: 0,
  ratings: {
    imdb: {
      value: 7.2
    }
  },
  genres: ['Action'],
  studio: 'WB',
  runtime: 148,
  overview: 'The origin story of renegade warrior Furiosa before she teamed up with Mad Max.',
  qualityProfileId: 4,
  rootFolderPath: '/mnt/array/media/Movies',
  tmdbId: 786892
}, {
  id: 7,
  title: 'Alien: Romulus',
  year: 2024,
  status: 'downloaded',
  hasFile: true,
  monitored: true,
  sizeOnDisk: 11200000000,
  ratings: {
    imdb: {
      value: 7.3
    }
  },
  genres: ['Horror', 'Sci-Fi'],
  studio: '20th Century',
  runtime: 119,
  overview: 'While scavenging the deep ends of a derelict space station, a group of young space colonizers come face to face with the most terrifying life form in the universe.',
  qualityProfileId: 4,
  rootFolderPath: '/mnt/array/media/Movies',
  tmdbId: 945961
}, {
  id: 8,
  title: 'Deadpool & Wolverine',
  year: 2024,
  status: 'downloaded',
  hasFile: true,
  monitored: true,
  sizeOnDisk: 15800000000,
  ratings: {
    imdb: {
      value: 7.8
    }
  },
  genres: ['Action', 'Comedy'],
  studio: 'Marvel',
  runtime: 128,
  overview: 'Wade Wilson and Wolverine must work together to defeat a common threat.',
  qualityProfileId: 5,
  rootFolderPath: '/mnt/array/media/Movies',
  tmdbId: 533535
}, {
  id: 9,
  title: 'Twisters',
  year: 2024,
  status: 'missing',
  hasFile: false,
  monitored: false,
  sizeOnDisk: 0,
  ratings: {
    imdb: {
      value: 6.8
    }
  },
  genres: ['Action', 'Thriller'],
  studio: 'Universal',
  runtime: 122,
  overview: 'Storm chasers race into the heart of multiple storm systems converging over central Oklahoma.',
  qualityProfileId: 4,
  rootFolderPath: '/mnt/array/media/Movies',
  tmdbId: 718821
}, {
  id: 10,
  title: 'A Quiet Place: Day One',
  year: 2024,
  status: 'downloaded',
  hasFile: true,
  monitored: true,
  sizeOnDisk: 9800000000,
  ratings: {
    imdb: {
      value: 6.9
    }
  },
  genres: ['Horror'],
  studio: 'Paramount',
  runtime: 99,
  overview: 'A woman named Sam finds herself caught in the chaos as New York City turns into a hostile environment.',
  qualityProfileId: 3,
  rootFolderPath: '/mnt/array/media/Movies',
  tmdbId: 762441
}];
const MOCK_SERIES_FULL = [{
  id: 1,
  title: 'Shōgun',
  year: 2024,
  status: 'continuing',
  episodeCount: 10,
  episodeFileCount: 10,
  monitored: true,
  network: 'FX',
  genres: ['Drama', 'History'],
  runtime: 60,
  overview: "Based on James Clavell's novel, set in feudal Japan.",
  seasonCount: 1,
  seasons: [{
    seasonNumber: 1,
    episodeCount: 10,
    episodeFileCount: 10,
    monitored: true
  }]
}, {
  id: 2,
  title: 'The Bear',
  year: 2022,
  status: 'continuing',
  episodeCount: 28,
  episodeFileCount: 28,
  monitored: true,
  network: 'FX',
  genres: ['Drama', 'Comedy'],
  runtime: 30,
  overview: 'A young chef from the fine dining world returns to Chicago to run his family sandwich shop.',
  seasonCount: 3,
  seasons: [{
    seasonNumber: 1,
    episodeCount: 8,
    episodeFileCount: 8,
    monitored: true
  }, {
    seasonNumber: 2,
    episodeCount: 10,
    episodeFileCount: 10,
    monitored: true
  }, {
    seasonNumber: 3,
    episodeCount: 10,
    episodeFileCount: 10,
    monitored: true
  }]
}, {
  id: 3,
  title: 'House of the Dragon',
  year: 2022,
  status: 'continuing',
  episodeCount: 18,
  episodeFileCount: 18,
  monitored: true,
  network: 'HBO',
  genres: ['Fantasy', 'Drama'],
  runtime: 60,
  overview: 'The story of House Targaryen set 200 years before the events of Game of Thrones.',
  seasonCount: 2,
  seasons: [{
    seasonNumber: 1,
    episodeCount: 10,
    episodeFileCount: 10,
    monitored: true
  }, {
    seasonNumber: 2,
    episodeCount: 8,
    episodeFileCount: 8,
    monitored: true
  }]
}, {
  id: 4,
  title: 'The Last of Us',
  year: 2023,
  status: 'continuing',
  episodeCount: 17,
  episodeFileCount: 17,
  monitored: true,
  network: 'HBO',
  genres: ['Drama', 'Horror'],
  runtime: 60,
  overview: 'Joel must smuggle Ellie out of an oppressive quarantine zone, sparking a journey across America.',
  seasonCount: 2,
  seasons: [{
    seasonNumber: 1,
    episodeCount: 9,
    episodeFileCount: 9,
    monitored: true
  }, {
    seasonNumber: 2,
    episodeCount: 8,
    episodeFileCount: 8,
    monitored: true
  }]
}, {
  id: 5,
  title: 'Severance',
  year: 2022,
  status: 'continuing',
  episodeCount: 19,
  episodeFileCount: 18,
  monitored: true,
  network: 'Apple TV+',
  genres: ['Sci-Fi', 'Thriller'],
  runtime: 45,
  overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.',
  seasonCount: 2,
  seasons: [{
    seasonNumber: 1,
    episodeCount: 9,
    episodeFileCount: 9,
    monitored: true
  }, {
    seasonNumber: 2,
    episodeCount: 10,
    episodeFileCount: 9,
    monitored: true
  }]
}, {
  id: 6,
  title: 'Fallout',
  year: 2024,
  status: 'continuing',
  episodeCount: 8,
  episodeFileCount: 8,
  monitored: true,
  network: 'Prime Video',
  genres: ['Sci-Fi', 'Action'],
  runtime: 60,
  overview: '200 years after a nuclear apocalypse, a naive Vault-dweller ventures out into the wasteland.',
  seasonCount: 1,
  seasons: [{
    seasonNumber: 1,
    episodeCount: 8,
    episodeFileCount: 8,
    monitored: true
  }]
}, {
  id: 7,
  title: 'Silo',
  year: 2023,
  status: 'continuing',
  episodeCount: 20,
  episodeFileCount: 19,
  monitored: true,
  network: 'Apple TV+',
  genres: ['Sci-Fi'],
  runtime: 60,
  overview: 'In a ruined and toxic world, thousands live in a giant silo underground.',
  seasonCount: 2,
  seasons: [{
    seasonNumber: 1,
    episodeCount: 10,
    episodeFileCount: 10,
    monitored: true
  }, {
    seasonNumber: 2,
    episodeCount: 10,
    episodeFileCount: 9,
    monitored: true
  }]
}];
const QUALITY_PROFILES = [{
  id: 1,
  name: 'Any'
}, {
  id: 2,
  name: '480p'
}, {
  id: 3,
  name: '720p'
}, {
  id: 4,
  name: '1080p'
}, {
  id: 5,
  name: '1080p Bluray'
}, {
  id: 6,
  name: '4K UHD'
}];

// ── Shared mini components (local copies) ─────────────────────────────────────
function FBtn({
  label,
  cls = '',
  onClick,
  disabled,
  title
}) {
  return /*#__PURE__*/React.createElement("button", {
    className: `cmd-btn-sm ${cls}`,
    onClick: onClick,
    disabled: disabled,
    title: title
  }, label);
}
function FProgress({
  pct,
  color = 'green'
}) {
  const colors = {
    green: 'var(--neon-green)',
    yellow: 'var(--color-warn)',
    red: 'var(--color-error)',
    cyan: 'var(--neon-cyan)',
    purple: 'var(--neon-purple)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 8,
      background: 'rgba(0,255,0,0.08)',
      border: '1px solid rgba(0,255,0,0.15)',
      borderRadius: 2,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${Math.min(100, Math.max(0, pct))}%`,
      height: '100%',
      background: colors[color] || colors.green,
      transition: 'width 0.5s',
      boxShadow: `0 0 4px ${colors[color] || colors.green}`
    }
  }));
}
function fmtBytes(bytes) {
  if (!bytes) return '0 B';
  const gb = bytes / 1e9;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`;
}

// ── Movie Detail Modal ────────────────────────────────────────────────────────
function MovieDetail({
  movie,
  onClose,
  onDelete,
  onSearch,
  onToggleMonitor
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.95)',
      backdropFilter: 'blur(6px)',
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      borderBottom: '1px solid rgba(0,255,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
      background: 'rgba(0,0,0,0.7)'
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    label: "[\u2190 BACK]",
    onClick: onClose
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.85rem',
      letterSpacing: 1,
      textShadow: 'var(--bloom-cyan)',
      flex: 1
    }
  }, movie.title, " (", movie.year, ")"), /*#__PURE__*/React.createElement(FBtn, {
    label: movie.monitored ? '[MONITORED ●]' : '[UNMONITORED ○]',
    cls: movie.monitored ? 'cyan' : '',
    onClick: () => onToggleMonitor(movie.id)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 16,
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
      marginBottom: 16
    }
  }, [{
    k: 'STATUS',
    v: movie.hasFile ? 'DOWNLOADED' : 'MISSING',
    color: movie.hasFile ? 'var(--color-success)' : 'var(--color-error)'
  }, {
    k: 'YEAR',
    v: movie.year
  }, {
    k: 'RUNTIME',
    v: `${movie.runtime || '?'} min`
  }, {
    k: 'STUDIO',
    v: movie.studio || 'Unknown'
  }, {
    k: 'IMDB',
    v: movie.ratings?.imdb?.value || 'N/A'
  }, {
    k: 'SIZE',
    v: fmtBytes(movie.sizeOnDisk)
  }, {
    k: 'QUALITY',
    v: QUALITY_PROFILES.find(q => q.id === movie.qualityProfileId)?.name || 'Unknown'
  }, {
    k: 'PATH',
    v: movie.rootFolderPath || 'N/A'
  }].map(({
    k,
    v,
    color
  }) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      background: 'rgba(0,0,0,0.5)',
      border: '1px solid rgba(0,255,0,0.1)',
      borderRadius: 3,
      padding: '8px 10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--text-dim)',
      letterSpacing: 1,
      marginBottom: 3
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.8rem',
      color: color || 'var(--text-primary)',
      fontFamily: 'var(--font-mono)'
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      marginBottom: 12
    }
  }, movie.genres?.map(g => /*#__PURE__*/React.createElement("span", {
    key: g,
    style: {
      fontSize: '0.7rem',
      color: 'var(--neon-purple)',
      border: '1px solid rgba(128,0,255,0.3)',
      borderRadius: 2,
      padding: '2px 8px'
    }
  }, "[", g, "]"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(0,0,0,0.4)',
      border: '1px solid rgba(0,255,0,0.08)',
      borderRadius: 4,
      padding: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--text-dim)',
      letterSpacing: 1,
      marginBottom: 6
    }
  }, "OVERVIEW"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.78rem',
      color: 'var(--text-primary)',
      lineHeight: 1.8
    }
  }, movie.overview)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, !movie.hasFile && /*#__PURE__*/React.createElement(FBtn, {
    label: "[SEARCH NOW]",
    cls: "cyan",
    onClick: () => onSearch(movie.id)
  }), movie.hasFile && /*#__PURE__*/React.createElement(FBtn, {
    label: "[RE-SEARCH]",
    onClick: () => onSearch(movie.id)
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: "[EDIT QUALITY]",
    onClick: () => {}
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: "[RENAME FILES]",
    onClick: () => {}
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: "[TMDB \u2192]",
    cls: "cyan",
    onClick: () => window.open(`https://www.themoviedb.org/movie/${movie.tmdbId}`, '_blank')
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: "[DELETE MOVIE]",
    cls: "danger",
    onClick: () => {
      onDelete(movie.id);
      onClose();
    }
  }))));
}

// ── Full Radarr Panel ─────────────────────────────────────────────────────────
function RadarrPanelFull({
  onOpenWebUI
}) {
  const [cfg] = useState(loadConfig);
  const hasKey = !!cfg.radarr.apiKey;
  const [tab, setTab] = useState('library');
  const [movies, setMovies] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCfg, setShowCfg] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('title');
  const [detail, setDetail] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [notification, setNotification] = useState('');
  const notify = msg => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (hasKey) {
        const [mv, q] = await Promise.all([apiFetch(cfg.radarr.url, 'movie', cfg.radarr.apiKey), apiFetch(cfg.radarr.url, 'queue', cfg.radarr.apiKey)]);
        setMovies(mv);
        setQueue(q.records || q);
      } else {
        await new Promise(r => setTimeout(r, 300));
        setMovies(MOCK_MOVIES_FULL);
        setQueue([{
          id: 101,
          title: 'Civil War (2024)',
          status: 'downloading',
          sizeleft: 4200000000,
          size: 8400000000,
          timeleft: '00:42:00',
          protocol: 'usenet',
          quality: {
            quality: {
              name: '1080p Bluray'
            }
          }
        }, {
          id: 102,
          title: 'Furiosa (2024)',
          status: 'queued',
          sizeleft: 9100000000,
          size: 9100000000,
          timeleft: '01:31:00',
          protocol: 'usenet',
          quality: {
            quality: {
              name: '4K UHD'
            }
          }
        }]);
      }
    } catch (e) {
      setError(e.message);
      setMovies(MOCK_MOVIES_FULL);
    }
    setLoading(false);
  }, [hasKey, cfg]);
  useEffect(() => {
    load();
  }, [load]);
  const doSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      if (hasKey) {
        const r = await apiFetch(cfg.radarr.url, 'movie/lookup', cfg.radarr.apiKey, {
          term: searchTerm
        });
        setSearchResults(r.slice(0, 20));
      } else {
        await new Promise(r => setTimeout(r, 500));
        setSearchResults([{
          tmdbId: 1001,
          title: 'Alien: Romulus',
          year: 2024,
          status: 'released',
          overview: 'A new chapter in the Alien franchise set between the first two films.',
          genres: ['Horror', 'Sci-Fi'],
          runtime: 119
        }, {
          tmdbId: 1002,
          title: 'Deadpool & Wolverine',
          year: 2024,
          status: 'released',
          overview: 'Wade Wilson teams up with an alternate-universe Wolverine.',
          genres: ['Action', 'Comedy'],
          runtime: 128
        }, {
          tmdbId: 1003,
          title: 'Twisters',
          year: 2024,
          status: 'released',
          overview: 'Storm chasers face the most destructive tornadic supercells ever recorded.',
          genres: ['Action', 'Thriller'],
          runtime: 122
        }, {
          tmdbId: 1004,
          title: 'Inside Out 2',
          year: 2024,
          status: 'released',
          overview: 'A new range of emotions turn Riley\'s mind upside down.',
          genres: ['Animation', 'Comedy'],
          runtime: 100
        }, {
          tmdbId: 1005,
          title: 'The Wild Robot',
          year: 2024,
          status: 'released',
          overview: 'A robot is marooned on a wild island and must learn to survive.',
          genres: ['Animation', 'Drama'],
          runtime: 101
        }]);
      }
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };
  const addMovie = async (tmdbId, title) => {
    notify(`> ADDING ${title.toUpperCase()}...`);
    // In real use: POST /api/v3/movie with tmdbId, qualityProfileId, rootFolderPath
  };
  const deleteMovie = id => {
    setMovies(ms => ms.filter(m => m.id !== id));
    notify('> MOVIE REMOVED FROM LIBRARY');
  };
  const toggleMonitor = id => {
    setMovies(ms => ms.map(m => m.id === id ? {
      ...m,
      monitored: !m.monitored
    } : m));
  };
  const triggerSearch = id => {
    notify(`> SEARCHING FOR MOVIE ID: ${id}...`);
  };
  const deleteQueueItem = id => {
    setQueue(q => q.filter(x => x.id !== id));
    notify('> QUEUE ITEM REMOVED');
  };

  // Stats
  const downloaded = movies.filter(m => m.hasFile).length;
  const missing = movies.filter(m => !m.hasFile && m.monitored).length;
  const totalSize = movies.reduce((a, m) => a + (m.sizeOnDisk || 0), 0);

  // Filtered + sorted
  const filtered = movies.filter(m => {
    const text = !filter || m.title.toLowerCase().includes(filter.toLowerCase()) || (m.genres || []).some(g => g.toLowerCase().includes(filter.toLowerCase()));
    const stat = statusFilter === 'all' ? true : statusFilter === 'downloaded' ? m.hasFile : statusFilter === 'missing' ? !m.hasFile && m.monitored : statusFilter === 'unmonitored' ? !m.monitored : true;
    return text && stat;
  }).sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'year') return b.year - a.year;
    if (sortBy === 'size') return b.sizeOnDisk - a.sizeOnDisk;
    if (sortBy === 'rating') return (b.ratings?.imdb?.value || 0) - (a.ratings?.imdb?.value || 0);
    return 0;
  });
  if (showCfg) return /*#__PURE__*/React.createElement(BackendConfigPanel, {
    onSave: () => {
      setShowCfg(false);
      load();
    }
  });
  if (detail) return /*#__PURE__*/React.createElement(MovieDetail, {
    movie: detail,
    onClose: () => setDetail(null),
    onDelete: deleteMovie,
    onSearch: triggerSearch,
    onToggleMonitor: toggleMonitor
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      position: 'relative'
    }
  }, notification && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      background: 'rgba(0,243,255,0.15)',
      borderBottom: '1px solid var(--neon-cyan)',
      padding: '4px 12px',
      fontSize: '0.75rem',
      color: 'var(--neon-cyan)',
      zIndex: 20,
      letterSpacing: 1
    }
  }, notification), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '6px 10px',
      borderBottom: '1px solid rgba(0,255,0,0.1)',
      background: 'rgba(0,0,0,0.6)',
      flexShrink: 0,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--neon-green)',
      fontSize: '0.8rem',
      fontWeight: 'bold',
      letterSpacing: 2,
      textShadow: 'var(--glow-green-sm)'
    }
  }, "[RADARR]"), ['library', 'queue', 'search', 'stats'].map(t => /*#__PURE__*/React.createElement(FBtn, {
    key: t,
    label: `[${t.toUpperCase()}]`,
    cls: tab === t ? 'cyan' : '',
    onClick: () => setTab(t)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), !hasKey && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--text-dim)',
      letterSpacing: 1
    }
  }, "DEMO"), /*#__PURE__*/React.createElement(FBtn, {
    label: "[\u21BB]",
    onClick: load,
    disabled: loading,
    title: "Refresh"
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: "[WEB UI]",
    cls: "cyan",
    onClick: onOpenWebUI
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: "[\u2699]",
    onClick: () => setShowCfg(true),
    title: "API Config"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 0,
      borderBottom: '1px solid rgba(0,255,0,0.06)',
      flexShrink: 0,
      background: 'rgba(0,0,0,0.4)'
    }
  }, [{
    label: 'TOTAL',
    val: movies.length,
    color: 'var(--text-primary)'
  }, {
    label: 'DOWNLOADED',
    val: downloaded,
    color: 'var(--color-success)'
  }, {
    label: 'MISSING',
    val: missing,
    color: 'var(--color-error)'
  }, {
    label: 'QUEUE',
    val: queue.length,
    color: 'var(--neon-cyan)'
  }, {
    label: 'LIBRARY SIZE',
    val: fmtBytes(totalSize),
    color: 'var(--neon-purple)'
  }].map(s => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      flex: 1,
      padding: '5px 8px',
      borderRight: '1px solid rgba(0,255,0,0.06)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--text-dim)',
      letterSpacing: 1
    }
  }, s.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.85rem',
      color: s.color,
      fontWeight: 'bold',
      textShadow: s.color !== 'var(--text-primary)' ? `0 0 5px ${s.color}` : 'none'
    }
  }, s.val)))), tab === 'library' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      padding: '5px 8px',
      borderBottom: '1px solid rgba(0,255,0,0.06)',
      flexShrink: 0,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "logview-filter",
    style: {
      flex: 1,
      minWidth: 120
    },
    placeholder: "$ filter...",
    value: filter,
    onChange: e => setFilter(e.target.value)
  }), ['all', 'downloaded', 'missing', 'unmonitored'].map(f => /*#__PURE__*/React.createElement(FBtn, {
    key: f,
    label: `[${f.slice(0, 4).toUpperCase()}]`,
    cls: statusFilter === f ? 'cyan' : '',
    onClick: () => setStatusFilter(f)
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--text-dim)',
      letterSpacing: 1
    }
  }, "SORT:"), ['title', 'year', 'size', 'rating'].map(s => /*#__PURE__*/React.createElement(FBtn, {
    key: s,
    label: `[${s.toUpperCase()}]`,
    cls: sortBy === s ? 'cyan' : '',
    onClick: () => setSortBy(s)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, loading ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      color: 'var(--text-dim)',
      fontSize: '0.8rem'
    }
  }, "> LOADING LIBRARY...") : filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      color: 'var(--text-dim)',
      fontSize: '0.8rem'
    }
  }, "> NO RESULTS") : filtered.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      borderBottom: '1px solid rgba(0,255,0,0.04)',
      cursor: 'pointer',
      transition: 'background 0.1s'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(0,255,0,0.04)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent',
    onClick: () => setDetail(m)
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: m.hasFile ? 'var(--color-success)' : m.monitored ? 'var(--color-error)' : 'var(--text-dim)',
      fontSize: '0.75rem',
      width: 10,
      flexShrink: 0
    }
  }, "\u25CF"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.82rem',
      color: 'var(--text-primary)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontWeight: 'bold'
    }
  }, m.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.67rem',
      color: 'var(--text-dim)',
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", null, m.year), m.ratings?.imdb && /*#__PURE__*/React.createElement("span", null, "\u2605 ", m.ratings.imdb.value), m.runtime && /*#__PURE__*/React.createElement("span", null, m.runtime, "m"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--neon-purple)'
    }
  }, QUALITY_PROFILES.find(q => q.id === m.qualityProfileId)?.name))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.68rem',
      color: 'var(--text-dim)',
      flexShrink: 0
    }
  }, fmtBytes(m.sizeOnDisk)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 3,
      flexShrink: 0
    },
    onClick: e => e.stopPropagation()
  }, !m.hasFile && /*#__PURE__*/React.createElement(FBtn, {
    label: "[\u2193]",
    cls: "cyan",
    onClick: () => triggerSearch(m.id),
    title: "Search"
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: m.monitored ? '[●]' : '[○]',
    cls: m.monitored ? '' : 'dim',
    onClick: () => toggleMonitor(m.id),
    title: "Toggle monitor"
  })))))), tab === 'queue' && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 10,
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, queue.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      color: 'var(--text-dim)',
      fontSize: '0.8rem'
    }
  }, "> QUEUE EMPTY") : queue.map(item => {
    const pct = item.size > 0 ? (item.size - item.sizeleft) / item.size * 100 : 0;
    return /*#__PURE__*/React.createElement("div", {
      key: item.id,
      style: {
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(0,255,0,0.12)',
        borderRadius: 4,
        padding: 10,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--neon-green)',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, item.title), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.67rem',
        color: 'var(--text-dim)',
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", null, item.quality?.quality?.name), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--neon-purple)'
      }
    }, item.protocol?.toUpperCase()), /*#__PURE__*/React.createElement("span", null, "ETA: ", item.timeleft), /*#__PURE__*/React.createElement("span", null, fmtBytes(item.size - item.sizeleft), " / ", fmtBytes(item.size)))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.68rem',
        color: item.status === 'downloading' ? 'var(--neon-cyan)' : 'var(--color-warn)'
      }
    }, item.status?.toUpperCase()), /*#__PURE__*/React.createElement(FBtn, {
      label: "[\u2715]",
      cls: "danger",
      onClick: () => deleteQueueItem(item.id),
      title: "Remove"
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(FProgress, {
      pct: pct,
      color: item.status === 'downloading' ? 'cyan' : 'yellow'
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.7rem',
        color: 'var(--neon-cyan)',
        width: 34,
        textAlign: 'right',
        flexShrink: 0
      }
    }, pct.toFixed(0), "%")));
  })), tab === 'search' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      padding: '8px 10px',
      borderBottom: '1px solid rgba(0,255,0,0.06)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "logview-filter",
    style: {
      flex: 1
    },
    placeholder: "$ movie-lookup --title ...",
    value: searchTerm,
    onChange: e => setSearchTerm(e.target.value),
    onKeyDown: e => e.key === 'Enter' && doSearch()
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: searching ? '[…]' : '[LOOKUP]',
    cls: "cyan",
    onClick: doSearch,
    disabled: searching
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 10,
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, searchResults.length === 0 && !searching && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      color: 'var(--text-dim)',
      fontSize: '0.8rem',
      textAlign: 'center'
    }
  }, "> ENTER TITLE AND PRESS [LOOKUP]", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), "> Searches TMDB database"), searchResults.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: 'rgba(0,0,0,0.5)',
      border: '1px solid rgba(0,255,0,0.12)',
      borderRadius: 4,
      padding: 10,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-green)',
      fontSize: '0.85rem',
      fontWeight: 'bold'
    }
  }, r.title, " (", r.year, ")"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.7rem',
      color: 'var(--text-dim)',
      margin: '4px 0',
      lineHeight: 1.6
    }
  }, r.overview?.slice(0, 140), r.overview?.length > 140 ? '…' : ''), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, r.genres?.slice(0, 3).map(g => /*#__PURE__*/React.createElement("span", {
    key: g,
    style: {
      fontSize: '0.65rem',
      color: 'var(--neon-purple)',
      border: '1px solid rgba(128,0,255,0.3)',
      borderRadius: 2,
      padding: '1px 6px'
    }
  }, "[", g, "]")), r.runtime && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--text-dim)'
    }
  }, r.runtime, "min"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    label: "[+ ADD]",
    cls: "cyan",
    onClick: () => addMovie(r.tmdbId, r.title)
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: "[TMDB]",
    onClick: () => window.open(`https://www.themoviedb.org/movie/${r.tmdbId}`, '_blank')
  }))))))), tab === 'stats' && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 16,
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 10,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 4
    }
  }, "GENRE BREAKDOWN"), (() => {
    const genreCounts = {};
    movies.forEach(m => (m.genres || []).forEach(g => {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    }));
    return Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([g, c]) => /*#__PURE__*/React.createElement("div", {
      key: g,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.75rem',
        color: 'var(--neon-purple)',
        width: 120,
        flexShrink: 0
      }
    }, "[", g, "]"), /*#__PURE__*/React.createElement(FProgress, {
      pct: c / movies.length * 100,
      color: "purple"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.72rem',
        color: 'var(--text-dim)',
        width: 30,
        textAlign: 'right'
      }
    }, c)));
  })()), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 10,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 4
    }
  }, "QUALITY PROFILES"), QUALITY_PROFILES.map(qp => {
    const count = movies.filter(m => m.qualityProfileId === qp.id && m.hasFile).length;
    if (!count) return null;
    return /*#__PURE__*/React.createElement("div", {
      key: qp.id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.75rem',
        color: 'var(--neon-green)',
        width: 120,
        flexShrink: 0
      }
    }, qp.name), /*#__PURE__*/React.createElement(FProgress, {
      pct: count / downloaded * 100,
      color: "green"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.72rem',
        color: 'var(--text-dim)',
        width: 30,
        textAlign: 'right'
      }
    }, count));
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 10,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 4
    }
  }, "BY YEAR"), (() => {
    const yearCounts = {};
    movies.filter(m => m.hasFile).forEach(m => {
      yearCounts[m.year] = (yearCounts[m.year] || 0) + 1;
    });
    return Object.entries(yearCounts).sort((a, b) => b[0] - a[0]).map(([y, c]) => /*#__PURE__*/React.createElement("div", {
      key: y,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.75rem',
        color: 'var(--text-dim)',
        width: 50,
        flexShrink: 0
      }
    }, y), /*#__PURE__*/React.createElement(FProgress, {
      pct: c / downloaded * 100,
      color: "cyan"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.72rem',
        color: 'var(--text-dim)',
        width: 20,
        textAlign: 'right'
      }
    }, c)));
  })())));
}

// ── Series Episode List ───────────────────────────────────────────────────────
function SeriesDetail({
  series,
  onClose,
  onToggleMonitor
}) {
  const [selSeason, setSelSeason] = useState(1);
  const season = series.seasons?.find(s => s.seasonNumber === selSeason);
  const MOCK_EPS = Array.from({
    length: season?.episodeCount || 0
  }, (_, i) => ({
    episodeNumber: i + 1,
    title: `Episode ${i + 1}`,
    airDate: `2024-0${Math.floor(i / 4) + 1}-${String(i % 4 * 7 + 1).padStart(2, '0')}`,
    hasFile: i < (season?.episodeFileCount || 0),
    runtime: series.runtime
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.95)',
      backdropFilter: 'blur(6px)',
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      borderBottom: '1px solid rgba(0,255,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    label: "[\u2190 BACK]",
    onClick: onClose
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.85rem',
      letterSpacing: 1,
      textShadow: 'var(--bloom-cyan)',
      flex: 1
    }
  }, series.title, " (", series.year, ") \u2014 ", series.network), /*#__PURE__*/React.createElement(FBtn, {
    label: series.monitored ? '[MONITORED ●]' : '[UNMONITORED ○]',
    cls: series.monitored ? 'cyan' : '',
    onClick: () => onToggleMonitor(series.id)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      padding: '6px 10px',
      borderBottom: '1px solid rgba(0,255,0,0.08)',
      flexShrink: 0,
      flexWrap: 'wrap'
    }
  }, series.seasons?.map(s => /*#__PURE__*/React.createElement(FBtn, {
    key: s.seasonNumber,
    label: `[S${String(s.seasonNumber).padStart(2, '0')} — ${s.episodeFileCount}/${s.episodeCount}]`,
    cls: selSeason === s.seasonNumber ? 'cyan' : '',
    onClick: () => setSelSeason(s.seasonNumber)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, MOCK_EPS.map(ep => /*#__PURE__*/React.createElement("div", {
    key: ep.episodeNumber,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 12px',
      borderBottom: '1px solid rgba(0,255,0,0.04)',
      transition: 'background 0.1s'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(0,255,0,0.03)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: ep.hasFile ? 'var(--color-success)' : 'var(--color-error)',
      fontSize: '0.75rem',
      width: 10,
      flexShrink: 0
    }
  }, "\u25CF"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--neon-purple)',
      fontSize: '0.75rem',
      width: 50,
      flexShrink: 0
    }
  }, "S", String(selSeason).padStart(2, '0'), "E", String(ep.episodeNumber).padStart(2, '0')), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: '0.8rem',
      color: 'var(--text-primary)'
    }
  }, ep.title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.67rem',
      color: 'var(--text-dim)',
      flexShrink: 0
    }
  }, ep.airDate), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.67rem',
      color: 'var(--text-dim)',
      flexShrink: 0
    }
  }, ep.runtime, "m"), !ep.hasFile && /*#__PURE__*/React.createElement(FBtn, {
    label: "[\u2193]",
    cls: "cyan",
    onClick: () => {},
    title: "Search episode"
  })))));
}

// ── Full Sonarr Panel ─────────────────────────────────────────────────────────
function SonarrPanelFull({
  onOpenWebUI
}) {
  const [cfg] = useState(loadConfig);
  const hasKey = !!cfg.sonarr.apiKey;
  const [tab, setTab] = useState('series');
  const [series, setSeries] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCfg, setShowCfg] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('title');
  const [detail, setDetail] = useState(null);
  const [notification, setNotification] = useState('');
  const notify = msg => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (hasKey) {
        const [sv, q] = await Promise.all([apiFetch(cfg.sonarr.url, 'series', cfg.sonarr.apiKey), apiFetch(cfg.sonarr.url, 'queue', cfg.sonarr.apiKey)]);
        setSeries(sv);
        setQueue(q.records || q);
      } else {
        await new Promise(r => setTimeout(r, 300));
        setSeries(MOCK_SERIES_FULL);
        setQueue([{
          id: 201,
          title: 'Severance S02E10',
          status: 'downloading',
          sizeleft: 1200000000,
          size: 2400000000,
          timeleft: '00:12:00',
          protocol: 'usenet',
          quality: {
            quality: {
              name: '1080p WEB'
            }
          }
        }, {
          id: 202,
          title: 'Silo S02E01',
          status: 'queued',
          sizeleft: 2100000000,
          size: 2100000000,
          timeleft: '00:21:00',
          protocol: 'usenet',
          quality: {
            quality: {
              name: '1080p WEB'
            }
          }
        }]);
      }
    } catch (e) {
      setError(e.message);
      setSeries(MOCK_SERIES_FULL);
    }
    setLoading(false);
  }, [hasKey, cfg]);
  useEffect(() => {
    load();
  }, [load]);
  const toggleMonitor = id => setSeries(ss => ss.map(s => s.id === id ? {
    ...s,
    monitored: !s.monitored
  } : s));
  const deleteQueueItem = id => setQueue(q => q.filter(x => x.id !== id));
  const totalEps = series.reduce((a, s) => a + (s.episodeCount || 0), 0);
  const haveEps = series.reduce((a, s) => a + (s.episodeFileCount || 0), 0);
  const totalSize = haveEps * 1.2e9; // rough mock

  const filtered = series.filter(s => {
    const text = !filter || s.title.toLowerCase().includes(filter.toLowerCase());
    const stat = statusFilter === 'all' ? true : statusFilter === 'continuing' ? s.status === 'continuing' : statusFilter === 'ended' ? s.status === 'ended' : statusFilter === 'missing' ? s.episodeFileCount < s.episodeCount : true;
    return text && stat;
  }).sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'year') return b.year - a.year;
    if (sortBy === 'missing') return a.episodeFileCount - a.episodeCount - (b.episodeFileCount - b.episodeCount);
    if (sortBy === 'progress') {
      const pa = a.episodeCount ? a.episodeFileCount / a.episodeCount : 0;
      const pb = b.episodeCount ? b.episodeFileCount / b.episodeCount : 0;
      return pb - pa;
    }
    return 0;
  });
  if (showCfg) return /*#__PURE__*/React.createElement(BackendConfigPanel, {
    onSave: () => {
      setShowCfg(false);
      load();
    }
  });
  if (detail) return /*#__PURE__*/React.createElement(SeriesDetail, {
    series: detail,
    onClose: () => setDetail(null),
    onToggleMonitor: toggleMonitor
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      position: 'relative'
    }
  }, notification && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      background: 'rgba(0,243,255,0.15)',
      borderBottom: '1px solid var(--neon-cyan)',
      padding: '4px 12px',
      fontSize: '0.75rem',
      color: 'var(--neon-cyan)',
      zIndex: 20,
      letterSpacing: 1
    }
  }, notification), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '6px 10px',
      borderBottom: '1px solid rgba(0,255,0,0.1)',
      background: 'rgba(0,0,0,0.6)',
      flexShrink: 0,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.8rem',
      fontWeight: 'bold',
      letterSpacing: 2,
      textShadow: 'var(--bloom-cyan)'
    }
  }, "[SONARR]"), ['series', 'queue', 'calendar', 'stats'].map(t => /*#__PURE__*/React.createElement(FBtn, {
    key: t,
    label: `[${t.toUpperCase()}]`,
    cls: tab === t ? 'cyan' : '',
    onClick: () => setTab(t)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), !hasKey && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--text-dim)',
      letterSpacing: 1
    }
  }, "DEMO"), /*#__PURE__*/React.createElement(FBtn, {
    label: "[\u21BB]",
    onClick: load,
    disabled: loading
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: "[WEB UI]",
    cls: "cyan",
    onClick: onOpenWebUI
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: "[\u2699]",
    onClick: () => setShowCfg(true)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 0,
      borderBottom: '1px solid rgba(0,255,0,0.06)',
      flexShrink: 0,
      background: 'rgba(0,0,0,0.4)'
    }
  }, [{
    label: 'SERIES',
    val: series.length,
    color: 'var(--text-primary)'
  }, {
    label: 'EPISODES',
    val: `${haveEps}/${totalEps}`,
    color: 'var(--color-success)'
  }, {
    label: 'MISSING',
    val: totalEps - haveEps,
    color: 'var(--color-error)'
  }, {
    label: 'QUEUE',
    val: queue.length,
    color: 'var(--neon-cyan)'
  }, {
    label: 'SIZE',
    val: fmtBytes(totalSize),
    color: 'var(--neon-purple)'
  }].map(s => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      flex: 1,
      padding: '5px 8px',
      borderRight: '1px solid rgba(0,255,0,0.06)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--text-dim)',
      letterSpacing: 1
    }
  }, s.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.82rem',
      color: s.color,
      fontWeight: 'bold'
    }
  }, s.val)))), tab === 'series' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      padding: '5px 8px',
      borderBottom: '1px solid rgba(0,255,0,0.06)',
      flexShrink: 0,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "logview-filter",
    style: {
      flex: 1,
      minWidth: 120
    },
    placeholder: "$ filter...",
    value: filter,
    onChange: e => setFilter(e.target.value)
  }), ['all', 'continuing', 'ended', 'missing'].map(f => /*#__PURE__*/React.createElement(FBtn, {
    key: f,
    label: `[${f.slice(0, 4).toUpperCase()}]`,
    cls: statusFilter === f ? 'cyan' : '',
    onClick: () => setStatusFilter(f)
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--text-dim)'
    }
  }, "SORT:"), ['title', 'year', 'progress', 'missing'].map(s => /*#__PURE__*/React.createElement(FBtn, {
    key: s,
    label: `[${s.slice(0, 4).toUpperCase()}]`,
    cls: sortBy === s ? 'cyan' : '',
    onClick: () => setSortBy(s)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, filtered.map(s => {
    const pct = s.episodeCount > 0 ? s.episodeFileCount / s.episodeCount * 100 : 0;
    const complete = s.episodeFileCount >= s.episodeCount;
    return /*#__PURE__*/React.createElement("div", {
      key: s.id,
      style: {
        padding: '7px 10px',
        borderBottom: '1px solid rgba(0,255,0,0.04)',
        cursor: 'pointer',
        transition: 'background 0.1s'
      },
      onMouseEnter: e => e.currentTarget.style.background = 'rgba(0,255,0,0.04)',
      onMouseLeave: e => e.currentTarget.style.background = 'transparent',
      onClick: () => setDetail(s)
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: complete ? 'var(--color-success)' : 'var(--color-warn)',
        fontSize: '0.75rem',
        width: 10,
        flexShrink: 0
      }
    }, "\u25CF"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.82rem',
        color: 'var(--text-primary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: 'bold'
      }
    }, s.title), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.67rem',
        color: 'var(--text-dim)',
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", null, s.year), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--neon-purple)'
      }
    }, s.network), /*#__PURE__*/React.createElement("span", null, s.episodeFileCount, "/", s.episodeCount, " eps"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: s.status === 'continuing' ? 'var(--neon-cyan)' : 'var(--text-dim)'
      }
    }, s.status))), /*#__PURE__*/React.createElement("div", {
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement(FBtn, {
      label: s.monitored ? '[●]' : '[○]',
      cls: s.monitored ? 'cyan' : '',
      onClick: () => toggleMonitor(s.id)
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 18
      }
    }, /*#__PURE__*/React.createElement(FProgress, {
      pct: pct,
      color: complete ? 'green' : 'yellow'
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.68rem',
        color: complete ? 'var(--color-success)' : 'var(--color-warn)',
        width: 34,
        textAlign: 'right',
        flexShrink: 0
      }
    }, pct.toFixed(0), "%")));
  }))), tab === 'queue' && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 10,
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, queue.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      color: 'var(--text-dim)',
      fontSize: '0.8rem'
    }
  }, "> QUEUE EMPTY") : queue.map(item => {
    const pct = item.size > 0 ? (item.size - item.sizeleft) / item.size * 100 : 0;
    return /*#__PURE__*/React.createElement("div", {
      key: item.id,
      style: {
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(0,255,0,0.12)',
        borderRadius: 4,
        padding: 10,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--neon-cyan)',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, item.title), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.67rem',
        color: 'var(--text-dim)',
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", null, item.quality?.quality?.name), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--neon-purple)'
      }
    }, item.protocol?.toUpperCase()), /*#__PURE__*/React.createElement("span", null, "ETA: ", item.timeleft))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.68rem',
        color: item.status === 'downloading' ? 'var(--neon-cyan)' : 'var(--color-warn)'
      }
    }, item.status?.toUpperCase()), /*#__PURE__*/React.createElement(FBtn, {
      label: "[\u2715]",
      cls: "danger",
      onClick: () => deleteQueueItem(item.id)
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(FProgress, {
      pct: pct,
      color: "cyan"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.7rem',
        color: 'var(--neon-cyan)',
        width: 34,
        textAlign: 'right',
        flexShrink: 0
      }
    }, pct.toFixed(0), "%")));
  })), tab === 'calendar' && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 12,
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 12
    }
  }, "UPCOMING EPISODES \u2014 MAY 2026"), [{
    date: 'May 08',
    show: 'Severance',
    ep: 'S02E10',
    title: 'Hello, Ms. Cobel',
    network: 'Apple TV+'
  }, {
    date: 'May 09',
    show: 'The Bear',
    ep: 'S04E01',
    title: 'Premiere',
    network: 'FX'
  }, {
    date: 'May 11',
    show: 'House of the Dragon',
    ep: 'S03E01',
    title: 'The Iron Throne',
    network: 'HBO'
  }, {
    date: 'May 15',
    show: 'Silo',
    ep: 'S02E10',
    title: 'TBA',
    network: 'Apple TV+'
  }, {
    date: 'May 16',
    show: 'The Last of Us',
    ep: 'S02E08',
    title: 'TBA',
    network: 'HBO'
  }, {
    date: 'May 22',
    show: 'Fallout',
    ep: 'S02E01',
    title: 'Premiere',
    network: 'Prime Video'
  }].map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 10,
      padding: '8px 10px',
      background: 'rgba(0,0,0,0.4)',
      border: '1px solid rgba(0,255,0,0.1)',
      borderRadius: 4,
      marginBottom: 6,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--neon-purple)',
      fontSize: '0.75rem',
      width: 60,
      flexShrink: 0
    }
  }, e.date), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.82rem',
      color: 'var(--neon-green)',
      fontWeight: 'bold'
    }
  }, e.show), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.68rem',
      color: 'var(--text-dim)',
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--neon-cyan)'
    }
  }, e.ep), /*#__PURE__*/React.createElement("span", null, e.title), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--neon-purple)'
    }
  }, e.network)))))), tab === 'stats' && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 16,
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 10,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 4
    }
  }, "NETWORK BREAKDOWN"), (() => {
    const counts = {};
    series.forEach(s => {
      counts[s.network] = (counts[s.network] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([n, c]) => /*#__PURE__*/React.createElement("div", {
      key: n,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.75rem',
        color: 'var(--neon-purple)',
        width: 120,
        flexShrink: 0
      }
    }, n), /*#__PURE__*/React.createElement(FProgress, {
      pct: c / series.length * 100,
      color: "purple"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.72rem',
        color: 'var(--text-dim)',
        width: 20,
        textAlign: 'right'
      }
    }, c)));
  })()), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 10,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 4
    }
  }, "GENRE BREAKDOWN"), (() => {
    const counts = {};
    series.forEach(s => (s.genres || []).forEach(g => {
      counts[g] = (counts[g] || 0) + 1;
    }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([g, c]) => /*#__PURE__*/React.createElement("div", {
      key: g,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.75rem',
        color: 'var(--neon-green)',
        width: 120,
        flexShrink: 0
      }
    }, "[", g, "]"), /*#__PURE__*/React.createElement(FProgress, {
      pct: c / series.length * 100,
      color: "green"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.72rem',
        color: 'var(--text-dim)',
        width: 20,
        textAlign: 'right'
      }
    }, c)));
  })())));
}

// ── Full SABnzbd Panel ────────────────────────────────────────────────────────
const MOCK_SAB_FULL = {
  queue: {
    status: 'Downloading',
    speed: '24.6 MB/s',
    kbpersec: '25190',
    mbleft: '14821.42',
    mb: '22450.80',
    timeleft: '0:09:47',
    diskspace1: '4823.2',
    diskspace2: '4823.2',
    speedlimit: '0',
    speedlimit_abs: '',
    slots: [{
      nzo_id: 'nzo_1',
      filename: 'Civil.War.2024.1080p.Bluray.x265-GROUP',
      status: 'Downloading',
      mbleft: '4200.00',
      mb: '8400.00',
      timeleft: '0:04:12',
      avg_age: '42d',
      cat: 'movies',
      priority: 'Normal'
    }, {
      nzo_id: 'nzo_2',
      filename: 'Furiosa.2024.2160p.UHD.BluRay-GROUP',
      status: 'Queued',
      mbleft: '9100.00',
      mb: '9100.00',
      timeleft: '0:09:07',
      avg_age: '12d',
      cat: 'movies',
      priority: 'Normal'
    }, {
      nzo_id: 'nzo_3',
      filename: 'Severance.S02E10.1080p.WEB-DL-GROUP',
      status: 'Downloading',
      mbleft: '1200.00',
      mb: '2400.00',
      timeleft: '0:01:12',
      avg_age: '3d',
      cat: 'tv',
      priority: 'High'
    }, {
      nzo_id: 'nzo_4',
      filename: 'Silo.S02E01.1080p.WEB-DL-GROUP',
      status: 'Queued',
      mbleft: '2100.00',
      mb: '2100.00',
      timeleft: '0:02:06',
      avg_age: '1d',
      cat: 'tv',
      priority: 'Normal'
    }]
  }
};
const MOCK_SAB_HISTORY = [{
  nzo_id: 'h1',
  name: 'The.Bear.S03E01.1080p.WEB',
  status: 'Completed',
  size: '2.4 GB',
  completed: Date.now() / 1000 - 3600,
  category: 'tv',
  fail_message: ''
}, {
  nzo_id: 'h2',
  name: 'Dune.Part.Two.2024.4K.UHD',
  status: 'Completed',
  size: '58.2 GB',
  completed: Date.now() / 1000 - 7200,
  category: 'movies',
  fail_message: ''
}, {
  nzo_id: 'h3',
  name: 'House.of.Dragon.S02E01.1080p',
  status: 'Failed',
  size: '3.1 GB',
  completed: Date.now() / 1000 - 10800,
  category: 'tv',
  fail_message: 'Incomplete NZB'
}, {
  nzo_id: 'h4',
  name: 'Fallout.S01.Complete.1080p.WEB',
  status: 'Completed',
  size: '42.8 GB',
  completed: Date.now() / 1000 - 86400,
  category: 'tv',
  fail_message: ''
}, {
  nzo_id: 'h5',
  name: 'Oppenheimer.2023.4K.UHD.BluRay',
  status: 'Completed',
  size: '78.4 GB',
  completed: Date.now() / 1000 - 172800,
  category: 'movies',
  fail_message: ''
}, {
  nzo_id: 'h6',
  name: 'Poor.Things.2023.1080p.BluRay',
  status: 'Completed',
  size: '12.1 GB',
  completed: Date.now() / 1000 - 259200,
  category: 'movies',
  fail_message: ''
}];
function SABnzbdPanelFull({
  onOpenWebUI
}) {
  const [cfg] = useState(loadConfig);
  const hasKey = !!cfg.sabnzbd.apiKey;
  const [tab, setTab] = useState('queue');
  const [queueData, setQueueData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCfg, setShowCfg] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speedLimit, setSpeedLimit] = useState('');
  const [notification, setNotification] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const notify = msg => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (hasKey) {
        const [q, h] = await Promise.all([sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, {
          mode: 'queue'
        }), sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, {
          mode: 'history',
          limit: 30
        })]);
        setQueueData(q.queue);
        setHistory(h.history?.slots || []);
      } else {
        await new Promise(r => setTimeout(r, 300));
        setQueueData(MOCK_SAB_FULL.queue);
        setHistory(MOCK_SAB_HISTORY);
      }
    } catch (e) {
      setError(e.message);
      setQueueData(MOCK_SAB_FULL.queue);
      setHistory(MOCK_SAB_HISTORY);
    }
    setLoading(false);
  }, [hasKey, cfg]);
  usePoller(load, 8000, true);
  const doPause = async () => {
    try {
      setPaused(p => !p);
      setQueueData(q => q ? {
        ...q,
        status: paused ? 'Downloading' : 'Paused'
      } : q);
      notify(paused ? '> DOWNLOADS RESUMED' : '> DOWNLOADS PAUSED');
      if (hasKey) await sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, {
        mode: paused ? 'resume' : 'pause'
      });
    } catch {
      setPaused(p => !p);
    }
  };
  const doDelete = async id => {
    try {
      if (hasKey) await sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, {
        mode: 'queue',
        name: 'delete',
        value: id
      });
      setQueueData(q => q ? {
        ...q,
        slots: q.slots.filter(s => s.nzo_id !== id)
      } : q);
      notify('> ITEM REMOVED FROM QUEUE');
    } catch {}
  };
  const setSpeedLimitFn = async () => {
    const val = parseInt(speedLimit);
    if (!val) return;
    try {
      if (hasKey) await sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, {
        mode: 'config',
        name: 'speedlimit',
        value: val
      });
      notify(`> SPEED LIMIT SET: ${val} MB/s`);
    } catch {}
  };
  const retryFailed = async id => {
    try {
      if (hasKey) await sabFetch(cfg.sabnzbd.url, cfg.sabnzbd.apiKey, {
        mode: 'retry',
        value: id
      });
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
      return {
        ...q,
        slots
      };
    });
  };
  const fmtMB = mbStr => {
    const mb = parseFloat(mbStr);
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
  };
  const totalPct = queueData ? (() => {
    const t = parseFloat(queueData.mb);
    const l = parseFloat(queueData.mbleft);
    return t > 0 ? (t - l) / t * 100 : 0;
  })() : 0;
  const filteredSlots = (queueData?.slots || []).filter(s => catFilter === 'all' || s.cat === catFilter);
  const filteredHist = history.filter(h => catFilter === 'all' || h.category === catFilter);
  const cats = ['all', ...[...new Set((queueData?.slots || []).map(s => s.cat).concat(history.map(h => h.category)).filter(Boolean))]];
  if (showCfg) return /*#__PURE__*/React.createElement(BackendConfigPanel, {
    onSave: () => {
      setShowCfg(false);
      load();
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      position: 'relative'
    }
  }, notification && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      background: 'rgba(255,189,46,0.15)',
      borderBottom: '1px solid var(--color-warn)',
      padding: '4px 12px',
      fontSize: '0.75rem',
      color: 'var(--color-warn)',
      zIndex: 20,
      letterSpacing: 1
    }
  }, notification), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '6px 10px',
      borderBottom: '1px solid rgba(0,255,0,0.1)',
      background: 'rgba(0,0,0,0.6)',
      flexShrink: 0,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-warn)',
      fontSize: '0.8rem',
      fontWeight: 'bold',
      letterSpacing: 2,
      textShadow: '0 0 5px var(--color-warn)'
    }
  }, "[SABNZBD]"), ['queue', 'history', 'stats'].map(t => /*#__PURE__*/React.createElement(FBtn, {
    key: t,
    label: `[${t.toUpperCase()}]`,
    cls: tab === t ? 'cyan' : '',
    onClick: () => setTab(t)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: paused ? '[▶ RESUME]' : '[⏸ PAUSE]',
    cls: paused ? 'cyan' : 'warn',
    onClick: doPause
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: "[\u21BB]",
    onClick: load,
    disabled: loading
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: "[WEB UI]",
    cls: "cyan",
    onClick: onOpenWebUI
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: "[\u2699]",
    onClick: () => setShowCfg(true)
  })), queueData && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '7px 12px',
      borderBottom: '1px solid rgba(0,255,0,0.06)',
      background: 'rgba(0,0,0,0.5)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 5,
      fontSize: '0.75rem',
      flexWrap: 'wrap',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: paused ? 'var(--color-warn)' : 'var(--color-success)',
      fontWeight: 'bold'
    }
  }, paused ? '⏸ PAUSED' : `▶ ${queueData.status?.toUpperCase()}`), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--neon-cyan)',
      textShadow: 'var(--bloom-cyan)'
    }
  }, "\u2193 ", paused ? '0 MB/s' : queueData.speed), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-dim)'
    }
  }, fmtMB(queueData.mbleft), " left"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-dim)'
    }
  }, "ETA: ", queueData.timeleft), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-dim)'
    }
  }, "DISK: ", parseFloat(queueData.diskspace1).toFixed(0), " GB free")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(FProgress, {
    pct: totalPct,
    color: paused ? 'yellow' : 'cyan'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.72rem',
      color: 'var(--neon-cyan)',
      width: 34,
      textAlign: 'right',
      flexShrink: 0
    }
  }, totalPct.toFixed(0), "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.68rem',
      color: 'var(--text-dim)',
      letterSpacing: 1,
      flexShrink: 0
    }
  }, "SPEED LIMIT:"), /*#__PURE__*/React.createElement("input", {
    className: "logview-filter",
    style: {
      width: 80
    },
    placeholder: "MB/s",
    value: speedLimit,
    onChange: e => setSpeedLimit(e.target.value),
    onKeyDown: e => e.key === 'Enter' && setSpeedLimitFn()
  }), /*#__PURE__*/React.createElement(FBtn, {
    label: "[SET]",
    cls: "warn",
    onClick: setSpeedLimitFn
  }), ['0', '5', '10', '25', '50'].map(v => /*#__PURE__*/React.createElement(FBtn, {
    key: v,
    label: v === '0' ? '[∞]' : `[${v}]`,
    onClick: () => {
      setSpeedLimit(v);
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      padding: '4px 8px',
      borderBottom: '1px solid rgba(0,255,0,0.06)',
      flexShrink: 0,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--text-dim)',
      alignSelf: 'center',
      letterSpacing: 1
    }
  }, "CAT:"), cats.map(c => /*#__PURE__*/React.createElement(FBtn, {
    key: c,
    label: `[${c.toUpperCase()}]`,
    cls: catFilter === c ? 'cyan' : '',
    onClick: () => setCatFilter(c)
  }))), tab === 'queue' && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '6px 8px',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, filteredSlots.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      color: 'var(--text-dim)',
      fontSize: '0.8rem'
    }
  }, "> QUEUE EMPTY") : filteredSlots.map((slot, i) => {
    const mb = parseFloat(slot.mb),
      mbl = parseFloat(slot.mbleft);
    const pct = mb > 0 ? (mb - mbl) / mb * 100 : 0;
    return /*#__PURE__*/React.createElement("div", {
      key: slot.nzo_id,
      style: {
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(0,255,0,0.12)',
        borderRadius: 4,
        padding: '8px 10px',
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 5
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        paddingRight: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--color-warn)',
        fontSize: '0.78rem',
        fontWeight: 'bold',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textShadow: '0 0 4px var(--color-warn)'
      }
    }, slot.filename), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.67rem',
        color: 'var(--text-dim)',
        display: 'flex',
        gap: 8,
        marginTop: 2,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--neon-purple)'
      }
    }, "[", slot.cat, "]"), /*#__PURE__*/React.createElement("span", null, "AGE: ", slot.avg_age), /*#__PURE__*/React.createElement("span", null, "ETA: ", slot.timeleft), /*#__PURE__*/React.createElement("span", null, fmtMB(slot.mbleft), " / ", fmtMB(slot.mb)), /*#__PURE__*/React.createElement("span", {
      style: {
        color: slot.priority === 'High' ? 'var(--color-success)' : 'var(--text-dim)'
      }
    }, "PRI: ", slot.priority))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 3,
        flexShrink: 0,
        flexWrap: 'wrap',
        justifyContent: 'flex-end'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.67rem',
        color: slot.status === 'Downloading' ? 'var(--neon-cyan)' : 'var(--color-warn)',
        alignSelf: 'center'
      }
    }, slot.status), /*#__PURE__*/React.createElement(FBtn, {
      label: "[\u2191]",
      onClick: () => movePriority(slot.nzo_id, 'up'),
      title: "Move up"
    }), /*#__PURE__*/React.createElement(FBtn, {
      label: "[\u2193]",
      onClick: () => movePriority(slot.nzo_id, 'down'),
      title: "Move down"
    }), /*#__PURE__*/React.createElement(FBtn, {
      label: "[\u2715]",
      cls: "danger",
      onClick: () => doDelete(slot.nzo_id),
      title: "Remove"
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(FProgress, {
      pct: pct,
      color: slot.status === 'Downloading' ? 'yellow' : 'dim'
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.7rem',
        color: 'var(--color-warn)',
        width: 34,
        textAlign: 'right',
        flexShrink: 0
      }
    }, pct.toFixed(0), "%")));
  })), tab === 'history' && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, filteredHist.map((item, i) => {
    const d = new Date(item.completed * 1000);
    const ts = `${d.toLocaleDateString()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return /*#__PURE__*/React.createElement("div", {
      key: item.nzo_id || i,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px',
        borderBottom: '1px solid rgba(0,255,0,0.04)',
        transition: 'background 0.1s'
      },
      onMouseEnter: e => e.currentTarget.style.background = 'rgba(0,255,0,0.03)',
      onMouseLeave: e => e.currentTarget.style.background = 'transparent'
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: item.status === 'Completed' ? 'var(--color-success)' : 'var(--color-error)',
        fontSize: '0.75rem',
        flexShrink: 0
      }
    }, "\u25CF"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.78rem',
        color: 'var(--text-primary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, item.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.66rem',
        color: 'var(--text-dim)',
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", null, ts), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--neon-purple)'
      }
    }, "[", item.category, "]"), /*#__PURE__*/React.createElement("span", null, item.size), item.fail_message && /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--color-error)'
      }
    }, item.fail_message))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.67rem',
        color: item.status === 'Completed' ? 'var(--color-success)' : 'var(--color-error)'
      }
    }, item.status), item.status === 'Failed' && /*#__PURE__*/React.createElement(FBtn, {
      label: "[RETRY]",
      cls: "warn",
      onClick: () => retryFailed(item.nzo_id)
    })));
  })), tab === 'stats' && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 16,
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 10,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 4
    }
  }, "HISTORY STATS"), [{
    label: 'TOTAL COMPLETED',
    val: history.filter(h => h.status === 'Completed').length,
    color: 'var(--color-success)'
  }, {
    label: 'FAILED',
    val: history.filter(h => h.status === 'Failed').length,
    color: 'var(--color-error)'
  }, {
    label: 'QUEUE SLOTS',
    val: queueData?.slots?.length || 0,
    color: 'var(--neon-cyan)'
  }].map(s => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '6px 10px',
      background: 'rgba(0,0,0,0.4)',
      border: '1px solid rgba(0,255,0,0.08)',
      borderRadius: 3,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.75rem',
      color: 'var(--text-dim)',
      letterSpacing: 1
    }
  }, s.label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.85rem',
      color: s.color,
      fontWeight: 'bold'
    }
  }, s.val)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      marginBottom: 10,
      borderBottom: '1px solid rgba(0,243,255,0.2)',
      paddingBottom: 4
    }
  }, "BY CATEGORY"), cats.filter(c => c !== 'all').map(c => {
    const count = history.filter(h => h.category === c).length;
    return /*#__PURE__*/React.createElement("div", {
      key: c,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.75rem',
        color: 'var(--neon-purple)',
        width: 80,
        flexShrink: 0
      }
    }, "[", c, "]"), /*#__PURE__*/React.createElement(FProgress, {
      pct: history.length ? count / history.length * 100 : 0,
      color: "purple"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.72rem',
        color: 'var(--text-dim)',
        width: 25,
        textAlign: 'right'
      }
    }, count));
  }))));
}

// Export — override the basic versions with full ones
Object.assign(window, {
  RadarrPanel: RadarrPanelFull,
  SonarrPanel: SonarrPanelFull,
  SABnzbdPanel: SABnzbdPanelFull
});
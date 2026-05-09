/* SystemPanels.jsx — File Manager, System Monitor, Log Viewer, Docker, Services, Network, Cron */
const { useState, useEffect, useRef } = React;

// ── Shared mini-button ─────────────────────────────────────────────────────
function Btn({ label, cls = '', onClick }) {
  return <button className={`cmd-btn-sm ${cls}`} onClick={onClick}>{label}</button>;
}

// ══════════════════════════════════════════════════════════════════════════════
// FILE MANAGER
// ══════════════════════════════════════════════════════════════════════════════
const FS_TREE = {
  '/': [
    { name: 'boot',  type: 'dir', size: '-',      perms: 'drwxr-xr-x', modified: 'Apr 25 03:00' },
    { name: 'etc',   type: 'dir', size: '-',      perms: 'drwxr-xr-x', modified: 'May  7 03:15' },
    { name: 'home',  type: 'dir', size: '-',      perms: 'drwxr-xr-x', modified: 'Apr 30 12:00' },
    { name: 'mnt',   type: 'dir', size: '-',      perms: 'drwxr-xr-x', modified: 'Apr 25 03:00' },
    { name: 'opt',   type: 'dir', size: '-',      perms: 'drwxr-xr-x', modified: 'Apr 25 03:00' },
    { name: 'root',  type: 'dir', size: '-',      perms: 'drwx------', modified: 'May  7 02:45' },
    { name: 'srv',   type: 'dir', size: '-',      perms: 'drwxr-xr-x', modified: 'Apr 25 03:00' },
    { name: 'tmp',   type: 'dir', size: '-',      perms: 'drwxrwxrwt', modified: 'May  7 03:10' },
    { name: 'var',   type: 'dir', size: '-',      perms: 'drwxr-xr-x', modified: 'May  7 03:00' },
  ],
  '/mnt': [
    { name: 'array', type: 'dir', size: '-',      perms: 'drwxr-xr-x', modified: 'Apr 25 03:00' },
    { name: 'usb0',  type: 'dir', size: '-',      perms: 'drwxr-xr-x', modified: 'May  6 18:30' },
  ],
  '/mnt/array': [
    { name: 'media',     type: 'dir', size: '-',      perms: 'drwxr-xr-x', modified: 'May  3 11:00' },
    { name: 'backups',   type: 'dir', size: '-',      perms: 'drwxr-x---', modified: 'May  6 00:01' },
    { name: 'downloads', type: 'dir', size: '-',      perms: 'drwxrwxr-x', modified: 'May  7 01:44' },
    { name: 'appdata',   type: 'dir', size: '-',      perms: 'drwxr-xr-x', modified: 'May  7 00:30' },
  ],
  '/mnt/array/media': [
    { name: 'Movies',    type: 'dir', size: '-',      perms: 'drwxr-xr-x', modified: 'May  5 22:10' },
    { name: 'TV Shows',  type: 'dir', size: '-',      perms: 'drwxr-xr-x', modified: 'May  7 01:20' },
    { name: 'Music',     type: 'dir', size: '-',      perms: 'drwxr-xr-x', modified: 'Apr 28 16:00' },
  ],
  '/root': [
    { name: '.bashrc',   type: 'file', size: '3.2K',  perms: '-rw-r--r--', modified: 'Apr 25 03:00' },
    { name: '.ssh',      type: 'dir',  size: '-',      perms: 'drwx------', modified: 'Apr 25 12:00' },
    { name: 'scripts',   type: 'dir',  size: '-',      perms: 'drwxr-xr-x', modified: 'May  2 09:00' },
    { name: 'backup.sh', type: 'file', size: '1.8K',   perms: '-rwxr-xr-x', modified: 'May  1 10:00' },
  ],
  '/home': [
    { name: 'gene',      type: 'dir',  size: '-',      perms: 'drwxr-xr-x', modified: 'May  4 14:00' },
  ],
  '/var': [
    { name: 'log',       type: 'dir',  size: '-',      perms: 'drwxr-xr-x', modified: 'May  7 03:00' },
    { name: 'lib',       type: 'dir',  size: '-',      perms: 'drwxr-xr-x', modified: 'May  6 23:45' },
    { name: 'cache',     type: 'dir',  size: '-',      perms: 'drwxr-xr-x', modified: 'May  7 02:00' },
  ],
};

function FileManager() {
  const [path, setPath] = useState('/');
  const [selected, setSelected] = useState(null);
  const [pathInput, setPathInput] = useState('/');

  const entries = FS_TREE[path] || [{ name: '[empty]', type: 'file', size: '-', perms: '----------', modified: '' }];
  const pathParts = path === '/' ? [''] : path.split('/');

  const navigate = (name, type) => {
    if (type !== 'dir') return;
    const newPath = path === '/' ? `/${name}` : `${path}/${name}`;
    const resolved = FS_TREE[newPath] ? newPath : path;
    setPath(resolved);
    setPathInput(resolved);
    setSelected(null);
  };

  const goUp = () => {
    if (path === '/') return;
    const parts = path.split('/');
    parts.pop();
    const parent = parts.join('/') || '/';
    setPath(parent);
    setPathInput(parent);
    setSelected(null);
  };

  const crumbs = path === '/' ? ['/'] : ['/', ...path.split('/').filter(Boolean)];

  return (
    <div className="filemgr-pane">
      <div className="filemgr-toolbar">
        <Btn label="[<]" onClick={goUp} />
        <div className="filemgr-path">
          {crumbs.map((crumb, i) => (
            <span key={i}>
              <span
                style={{ cursor: 'pointer', color: i === crumbs.length - 1 ? 'var(--neon-cyan)' : 'var(--text-dim)' }}
                onClick={() => {
                  const p = i === 0 ? '/' : '/' + crumbs.slice(1, i + 1).join('/');
                  setPath(p); setPathInput(p);
                }}
              >{crumb}</span>
              {i < crumbs.length - 1 && <span style={{ color: 'var(--text-dim)' }}>/</span>}
            </span>
          ))}
        </div>
        <Btn label="[REFRESH]" cls="cyan" onClick={() => setSelected(null)} />
        <Btn label="[UPLOAD]" onClick={() => {}} />
        <Btn label="[MKDIR]" onClick={() => {}} />
      </div>
      {/* Column headers */}
      <div style={{ display: 'flex', gap: 10, padding: '4px 12px', borderBottom: '1px solid rgba(0,255,0,0.1)', fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '1px', flexShrink: 0 }}>
        <span style={{ width: 18 }}></span>
        <span style={{ flex: 1 }}>NAME</span>
        <span className="filemgr-perms">PERMISSIONS</span>
        <span className="filemgr-meta" style={{ width: 50 }}>SIZE</span>
        <span className="filemgr-date">MODIFIED</span>
      </div>
      <div className="filemgr-body">
        {entries.map((entry, i) => (
          <div
            key={i}
            className={`filemgr-row${selected === i ? ' selected' : ''}`}
            onClick={() => setSelected(i)}
            onDoubleClick={() => navigate(entry.name, entry.type)}
          >
            <span className="filemgr-icon">{entry.type === 'dir' ? '[D]' : '[F]'}</span>
            <span className={`filemgr-name${entry.type === 'dir' ? ' dir' : ''}`}>{entry.name}</span>
            <span className="filemgr-perms">{entry.perms}</span>
            <span className="filemgr-meta" style={{ width: 50 }}>{entry.size}</span>
            <span className="filemgr-date">{entry.modified}</span>
          </div>
        ))}
      </div>
      {selected !== null && entries[selected] && (
        <div style={{ padding: '6px 12px', borderTop: '1px solid rgba(0,255,0,0.1)', display: 'flex', gap: 6, flexShrink: 0, background: 'rgba(0,0,0,0.4)' }}>
          <span style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            &gt; {entries[selected].name}
          </span>
          <Btn label="[OPEN]" cls="cyan" onClick={() => navigate(entries[selected].name, entries[selected].type)} />
          <Btn label="[RENAME]" onClick={() => {}} />
          <Btn label="[DELETE]" cls="danger" onClick={() => {}} />
          {entries[selected].type === 'file' && <Btn label="[DOWNLOAD]" onClick={() => {}} />}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SYSTEM MONITOR
// ══════════════════════════════════════════════════════════════════════════════
const PROCS_BASE = [
  { pid: 1,    user: 'root',     cpu: 0.0, mem: 0.0, cmd: '/sbin/init' },
  { pid: 892,  user: 'root',     cpu: 0.0, mem: 0.1, cmd: '/usr/sbin/sshd' },
  { pid: 1024, user: 'root',     cpu: 0.4, mem: 2.4, cmd: '/usr/bin/dockerd' },
  { pid: 1120, user: 'jellyfin', cpu: 3.2, mem: 8.1, cmd: 'jellyfin/bin/jellyfin' },
  { pid: 1340, user: 'root',     cpu: 0.1, mem: 0.6, cmd: 'nginx: master process' },
  { pid: 1341, user: 'www-data', cpu: 0.0, mem: 0.3, cmd: 'nginx: worker process' },
  { pid: 2010, user: 'radarr',   cpu: 0.3, mem: 1.2, cmd: 'Radarr' },
  { pid: 2020, user: 'sonarr',   cpu: 0.2, mem: 1.1, cmd: 'Sonarr' },
  { pid: 2030, user: 'sabnzbd',  cpu: 1.8, mem: 0.9, cmd: 'sabnzbd.py' },
  { pid: 2040, user: 'root',     cpu: 0.0, mem: 0.1, cmd: 'cron' },
  { pid: 2050, user: 'root',     cpu: 0.0, mem: 0.2, cmd: '/usr/sbin/smbd' },
  { pid: 3001, user: 'gene',     cpu: 0.1, mem: 0.4, cmd: 'bash' },
];

function SysBar({ label, value, max = 100 }) {
  const pct = Math.min(100, (value / max) * 100);
  const cls = pct > 85 ? 'crit' : pct > 65 ? 'warn' : '';
  return (
    <div className="sysmon-row">
      <span className="sysmon-label">{label}</span>
      <div className="sysmon-bar-wrap">
        <div className={`sysmon-bar ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`sysmon-val${cls ? ' ' + cls : ''}`} style={{ color: cls === 'crit' ? '#ff5f56' : cls === 'warn' ? '#ffbd2e' : 'var(--neon-green)' }}>
        {typeof value === 'number' ? `${value.toFixed(1)}%` : value}
      </span>
    </div>
  );
}

function SystemMonitor() {
  const { api, isDemo, status } = useBackend();
  const [stats, setStats] = useState({
    cpu: [14.2, 22.5, 8.1, 18.7, 31.0, 9.4, 12.3, 26.1],
    ram: 42.1, swap: 0.0,
    net_rx: 12.4, net_tx: 2.1,
    disk_read: 8.2, disk_write: 3.1,
    uptime: '42d 7h 33m',
    load: [0.15, 0.22, 0.18],
    temp: 44,
  });
  const [procs, setProcs] = useState(PROCS_BASE);
  const [sortBy, setSortBy] = useState('cpu');

  // Demo mode random walk.
  useEffect(() => {
    if (!isDemo) return;
    const iv = setInterval(() => {
      setStats(s => ({
        ...s,
        cpu: s.cpu.map(v => Math.max(2, Math.min(98, v + (Math.random() * 6 - 3)))),
        ram: Math.max(20, Math.min(95, s.ram + (Math.random() * 2 - 1))),
        net_rx: Math.max(0.1, s.net_rx + (Math.random() * 4 - 2)),
        net_tx: Math.max(0.0, s.net_tx + (Math.random() * 2 - 1)),
        disk_read: Math.max(0.0, s.disk_read + (Math.random() * 3 - 1.5)),
        disk_write: Math.max(0.0, s.disk_write + (Math.random() * 2 - 1)),
        temp: Math.max(38, Math.min(72, s.temp + (Math.random() * 2 - 1))),
      }));
      setProcs(p => p.map(proc => ({
        ...proc,
        cpu: Math.max(0, Math.min(30, proc.cpu + (Math.random() * 1.0 - 0.5))),
        mem: Math.max(0, Math.min(20, proc.mem + (Math.random() * 0.2 - 0.1))),
      })));
    }, 1500);
    return () => clearInterval(iv);
  }, [isDemo]);

  // Live polling — system stats and process list.
  useEffect(() => {
    if (isDemo || status !== 'online' || !api) return;
    let alive = true;
    const tick = async () => {
      try {
        const [s, p] = await Promise.all([api.systemStats(), api.processes()]);
        if (!alive) return;
        const ramPct = s.ram && s.ram.total ? 100 * s.ram.used / s.ram.total : 0;
        const rxKb = (s.network && s.network.rxBytesPerSec || 0) / 1024;
        const txKb = (s.network && s.network.txBytesPerSec || 0) / 1024;
        const diskPct = s.disk && s.disk.total ? 100 * s.disk.used / s.disk.total : 0;
        setStats(prev => ({
          ...prev,
          cpu: [s.cpu ? s.cpu.percent : 0],
          ram: ramPct,
          net_rx: rxKb,
          net_tx: txKb,
          disk_read: diskPct,
          disk_write: 0,
        }));
        setProcs(p.map(row => ({
          pid:  row.pid,
          user: row.user,
          cpu:  Number(row.cpu)  || 0,
          mem:  Number(row.mem)  || 0,
          cmd:  row.cmd || '',
        })));
      } catch (_) { /* heartbeat handles offline */ }
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, [api, isDemo, status]);

  const avgCpu = stats.cpu.reduce((a, b) => a + b, 0) / stats.cpu.length;
  const sortedProcs = [...procs].sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <div className="sysmon-pane">
      {/* CPU */}
      <div>
        <div className="sysmon-section-title">CPU — {stats.cpu.length} CORES | LOAD: {stats.load.join(' ')} | TEMP: {stats.temp.toFixed(0)}°C</div>
        {stats.cpu.map((v, i) => <SysBar key={i} label={`CPU${i}`} value={v} />)}
      </div>
      {/* Memory */}
      <div>
        <div className="sysmon-section-title">MEMORY</div>
        <SysBar label="RAM" value={stats.ram} />
        <SysBar label="SWAP" value={stats.swap} />
      </div>
      {/* Network */}
      <div>
        <div className="sysmon-section-title">NETWORK — eth0: 192.168.1.100</div>
        <SysBar label="RX" value={stats.net_rx} max={100} />
        <SysBar label="TX" value={stats.net_tx} max={100} />
      </div>
      {/* Disk */}
      <div>
        <div className="sysmon-section-title">DISK I/O — /dev/md0 (8.0T | 40% used)</div>
        <SysBar label="READ" value={stats.disk_read} max={200} />
        <SysBar label="WRITE" value={stats.disk_write} max={200} />
      </div>
      {/* Processes */}
      <div>
        <div className="sysmon-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>PROCESSES ({procs.length})</span>
          <span style={{ display: 'flex', gap: 4 }}>
            <Btn label="[CPU]" cls={sortBy === 'cpu' ? 'cyan' : ''} onClick={() => setSortBy('cpu')} />
            <Btn label="[MEM]" cls={sortBy === 'mem' ? 'cyan' : ''} onClick={() => setSortBy('mem')} />
          </span>
        </div>
        <table className="proc-table">
          <thead>
            <tr>
              <th>PID</th>
              <th>USER</th>
              <th>%CPU</th>
              <th>%MEM</th>
              <th>COMMAND</th>
            </tr>
          </thead>
          <tbody>
            {sortedProcs.map(p => (
              <tr key={p.pid}>
                <td style={{ color: 'var(--neon-purple)' }}>{p.pid}</td>
                <td>{p.user}</td>
                <td style={{ color: p.cpu > 5 ? '#ffbd2e' : 'var(--text-primary)' }}>{p.cpu.toFixed(1)}</td>
                <td style={{ color: p.mem > 5 ? '#ffbd2e' : 'var(--text-primary)' }}>{p.mem.toFixed(1)}</td>
                <td style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{p.cmd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOG VIEWER
// ══════════════════════════════════════════════════════════════════════════════
const LOG_TEMPLATES = [
  { svc: 'sshd',     level: 'info', msgs: ['Accepted publickey for root', 'Disconnected from 192.168.1.42', 'Server listening on 0.0.0.0 port 22'] },
  { svc: 'docker',   level: 'info', msgs: ['Container radarr started', 'Container sonarr health OK', 'Volume mount /mnt/array success'] },
  { svc: 'nginx',    level: 'info', msgs: ['worker process started', 'access: GET /api/health 200', 'reload signal received'] },
  { svc: 'kernel',   level: 'warn', msgs: ['EXT4-fs warning: maximal mount count reached', 'md: resync completed', 'ACPI: EC interrupt blocked'] },
  { svc: 'systemd',  level: 'info', msgs: ['Started Docker Application Container Engine', 'Reached target multi-user', 'Time has been changed'] },
  { svc: 'cron',     level: 'info', msgs: ['(root) CMD (/root/backup.sh)', '(gene) CMD (df -h >> /var/log/disk.log)', 'RELOAD (root)'] },
  { svc: 'smbd',     level: 'err',  msgs: ['Failed to connect to /mnt/usb0', 'max client limit reached', 'chdir failed'] },
  { svc: 'jellyfin', level: 'info', msgs: ['Transcoding session started', 'Library scan complete: 1,247 items', 'Playback started for user gene'] },
];

function makeLogLine(ts) {
  const tmpl = LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)];
  const msg = tmpl.msgs[Math.floor(Math.random() * tmpl.msgs.length)];
  return { ts, svc: tmpl.svc, level: tmpl.level, msg };
}

function seedLogs() {
  const now = Date.now();
  return Array.from({ length: 40 }, (_, i) => {
    const d = new Date(now - (39 - i) * 8000);
    const ts = `May  7 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    return makeLogLine(ts);
  });
}

function LogViewer() {
  const [logs, setLogs] = useState(seedLogs);
  const [filter, setFilter] = useState('');
  const [follow, setFollow] = useState(true);
  const [levelFilter, setLevelFilter] = useState('all');
  const bodyRef = useRef(null);

  useEffect(() => {
    const iv = setInterval(() => {
      const d = new Date();
      const ts = `May  7 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      setLogs(l => [...l.slice(-199), makeLogLine(ts)]);
    }, 2200);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (follow && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [logs, follow]);

  const filtered = logs.filter(l => {
    const matchText = !filter || l.msg.toLowerCase().includes(filter.toLowerCase()) || l.svc.includes(filter.toLowerCase());
    const matchLevel = levelFilter === 'all' || l.level === levelFilter;
    return matchText && matchLevel;
  });

  return (
    <div className="logview-pane">
      <div className="logview-toolbar">
        <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem', letterSpacing: 1, flexShrink: 0 }}>journalctl -f</span>
        <input
          className="logview-filter"
          placeholder="[ FILTER... ]"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <Btn label={levelFilter === 'all' ? '[ALL]' : `[${levelFilter.toUpperCase()}]`} cls="cyan" onClick={() => setLevelFilter(l => l === 'all' ? 'err' : l === 'err' ? 'warn' : 'all')} />
        <Btn label={follow ? '[FOLLOW: ON]' : '[FOLLOW: OFF]'} cls={follow ? 'cyan' : ''} onClick={() => setFollow(f => !f)} />
        <Btn label="[CLEAR]" onClick={() => setLogs([])} />
      </div>
      <div className="logview-body" ref={bodyRef}>
        {filtered.map((l, i) => (
          <div key={i} className="log-line">
            <span className="log-ts">{l.ts}</span>
            <span className="log-svc">{l.svc}</span>
            <span className={`log-msg${l.level === 'err' ? ' error' : l.level === 'warn' ? ' warn' : ''}`}>{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCKER MANAGER
// ══════════════════════════════════════════════════════════════════════════════
const INITIAL_CONTAINERS = [
  { id: 'a1b2c3d4', name: 'emby',     image: 'emby/embyserver:latest',  status: 'running', ports: '8096:8096', cpu: '1.2%', mem: '512MiB', restarts: 0, created: '2 days ago' },
  { id: 'b2c3d4e5', name: 'radarr',   image: 'linuxserver/radarr:latest', status: 'running', ports: '7878:7878', cpu: '0.3%', mem: '256MiB', restarts: 0, created: '5 days ago' },
  { id: 'c3d4e5f6', name: 'sonarr',   image: 'linuxserver/sonarr:latest', status: 'running', ports: '8989:8989', cpu: '0.2%', mem: '248MiB', restarts: 0, created: '5 days ago' },
  { id: 'd4e5f6a1', name: 'sabnzbd',  image: 'linuxserver/sabnzbd:latest',status: 'running', ports: '8080:8080', cpu: '1.8%', mem: '192MiB', restarts: 1, created: '8 days ago' },
  { id: 'e5f6a1b2', name: 'vikunja',  image: 'vikunja/vikunja:latest',   status: 'running', ports: '3456:3456', cpu: '0.1%', mem: '128MiB', restarts: 0, created: '12 days ago' },
  { id: 'f6a1b2c3', name: 'logseq',   image: 'logseq/logseq:latest',     status: 'stopped', ports: '3000:3000', cpu: '0.0%', mem: '0B',     restarts: 0, created: '15 days ago' },
  { id: 'a7b8c9d0', name: 'portainer',image: 'portainer/portainer-ce:latest', status: 'running', ports: '9000:9000', cpu: '0.1%', mem: '64MiB', restarts: 0, created: '20 days ago' },
];

function DockerManager({ onNotify }) {
  const [containers, setContainers] = useState(INITIAL_CONTAINERS);
  const [expanded, setExpanded] = useState(null);

  const toggle = (id, action) => {
    setContainers(cs => cs.map(c => c.id === id
      ? { ...c, status: action === 'start' ? 'running' : action === 'stop' ? 'stopped' : action === 'pause' ? 'paused' : c.status }
      : c));
    onNotify && onNotify(`> CONTAINER ${id.slice(0,8).toUpperCase()} ${action.toUpperCase()}ED`, action === 'stop' ? 'warn' : 'ok');
  };

  const restart = (id) => {
    setContainers(cs => cs.map(c => c.id === id ? { ...c, status: 'running', restarts: c.restarts + 1 } : c));
    onNotify && onNotify(`> CONTAINER RESTARTING...`, 'warn');
  };

  return (
    <div className="docker-pane">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: 1 }}>
          CONTAINERS: {containers.filter(c => c.status === 'running').length} RUNNING / {containers.length} TOTAL
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn label="[REFRESH]" cls="cyan" onClick={() => onNotify && onNotify('> DOCKER DAEMON POLLED', 'ok')} />
          <Btn label="[PULL IMAGE]" onClick={() => {}} />
        </div>
      </div>
      {containers.map(c => (
        <div key={c.id} className="docker-card">
          <div className="docker-card-header">
            <div className={`docker-status-dot ${c.status}`} />
            <span className="docker-name">{c.name}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{c.id.slice(0,12)}</span>
          </div>
          <div className="docker-meta">
            <span>IMAGE: {c.image}</span>
            <span>PORTS: {c.ports}</span>
            <span>CPU: {c.cpu}</span>
            <span>MEM: {c.mem}</span>
            <span>RESTARTS: {c.restarts}</span>
            <span>CREATED: {c.created}</span>
          </div>
          <div className="docker-actions">
            {c.status !== 'running' && <Btn label="[START]" cls="cyan" onClick={() => toggle(c.id, 'start')} />}
            {c.status === 'running'  && <Btn label="[STOP]"  cls="danger" onClick={() => toggle(c.id, 'stop')} />}
            {c.status === 'running'  && <Btn label="[RESTART]" cls="warn" onClick={() => restart(c.id)} />}
            {c.status === 'running'  && <Btn label="[PAUSE]" onClick={() => toggle(c.id, 'pause')} />}
            <Btn label="[LOGS]" cls="cyan" onClick={() => setExpanded(expanded === c.id ? null : c.id)} />
            <Btn label="[EXEC]" onClick={() => {}} />
            <Btn label="[REMOVE]" cls="danger" onClick={() => {}} />
          </div>
          {expanded === c.id && (
            <div style={{ marginTop: 8, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,255,0,0.1)', borderRadius: 4, padding: '8px 10px', fontSize: '0.72rem', lineHeight: 1.7, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              <div style={{ color: 'var(--neon-cyan)', marginBottom: 4 }}>&gt; LOGS: {c.name} (last 10 lines)</div>
              <div>&gt; {c.name} | {c.image.split(':')[1] || 'latest'} | started</div>
              <div>&gt; [info] container initializing...</div>
              <div>&gt; [info] configuration loaded</div>
              <div>&gt; [info] service listening on :{c.ports.split(':')[0]}</div>
              <div>&gt; [info] ready for connections</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SERVICE MANAGER
// ══════════════════════════════════════════════════════════════════════════════
const INITIAL_SVCS = [
  { name: 'docker.service',     state: 'active',   desc: 'Docker Application Container Engine' },
  { name: 'sshd.service',       state: 'active',   desc: 'OpenBSD Secure Shell server' },
  { name: 'nginx.service',      state: 'active',   desc: 'A high performance web server' },
  { name: 'cron.service',       state: 'active',   desc: 'Regular background program processing' },
  { name: 'smbd.service',       state: 'active',   desc: 'Samba SMB Daemon' },
  { name: 'nmbd.service',       state: 'active',   desc: 'Samba NMB Daemon (NetBIOS)' },
  { name: 'avahi-daemon.service',state: 'active',  desc: 'Avahi mDNS/DNS-SD Stack' },
  { name: 'fail2ban.service',   state: 'active',   desc: 'Fail2Ban Security Daemon' },
  { name: 'ufw.service',        state: 'active',   desc: 'Uncomplicated Firewall' },
  { name: 'logseq-server.service', state: 'inactive', desc: 'Logseq Self-Hosted Server' },
  { name: 'mdmonitor.service',  state: 'active',   desc: 'MD array monitor' },
  { name: 'snapd.service',      state: 'inactive', desc: 'Snappy daemon' },
];

function ServiceManager({ onNotify }) {
  const [svcs, setSvcs] = useState(INITIAL_SVCS);
  const [filter, setFilter] = useState('');

  const doAction = (name, action) => {
    setSvcs(ss => ss.map(s => s.name === name
      ? { ...s, state: action === 'start' ? 'active' : action === 'stop' ? 'inactive' : action === 'restart' ? 'active' : s.state }
      : s));
    onNotify && onNotify(`> systemctl ${action} ${name}`, action === 'stop' ? 'warn' : 'ok');
  };

  const filtered = svcs.filter(s => !filter || s.name.includes(filter) || s.desc.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(0,255,0,0.1)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: 1, flexShrink: 0 }}>systemctl</span>
        <input
          className="logview-filter"
          placeholder="[ FILTER UNITS... ]"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ flex: 1 }}
        />
        <Btn label="[DAEMON-RELOAD]" cls="warn" onClick={() => onNotify && onNotify('> systemctl daemon-reload', 'ok')} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
        {filtered.map(s => (
          <div key={s.name} className="svc-row">
            <span className={`svc-state ${s.state}`}>
              {s.state === 'active' ? '● active' : '○ inactive'}
            </span>
            <span className="svc-name">
              <div style={{ color: 'var(--neon-green)', fontSize: '0.8rem', fontWeight: 'bold' }}>{s.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{s.desc}</div>
            </span>
            <div className="svc-actions">
              {s.state !== 'active' && <Btn label="[START]" cls="cyan" onClick={() => doAction(s.name, 'start')} />}
              {s.state === 'active'  && <Btn label="[STOP]"  cls="danger" onClick={() => doAction(s.name, 'stop')} />}
              {s.state === 'active'  && <Btn label="[RESTART]" cls="warn" onClick={() => doAction(s.name, 'restart')} />}
              <Btn label="[LOGS]" onClick={() => {}} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NETWORK MAP
// ══════════════════════════════════════════════════════════════════════════════
const NET_HOSTS = [
  { ip: '192.168.1.1',   mac: 'c4:e9:84:12:34:56', host: 'router',    type: 'gateway', status: 'up',   latency: '1ms' },
  { ip: '192.168.1.100', mac: 'a8:b3:54:fe:dc:ba', host: 'nas',       type: 'server',  status: 'up',   latency: '0ms' },
  { ip: '192.168.1.42',  mac: 'b8:27:eb:ab:cd:ef', host: 'desktop',   type: 'client',  status: 'up',   latency: '2ms' },
  { ip: '192.168.1.50',  mac: 'dc:a6:32:12:34:56', host: 'raspi',     type: 'server',  status: 'up',   latency: '3ms' },
  { ip: '192.168.1.55',  mac: 'f4:6d:04:ab:cd:ef', host: 'tv-main',   type: 'media',   status: 'up',   latency: '5ms' },
  { ip: '192.168.1.60',  mac: '00:11:22:33:44:55', host: 'laptop',    type: 'client',  status: 'down', latency: '-' },
  { ip: '192.168.1.70',  mac: '11:22:33:44:55:66', host: 'phone-gene',type: 'mobile',  status: 'up',   latency: '8ms' },
  { ip: '192.168.1.200', mac: '22:33:44:55:66:77', host: 'switch-01', type: 'network', status: 'up',   latency: '0ms' },
];

const TYPE_ICONS = { gateway: '[GW]', server: '[SRV]', client: '[PC]', media: '[TV]', mobile: '[MOB]', network: '[SW]' };

function NetworkMap({ onNotify }) {
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState(null);

  const scan = () => {
    setScanning(true);
    setTimeout(() => { setScanning(false); onNotify && onNotify('> NETWORK SCAN COMPLETE: 8 HOSTS', 'ok'); }, 2000);
  };

  return (
    <div className="netmap-pane">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--neon-cyan)', letterSpacing: 2, textShadow: 'var(--bloom-cyan)' }}>
          SUBNET: 192.168.1.0/24 | {NET_HOSTS.filter(h => h.status === 'up').length} ONLINE
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn label={scanning ? '[SCANNING...]' : '[SCAN NETWORK]'} cls="cyan" onClick={scan} />
          <Btn label="[PING ALL]" onClick={() => onNotify && onNotify('> PING SWEEP COMPLETE', 'ok')} />
        </div>
      </div>
      {/* Visual map */}
      <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,0,0.15)', borderRadius: 4, padding: 12, marginBottom: 12, position: 'relative', minHeight: 140 }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 8, letterSpacing: 1 }}>TOPOLOGY: STAR (192.168.1.1)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {NET_HOSTS.map((h, i) => (
            <div
              key={i}
              onClick={() => setSelected(i)}
              style={{
                background: selected === i ? 'rgba(0,255,0,0.15)' : 'rgba(0,20,0,0.4)',
                border: `1px solid ${h.status === 'up' ? (selected === i ? 'var(--neon-green)' : 'rgba(0,255,0,0.3)') : 'rgba(255,95,86,0.3)'}`,
                borderRadius: 4,
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: '0.72rem',
                color: h.status === 'up' ? 'var(--text-primary)' : 'rgba(255,95,86,0.6)',
                transition: 'all 0.15s',
                minWidth: 90,
              }}
            >
              <div style={{ color: h.status === 'up' ? 'var(--neon-cyan)' : '#ff5f56', marginBottom: 2 }}>{TYPE_ICONS[h.type]} {h.host}</div>
              <div style={{ color: 'var(--text-dim)' }}>{h.ip}</div>
              <div style={{ color: h.status === 'up' ? '#27c93f' : '#ff5f56' }}>{h.status === 'up' ? '● ONLINE' : '○ OFFLINE'}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Host table */}
      <table className="proc-table">
        <thead>
          <tr>
            <th>STATUS</th>
            <th>IP</th>
            <th>HOSTNAME</th>
            <th>MAC</th>
            <th>TYPE</th>
            <th>LATENCY</th>
            <th>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {NET_HOSTS.map((h, i) => (
            <tr key={i} onClick={() => setSelected(i)} style={{ cursor: 'pointer' }}>
              <td><span style={{ color: h.status === 'up' ? '#27c93f' : '#ff5f56' }}>{h.status === 'up' ? '●' : '○'}</span></td>
              <td style={{ color: 'var(--neon-green)' }}>{h.ip}</td>
              <td>{h.host}</td>
              <td style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{h.mac}</td>
              <td style={{ color: 'var(--neon-purple)' }}>{h.type}</td>
              <td>{h.latency}</td>
              <td>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Btn label="[PING]" onClick={() => onNotify && onNotify(`> PING ${h.ip}: ${h.latency}`, 'ok')} />
                  {h.type === 'server' && <Btn label="[SSH]" cls="cyan" onClick={() => onNotify && onNotify(`> SSH ${h.ip}`, 'ok')} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CRON EDITOR
// ══════════════════════════════════════════════════════════════════════════════
const INITIAL_CRONS = [
  { id: 1, schedule: '0 2 * * *',    cmd: '/root/backup.sh >> /var/log/backup.log',      enabled: true,  owner: 'root',   desc: 'Daily backup' },
  { id: 2, schedule: '*/5 * * * *',  cmd: 'df -h >> /var/log/disk.log',                  enabled: true,  owner: 'gene',   desc: 'Disk usage log' },
  { id: 3, schedule: '0 4 * * 0',    cmd: 'apt-get update && apt-get -y upgrade',         enabled: false, owner: 'root',   desc: 'Weekly update' },
  { id: 4, schedule: '0 * * * *',    cmd: '/usr/bin/docker system prune -f',              enabled: true,  owner: 'root',   desc: 'Docker prune' },
  { id: 5, schedule: '30 3 * * *',   cmd: 'rsync -avz /mnt/array/ /mnt/usb0/backup/',    enabled: true,  owner: 'root',   desc: 'Array rsync backup' },
  { id: 6, schedule: '0 6 1 * *',    cmd: 'certbot renew --quiet',                        enabled: true,  owner: 'root',   desc: 'SSL cert renewal' },
];

function CronEditor({ onNotify }) {
  const [crons, setCrons] = useState(INITIAL_CRONS);
  const [editing, setEditing] = useState(null);
  const [newCron, setNewCron] = useState({ schedule: '', cmd: '', desc: '', owner: 'root' });
  const [showAdd, setShowAdd] = useState(false);

  const toggleEnabled = (id) => setCrons(cs => cs.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  const deleteCron = (id) => { setCrons(cs => cs.filter(c => c.id !== id)); onNotify && onNotify('> CRON JOB REMOVED', 'warn'); };
  const addCron = () => {
    if (!newCron.schedule || !newCron.cmd) return;
    setCrons(cs => [...cs, { id: Date.now(), ...newCron, enabled: true }]);
    setNewCron({ schedule: '', cmd: '', desc: '', owner: 'root' });
    setShowAdd(false);
    onNotify && onNotify('> CRON JOB ADDED', 'ok');
  };

  return (
    <div className="cron-pane">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: 1 }}>
          CRONTAB: {crons.filter(c => c.enabled).length} ACTIVE
        </span>
        <Btn label="[+ ADD JOB]" cls="cyan" onClick={() => setShowAdd(s => !s)} />
      </div>

      {showAdd && (
        <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,243,255,0.3)', borderRadius: 4, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <div style={{ color: 'var(--neon-cyan)', fontSize: '0.75rem', letterSpacing: 1 }}>&gt; NEW CRON JOB</div>
          {[
            { key: 'schedule', placeholder: 'SCHEDULE (e.g. 0 2 * * *)' },
            { key: 'cmd',      placeholder: 'COMMAND' },
            { key: 'desc',     placeholder: 'DESCRIPTION' },
            { key: 'owner',    placeholder: 'OWNER (root)' },
          ].map(f => (
            <input key={f.key} className="logview-filter" placeholder={f.placeholder}
              value={newCron[f.key]} onChange={e => setNewCron(n => ({ ...n, [f.key]: e.target.value }))}
              style={{ width: '100%' }}
            />
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn label="[SAVE]" cls="cyan" onClick={addCron} />
            <Btn label="[CANCEL]" onClick={() => setShowAdd(false)} />
          </div>
        </div>
      )}

      {crons.map(c => (
        <div key={c.id} className="cron-row">
          <span className={`cron-enabled`} style={{ color: c.enabled ? '#27c93f' : '#ff5f56', width: 8, flexShrink: 0 }}>●</span>
          <span className="cron-schedule">{c.schedule}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cron-cmd" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cmd}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{c.desc} [{c.owner}]</div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <Btn label={c.enabled ? '[DISABLE]' : '[ENABLE]'} cls={c.enabled ? 'warn' : 'cyan'} onClick={() => toggleEnabled(c.id)} />
            <Btn label="[EDIT]" onClick={() => setEditing(c.id)} />
            <Btn label="[DEL]" cls="danger" onClick={() => deleteCron(c.id)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Export all
Object.assign(window, { FileManager, SystemMonitor, LogViewer, DockerManager, ServiceManager, NetworkMap, CronEditor });

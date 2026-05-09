/* TerminalPane.jsx — Kitty-style terminal emulator
   - Output flows top-to-bottom naturally
   - Prompt appears inline after output (not pinned to bottom)
   - Full ANSI 256-color + true-color support via escape code parser
   - Font ligatures, proper spacing
   - Multi-tab sessions
*/
const { useState, useEffect, useRef, useCallback, useReducer } = React;

// ── ANSI escape code parser ───────────────────────────────────────────────────
// Colors match Gene's ENCOM kitty theme from workfedora dotfiles
// background #000000, foreground #00a595, cursor #bbbbbb
function parseAnsi(text) {
  const segments = [];
  const re = /\x1b\[([0-9;]*)m|([^\x1b]+)/g;
  let style = {};
  let match;

  // ENCOM palette (from kitty/kitty-themes/ENCOM.conf)
  const ANSI_COLORS_FG = {
    30: '#000000',  // color0  — black
    31: '#9f0000',  // color1  — dark red
    32: '#008b00',  // color2  — dark green
    33: '#ffcf00',  // color3  — yellow
    34: '#0081ff',  // color4  — blue
    35: '#bc00ca',  // color5  — magenta
    36: '#008b8b',  // color6  — cyan
    37: '#bbbbbb',  // color7  — white
    90: '#545454',  // color8  — bright black
    91: '#ff0000',  // color9  — bright red
    92: '#00ee00',  // color10 — bright green ← primary accent
    93: '#ffff00',  // color11 — bright yellow
    94: '#0000ff',  // color12 — bright blue
    95: '#ff00ff',  // color13 — bright magenta
    96: '#00cdcd',  // color14 — bright cyan
    97: '#ffffff',  // color15 — bright white
  };
  const ANSI_COLORS_BG = {
    40: '#000000', 41: '#9f0000', 42: '#008b00', 43: '#ffcf00',
    44: '#0081ff', 45: '#bc00ca', 46: '#008b8b', 47: '#bbbbbb',
    100:'#545454', 101:'#ff0000', 102:'#00ee00', 103:'#ffff00',
    104:'#0000ff', 105:'#ff00ff', 106:'#00cdcd', 107:'#ffffff',
  };

  while ((match = re.exec(text)) !== null) {
    if (match[1] !== undefined) {
      // ESC[ sequence
      const codes = match[1].split(';').map(Number);
      let i = 0;
      while (i < codes.length) {
        const c = codes[i];
        if (c === 0) { style = {}; }
        else if (c === 1) { style = { ...style, fontWeight: 'bold' }; }
        else if (c === 2) { style = { ...style, opacity: 0.6 }; }
        else if (c === 3) { style = { ...style, fontStyle: 'italic' }; }
        else if (c === 4) { style = { ...style, textDecoration: 'underline' }; }
        else if (c === 7) { style = { ...style, filter: 'invert(1)' }; }
        else if (c === 22) { const { fontWeight, ...rest } = style; style = rest; }
        else if (c === 39) { const { color, ...rest } = style; style = rest; }
        else if (c === 49) { const { backgroundColor, ...rest } = style; style = rest; }
        else if (ANSI_COLORS_FG[c]) { style = { ...style, color: ANSI_COLORS_FG[c] }; }
        else if (ANSI_COLORS_BG[c]) { style = { ...style, backgroundColor: ANSI_COLORS_BG[c] }; }
        else if (c === 38 && codes[i+1] === 5) {
          // 256-color fg: 38;5;N
          style = { ...style, color: xterm256(codes[i+2]) }; i += 2;
        } else if (c === 48 && codes[i+1] === 5) {
          style = { ...style, backgroundColor: xterm256(codes[i+2]) }; i += 2;
        } else if (c === 38 && codes[i+1] === 2) {
          // True-color fg: 38;2;R;G;B
          style = { ...style, color: `rgb(${codes[i+2]},${codes[i+3]},${codes[i+4]})` }; i += 4;
        } else if (c === 48 && codes[i+1] === 2) {
          style = { ...style, backgroundColor: `rgb(${codes[i+2]},${codes[i+3]},${codes[i+4]})` }; i += 4;
        }
        i++;
      }
    } else if (match[2]) {
      segments.push({ text: match[2], style: { ...style } });
    }
  }
  return segments;
}

function xterm256(n) {
  if (n < 16) {
    const basic = ['#1e1e1e','#ff5f56','#27c93f','#ffbd2e','#4d9ef0','#cc44ff','#00f3ff','#ccffcc',
                   '#555555','#ff7b6b','#5af78e','#f3f99d','#57c7ff','#ff69c8','#9aedfe','#f1f1f0'];
    return basic[n] || '#ccffcc';
  }
  if (n < 232) {
    n -= 16;
    const b = n % 6, g = Math.floor(n/6) % 6, r = Math.floor(n/36);
    const v = i => i ? 55 + i*40 : 0;
    return `rgb(${v(r)},${v(g)},${v(b)})`;
  }
  const gray = 8 + (n-232)*10;
  return `rgb(${gray},${gray},${gray})`;
}

// ── Terminal line types ───────────────────────────────────────────────────────
// Each "line" in the terminal buffer is one of:
//   { kind: 'output',  segments: [{text, style}] }   — ANSI-parsed output
//   { kind: 'prompt',  user, host, cwd, input }       — a completed command line
//   { kind: 'blank' }                                 — empty line

function OutputLine({ segments }) {
  if (!segments || segments.length === 0) return <div style={{ minHeight: '1.4em' }} />;
  return (
    <div style={{ lineHeight: '1.55', whiteSpace: 'pre-wrap', wordBreak: 'break-all', minHeight: '1.4em' }}>
      {segments.map((seg, i) => (
        <span key={i} style={seg.style}>{seg.text}</span>
      ))}
    </div>
  );
}

// ── Prompt line — matches Gene's ENCOM kitty theme ───────────────────────────
// background #000000, foreground #00a595 (teal-cyan), cursor #bbbbbb
function PromptLine({ user, host, cwd, cmd }) {
  return (
    <div style={{ lineHeight: '1.55', whiteSpace: 'pre-wrap', wordBreak: 'break-all', display: 'flex', flexWrap: 'wrap', gap: 0 }}>
      {/* user — ENCOM bright green */}
      <span style={{ color: '#00ee00', fontWeight: 'bold' }}>{user}</span>
      <span style={{ color: '#00a595' }}>@</span>
      {/* host — ENCOM cyan */}
      <span style={{ color: '#00cdcd', fontWeight: 'bold' }}>{host}</span>
      <span style={{ color: '#00a595' }}>:</span>
      {/* cwd — ENCOM foreground teal */}
      <span style={{ color: '#00a595', fontWeight: 'bold' }}>{cwd}</span>
      {/* prompt char — red for root (ENCOM color1), teal for user */}
      <span style={{ color: user === 'root' ? '#ff0000' : '#00a595' }}>
        {user === 'root' ? '# ' : '$ '}
      </span>
      <span style={{ color: '#bbbbbb' }}>{cmd}</span>
    </div>
  );
}

// ── Command simulator — ENCOM color palette ───────────────────────────────────
// ENCOM: color2=#008b00, color10=#00ee00, color6=#008b8b, color14=#00cdcd
// color3=#ffcf00, color11=#ffff00, color1=#9f0000, color9=#ff0000
function simulateCommand(cmd, session) {
  const parts = cmd.trim().split(/\s+/);
  const base  = parts[0];
  const args  = parts.slice(1);
  const G   = '\x1b[32m';   // dark green   #008b00
  const BG  = '\x1b[92m';   // bright green #00ee00 ← primary
  const C   = '\x1b[36m';   // cyan         #008b8b
  const BC  = '\x1b[96m';   // bright cyan  #00cdcd ← secondary
  const Y   = '\x1b[33m';   // yellow       #ffcf00
  const BY  = '\x1b[93m';   // bright yellow #ffff00
  const R   = '\x1b[31m';   // dark red     #9f0000
  const BR  = '\x1b[91m';   // bright red   #ff0000
  const B   = '\x1b[34m';   // blue         #0081ff
  const M   = '\x1b[35m';   // magenta      #bc00ca
  const W   = '\x1b[37m';   // white        #bbbbbb
  const BW  = '\x1b[97m';   // bright white #ffffff
  const DIM = '\x1b[2m';
  const BOLD= '\x1b[1m';
  const RST = '\x1b[0m';

  const map = {
    'ls': () => [
      `${B}${BOLD}bin${RST}   ${B}${BOLD}boot${RST}  ${B}${BOLD}dev${RST}  ${B}${BOLD}etc${RST}  ${B}${BOLD}home${RST}  ${B}${BOLD}lib${RST}  ${B}${BOLD}lib64${RST}`,
      `${B}${BOLD}media${RST}  ${B}${BOLD}mnt${RST}  ${B}${BOLD}opt${RST}  ${B}${BOLD}proc${RST}  ${B}${BOLD}root${RST}  ${B}${BOLD}run${RST}  ${B}${BOLD}sbin${RST}  ${B}${BOLD}srv${RST}  ${B}${BOLD}sys${RST}  ${B}${BOLD}tmp${RST}  ${B}${BOLD}usr${RST}  ${B}${BOLD}var${RST}`,
    ],
    'ls -la': () => [
      `${BOLD}${W}total 80${RST}`,
      `${DIM}drwxr-xr-x${RST} 18 ${G}root${RST} ${G}root${RST} 4096 May  7 03:00 ${B}${BOLD}.${RST}`,
      `${DIM}drwxr-xr-x${RST} 18 ${G}root${RST} ${G}root${RST} 4096 May  7 03:00 ${B}${BOLD}..${RST}`,
      `${DIM}lrwxrwxrwx${RST}  1 ${G}root${RST} ${G}root${RST}    7 Feb  3  2024 ${C}bin${RST} -> ${C}usr/bin${RST}`,
      `${DIM}drwxr-xr-x${RST}  4 ${G}root${RST} ${G}root${RST} 4096 May  6 22:14 ${B}${BOLD}boot${RST}`,
      `${DIM}drwxr-xr-x${RST}  7 ${G}root${RST} ${G}root${RST} 3820 May  7 03:00 ${B}${BOLD}dev${RST}`,
      `${DIM}drwxr-xr-x${RST} 86 ${G}root${RST} ${G}root${RST} 4096 May  7 03:15 ${B}${BOLD}etc${RST}`,
      `${DIM}drwxr-xr-x${RST}  4 ${G}root${RST} ${G}root${RST} 4096 Apr 30 12:00 ${B}${BOLD}home${RST}`,
      `${DIM}drwx------${RST}  8 ${G}root${RST} ${G}root${RST} 4096 May  7 02:45 ${B}${BOLD}root${RST}`,
    ],
    'ls -lh /mnt/array': () => [
      `${BOLD}${W}total 0${RST}`,
      `${DIM}drwxr-xr-x${RST} 5 ${G}root${RST} ${G}root${RST}   0 May  3 11:00 ${B}${BOLD}media${RST}`,
      `${DIM}drwxr-x---${RST} 3 ${G}root${RST} ${G}root${RST}   0 May  6 00:01 ${B}${BOLD}backups${RST}`,
      `${DIM}drwxrwxr-x${RST} 2 ${G}root${RST} ${G}users${RST}  0 May  7 01:44 ${B}${BOLD}downloads${RST}`,
      `${DIM}drwxr-xr-x${RST} 8 ${G}root${RST} ${G}root${RST}   0 May  7 00:30 ${B}${BOLD}appdata${RST}`,
    ],
    'pwd':      () => [session.cwd === '~' ? '/root' : session.cwd],
    'whoami':   () => [`${G}${session.user}${RST}`],
    'hostname': () => [`${C}${session.host}${RST}`],
    'uname -a': () => [`Linux ${C}nas${RST} 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 x86_64 ${B}GNU/Linux${RST}`],
    'uname':    () => [`Linux`],
    'id':       () => [`uid=0(${G}root${RST}) gid=0(${G}root${RST}) groups=0(${G}root${RST})`],
    'date':     () => [new Date().toString()],
    'df -h': () => [
      `${BOLD}Filesystem      Size  Used Avail Use% Mounted on${RST}`,
      `/dev/sda1        ${G}50G${RST}   ${Y}12G${RST}   ${G}36G${RST}  ${Y}25%${RST} /`,
      `/dev/md0        ${G}8.0T${RST}  ${Y}3.2T${RST}  ${G}4.8T${RST}  ${Y}40%${RST} /mnt/array`,
      `tmpfs           ${G}7.8G${RST}  ${G}1.2G${RST}  ${G}6.6G${RST}  ${G}16%${RST} /dev/shm`,
    ],
    'free -h': () => [
      `${BOLD}               total        used        free      shared  buff/cache   available${RST}`,
      `Mem:           ${G}15Gi${RST}      ${Y}4.2Gi${RST}      ${G}8.1Gi${RST}      ${DIM}512Mi${RST}      ${C}2.7Gi${RST}       ${G}10Gi${RST}`,
      `Swap:          ${G}2.0Gi${RST}        ${DIM}0B${RST}      ${G}2.0Gi${RST}`,
    ],
    'uptime': () => [`${DIM}03:14:21 up${RST} ${G}42 days, 7:33${RST}${DIM},  1 user,${RST}  load average: ${G}0.15${RST}, ${G}0.22${RST}, ${G}0.18${RST}`],
    'top': () => [
      `${BOLD}top - 03:14:21 up 42 days, 7:33, 1 user${RST}`,
      `Tasks: ${G}142${RST} total,   ${Y}2${RST} running, ${G}140${RST} sleeping`,
      `%Cpu(s): ${Y}14.2${RST} us,  ${G}2.1${RST} sy,  ${DIM}0.0${RST} ni, ${G}82.8${RST} id,  ${DIM}0.3${RST} wa`,
      `MiB Mem:  ${G}15360.0${RST} total,  ${G}8294.4${RST} free,  ${Y}4300.8${RST} used,  ${C}2764.8${RST} buff/cache`,
      ``,
      `${BOLD}    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND${RST}`,
      `   ${Y}1120${RST} jellyfin  20   0    4.2g   1.3g  21684 S   ${R}3.2${RST}   8.1 312:09.44 jellyfin`,
      `   ${Y}2030${RST} sabnzbd   20   0  256.4m  98.3m   8192 S   ${Y}1.8${RST}   0.9   5:22.01 sabnzbd.py`,
      `   ${Y}1024${RST} root      20   0    2.1g 389.1m   8192 S   ${Y}0.4${RST}   2.4  18:44.11 dockerd`,
      `(press q to exit — use htop panel for interactive monitoring)`,
    ],
    'ps aux': () => [
      `${BOLD}USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND${RST}`,
      `${G}root${RST}           1  0.0  0.0 167808 12288 ?        Ss   Apr25   0:04 /sbin/init`,
      `${G}root${RST}         892  0.0  0.1 521984 14336 ?        Ssl  Apr25   0:12 /usr/sbin/sshd`,
      `${G}root${RST}        1024  ${Y}0.4${RST}  2.4   2.1g 389148 ?       Ssl  Apr25  18:44 /usr/bin/dockerd`,
      `jellyfin    1120  ${R}3.2${RST}  8.1   4.2g   1.3g ?         Ssl  Apr25 312:09 /usr/lib/jellyfin/bin/jellyfin`,
      `${DIM}root${RST}        2048  0.0  0.0  12288   3072 pts/0    R+   03:14   0:00 ps aux`,
    ],
    'ps': () => [
      `${BOLD}    PID TTY          TIME CMD${RST}`,
      `   3001 pts/0    00:00:00 bash`,
      `   3142 pts/0    00:00:00 ps`,
    ],
    'docker ps': () => [
      `${BOLD}CONTAINER ID   IMAGE                     STATUS        PORTS                    NAMES${RST}`,
      `${C}a1b2c3d4e5f6${RST}   emby/embyserver:latest    ${G}Up 2 days${RST}     0.0.0.0:8096->8096/tcp   ${Y}emby${RST}`,
      `${C}b2c3d4e5f6a1${RST}   linuxserver/radarr        ${G}Up 5 days${RST}     0.0.0.0:7878->7878/tcp   ${Y}radarr${RST}`,
      `${C}c3d4e5f6a1b2${RST}   linuxserver/sonarr        ${G}Up 5 days${RST}     0.0.0.0:8989->8989/tcp   ${Y}sonarr${RST}`,
      `${C}d4e5f6a1b2c3${RST}   linuxserver/sabnzbd       ${G}Up 8 days${RST}     0.0.0.0:8080->8080/tcp   ${Y}sabnzbd${RST}`,
      `${C}e5f6a1b2c3d4${RST}   vikunja/vikunja:latest    ${G}Up 12 days${RST}    0.0.0.0:3456->3456/tcp   ${Y}vikunja${RST}`,
      `${C}f6a1b2c3d4e5${RST}   portainer/portainer-ce    ${G}Up 20 days${RST}    0.0.0.0:9000->9000/tcp   ${Y}portainer${RST}`,
    ],
    'docker ps -a': () => [
      `${BOLD}CONTAINER ID   IMAGE                     STATUS        PORTS                    NAMES${RST}`,
      `${C}a1b2c3d4e5f6${RST}   emby/embyserver:latest    ${G}Up 2 days${RST}     0.0.0.0:8096->8096/tcp   ${Y}emby${RST}`,
      `${C}b2c3d4e5f6a1${RST}   linuxserver/radarr        ${G}Up 5 days${RST}     0.0.0.0:7878->7878/tcp   ${Y}radarr${RST}`,
      `${C}f6a1b2c3d4e5${RST}   portainer/portainer-ce    ${G}Up 20 days${RST}    0.0.0.0:9000->9000/tcp   ${Y}portainer${RST}`,
      `${C}a7b8c9d0e1f2${RST}   logseq/logseq:latest      ${R}Exited (0) 3d${RST}  0.0.0.0:3000->3000/tcp   ${DIM}logseq${RST}`,
    ],
    'docker images': () => [
      `${BOLD}REPOSITORY                TAG       IMAGE ID       CREATED        SIZE${RST}`,
      `${G}emby/embyserver${RST}           latest    ${C}a1b2c3d4e5f6${RST}   2 days ago     1.2GB`,
      `${G}linuxserver/radarr${RST}        latest    ${C}b2c3d4e5f6a1${RST}   5 days ago     512MB`,
      `${G}linuxserver/sonarr${RST}        latest    ${C}c3d4e5f6a1b2${RST}   5 days ago     498MB`,
      `${G}linuxserver/sabnzbd${RST}       latest    ${C}d4e5f6a1b2c3${RST}   8 days ago     312MB`,
      `${G}portainer/portainer-ce${RST}    latest    ${C}f6a1b2c3d4e5${RST}   20 days ago    298MB`,
    ],
    'docker stats --no-stream': () => [
      `${BOLD}NAME          CPU %   MEM USAGE / LIMIT     MEM %   NET I/O${RST}`,
      `${Y}emby${RST}           ${Y}3.2%${RST}    1.3GiB / 15GiB        ${Y}8.7%${RST}    2.1GB / 842MB`,
      `${Y}radarr${RST}         ${G}0.3%${RST}    256MiB / 15GiB        ${G}1.7%${RST}    524MB / 218MB`,
      `${Y}sonarr${RST}         ${G}0.2%${RST}    248MiB / 15GiB        ${G}1.6%${RST}    498MB / 201MB`,
      `${Y}sabnzbd${RST}        ${Y}1.8%${RST}    192MiB / 15GiB        ${G}1.3%${RST}    142GB / 1.2GB`,
      `${Y}vikunja${RST}        ${G}0.1%${RST}    128MiB / 15GiB        ${G}0.8%${RST}    82MB / 45MB`,
    ],
    'systemctl list-units --type=service': () => [
      `${BOLD}UNIT                        LOAD   ACTIVE SUB     DESCRIPTION${RST}`,
      `${G}docker.service${RST}              loaded ${G}active${RST} running Docker Application Container Engine`,
      `${G}sshd.service${RST}                loaded ${G}active${RST} running OpenBSD Secure Shell server`,
      `${G}nginx.service${RST}               loaded ${G}active${RST} running A high performance web server`,
      `${G}cron.service${RST}                loaded ${G}active${RST} running Regular background program processing`,
      `${G}smbd.service${RST}                loaded ${G}active${RST} running Samba SMB Daemon`,
      `${R}logseq-server.service${RST}       loaded ${R}inactive${RST} dead    Logseq Self-Hosted Server`,
      ``,
      `${DIM}LOAD   = Reflects whether the unit definition was properly loaded.${RST}`,
      `${DIM}ACTIVE = The high-level unit activation state.${RST}`,
    ],
    'journalctl -n 20': () => [
      `${DIM}-- Journal begins at Mon 2024-04-22 00:00:01 UTC. --${RST}`,
      `May 07 03:14:18 nas ${G}sshd[892]${RST}: Accepted publickey for root from 192.168.1.42 port 52341`,
      `May 07 03:14:19 nas ${C}systemd[1]${RST}: Started Session 42 of User root.`,
      `May 07 03:14:20 nas ${G}docker[1024]${RST}: time="2026-05-07T03:14:20Z" level=info msg="Container started" name=radarr`,
      `May 07 03:14:21 nas ${Y}kernel${RST}: EXT4-fs (sda1): mounted filesystem with ordered data mode`,
      `May 07 03:14:22 nas ${G}nginx[1340]${RST}: 192.168.1.42 - - [07/May/2026:03:14:22 +0000] "GET / HTTP/1.1" 200`,
      `May 07 03:14:23 nas ${G}cron[2040]${RST}: (root) CMD (/root/backup.sh >> /var/log/backup.log)`,
    ],
    'ip addr': () => [
      `1: ${BOLD}lo${RST}: <LOOPBACK,UP,LOWER_UP> mtu 65536`,
      `    inet ${G}127.0.0.1/8${RST} scope host lo`,
      `2: ${BOLD}eth0${RST}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state ${G}UP${RST}`,
      `    inet ${G}192.168.1.100/24${RST} brd 192.168.1.255 scope global dynamic eth0`,
      `    inet6 ${C}fe80::aab3:54ff:fefe:dcba/64${RST} scope link`,
    ],
    'ip route': () => [
      `default via ${Y}192.168.1.1${RST} dev eth0 proto dhcp metric 100`,
      `${G}192.168.1.0/24${RST} dev eth0 proto kernel scope link src 192.168.1.100`,
    ],
    'cat /etc/os-release': () => [
      `PRETTY_NAME="${G}Debian GNU/Linux 12 (bookworm)${RST}"`,
      `NAME="${C}Debian GNU/Linux${RST}"`,
      `VERSION_ID="${Y}12${RST}"`,
      `ID=debian`,
      `HOME_URL="https://www.debian.org/"`,
    ],
    'cat /proc/cpuinfo': () => [
      `processor\t: 0`,
      `model name\t: ${G}Intel(R) Core(TM) i5-12400 CPU @ 2.50GHz${RST}`,
      `cpu MHz\t\t: ${Y}2500.000${RST}`,
      `cache size\t: ${C}18432 KB${RST}`,
      `cpu cores\t: 6`,
      `siblings\t: 12`,
      ``,
      `${DIM}... (7 more processors)${RST}`,
    ],
    'lsblk': () => [
      `${BOLD}NAME     MAJ:MIN RM   SIZE RO TYPE  MOUNTPOINTS${RST}`,
      `${G}sda${RST}        8:0    0    50G  0 disk`,
      `  ${C}sda1${RST}     8:1    0    50G  0 part  /`,
      `${G}sdb${RST}        8:16   0     4T  0 disk`,
      `${G}sdc${RST}        8:32   0     4T  0 disk`,
      `  ${Y}md0${RST}        9:0    0     8T  0 raid1 /mnt/array`,
      `${G}sdd${RST}        8:48   0     2T  0 disk`,
      `  ${C}sdd1${RST}     8:49   0     2T  0 part  /mnt/usb0`,
    ],
    'clear': () => 'CLEAR',
    'reset': () => 'CLEAR',
    'exit': () => [`${DIM}logout${RST}`, `${R}Connection to ${session.host} closed.${RST}`],
    'logout': () => [`${DIM}logout${RST}`],
    'tmux ls': () => [
      `${G}nas-main${RST}: 4 windows (created Mon May  6 10:00:00 2026) [220x50]`,
      `${C}nas-monitor${RST}: 1 window (created Mon May  6 10:00:01 2026) [220x50]`,
      `${Y}nas-logs${RST}: 1 window (created Mon May  6 10:00:02 2026) [220x50]`,
    ],
    'tmux new-session -d -s test': () => [`${G}Session 'test' created.${RST}`],
    'help': () => [
      `${BOLD}${C}NAS_TERMINAL — Simulated Shell${RST}`,
      `${DIM}Wire up ttyd + tmux for a live session. See Developer Guide.${RST}`,
      ``,
      `${BOLD}File system:${RST}  ls, ls -la, pwd, cd, cat, lsblk`,
      `${BOLD}System:${RST}       uname, uname -a, hostname, whoami, id, uptime, date`,
      `${BOLD}Resources:${RST}    top, ps aux, free -h, df -h`,
      `${BOLD}Network:${RST}      ip addr, ip route`,
      `${BOLD}Docker:${RST}       docker ps, docker ps -a, docker images, docker stats --no-stream`,
      `${BOLD}Services:${RST}     systemctl list-units --type=service`,
      `${BOLD}Logs:${RST}         journalctl -n 20`,
      `${BOLD}tmux:${RST}         tmux ls, tmux new-session -d -s NAME`,
      `${BOLD}Other:${RST}        echo, ping, clear, reset, exit`,
    ],
  };

  const handler = map[cmd.trim()] || map[base];
  if (handler) return handler();

  if (base === 'echo')    return [args.join(' ')];
  if (base === 'cd')      return [];
  if (base === 'mkdir')   return [];
  if (base === 'touch')   return [];
  if (base === 'rm')      return [`${R}rm: ${args.join(' ')}: No such file or directory${RST}`];
  if (base === 'cat')     return [`${R}cat: ${args[0] || ''}: No such file or directory${RST}`];
  if (base === 'grep')    return [`${DIM}(no matches)${RST}`];
  if (base === 'man')     return [`${Y}What manual page do you want?${RST}`, `${DIM}For example, try: man ls${RST}`];
  if (base === 'sudo')    return [parts.slice(1).join(' ')].flatMap(c => simulateCommand(c, session));
  if (base === 'which')   return [`${G}/usr/bin/${args[0] || 'command'}${RST}`];
  if (base === 'alias')   return [];
  if (base === 'export')  return [];
  if (base === 'ping') {
    const target = args[0] || 'localhost';
    return [
      `PING ${target} 56(84) bytes of data.`,
      `64 bytes from ${G}${target}${RST}: icmp_seq=1 ttl=64 time=${G}0.42 ms${RST}`,
      `64 bytes from ${G}${target}${RST}: icmp_seq=2 ttl=64 time=${G}0.38 ms${RST}`,
      `64 bytes from ${G}${target}${RST}: icmp_seq=3 ttl=64 time=${G}0.41 ms${RST}`,
      ``,
      `${DIM}--- ${target} ping statistics ---${RST}`,
      `3 packets transmitted, 3 received, ${G}0% packet loss${RST}, time 2002ms`,
      `rtt min/avg/max/mdev = 0.380/0.403/0.420/0.016 ms`,
    ];
  }
  if (base === 'ssh') {
    return [
      `${DIM}ssh: connect to host ${args[0] || 'remote'} port 22: Connection established (simulated)${RST}`,
      `${Y}Tip: Use ttyd + tmux for real SSH sessions. See Developer Guide.${RST}`,
    ];
  }
  if (base === 'curl' || base === 'wget') {
    return [`${Y}${base}: network requests not available in simulated mode${RST}`];
  }

  // Unknown command
  return [`${session.shell || 'bash'}: ${R}${base}${RST}: command not found`];
}

// ── Session state management ──────────────────────────────────────────────────
function createSession(id, host) {
  // Colors match ENCOM kitty theme from Gene's dotfiles
  const C  = '\x1b[96m';   // bright cyan  #00cdcd — hostnames, titles
  const G  = '\x1b[92m';   // bright green #00ee00 — success, files
  const Y  = '\x1b[93m';   // bright yellow #ffff00 — warnings
  const D  = '\x1b[2m';    // dim
  const RST = '\x1b[0m';
  return {
    id,
    host: host || 'nas.local',
    user: 'root',
    cwd: '~',
    shell: 'bash',
    history: [],
    historyIdx: -1,
    buffer: [
      { kind: 'output', segments: parseAnsi(`${D}Linux nas 6.1.0-21-amd64 #1 SMP Debian 6.1.90 x86_64${RST}`) },
      { kind: 'output', segments: [] },
      { kind: 'output', segments: parseAnsi(`${D}Last login: Wed May  7 03:14:21 2026 from 192.168.1.42${RST}`) },
      { kind: 'output', segments: [] },
      { kind: 'output', segments: parseAnsi(`Welcome to ${C}NAS_TERMINAL${RST} — type ${Y}help${RST} for available commands`) },
      { kind: 'output', segments: [] },
    ],
  };
}

// ── Kitty-style terminal session ──────────────────────────────────────────────
function TermSession({ session, onUpdate }) {
  const [input, setInput] = useState('');
  const [histIdx, setHistIdx] = useState(-1);
  const [inputWidth, setInputWidth] = useState(0);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-scroll to bottom on new output
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [session.buffer.length]);

  // Focus input on click anywhere in terminal
  const focusInput = () => inputRef.current && inputRef.current.focus();

  const prompt = { user: session.user, host: session.host, cwd: session.cwd };

  const runCommand = (cmd) => {
    const trimmed = cmd.trim();
    const newLines = [];

    // Add the prompt + command line to buffer
    newLines.push({ kind: 'prompt', ...prompt, cmd: trimmed });

    if (trimmed) {
      const result = simulateCommand(trimmed, session);

      if (result === 'CLEAR') {
        onUpdate(session.id, s => ({ ...s, buffer: [], history: [trimmed, ...s.history.slice(0,49)] }));
        return;
      }

      // Add output lines
      result.forEach(line => {
        if (line === '') {
          newLines.push({ kind: 'output', segments: [] });
        } else {
          newLines.push({ kind: 'output', segments: parseAnsi(line) });
        }
      });

      // Add trailing blank line
      newLines.push({ kind: 'output', segments: [] });
    }

    onUpdate(session.id, s => ({
      ...s,
      buffer: [...s.buffer, ...newLines],
      history: trimmed ? [trimmed, ...s.history.slice(0, 49)] : s.history,
    }));
    setHistIdx(-1);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIdx = Math.min(histIdx + 1, session.history.length - 1);
      setHistIdx(newIdx);
      setInput(session.history[newIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIdx = Math.max(histIdx - 1, -1);
      setHistIdx(newIdx);
      setInput(newIdx === -1 ? '' : session.history[newIdx] || '');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Simple tab completion for common commands
      const completions = ['ls', 'cd', 'cat', 'docker', 'systemctl', 'journalctl', 'tmux', 'ping', 'sudo', 'help'];
      const match = completions.find(c => c.startsWith(input));
      if (match) setInput(match + ' ');
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      onUpdate(session.id, s => ({ ...s, buffer: [] }));
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      const cancelLine = { kind: 'prompt', ...prompt, cmd: input + '^C' };
      onUpdate(session.id, s => ({ ...s, buffer: [...s.buffer, cancelLine, { kind: 'output', segments: [] }] }));
      setInput('');
    } else if (e.key === 'a' && e.ctrlKey) {
      e.preventDefault();
      if (inputRef.current) { inputRef.current.setSelectionRange(0, 0); }
    } else if (e.key === 'e' && e.ctrlKey) {
      e.preventDefault();
      if (inputRef.current) { const l = input.length; inputRef.current.setSelectionRange(l, l); }
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: '#000000',  // ENCOM: background #000000
        fontFamily: "'FantasqueSansM Nerd Font Mono', 'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        fontSize: '14px',  // Gene's kitty font_size 14.0
        lineHeight: '1.55',
        color: '#00a595',  // ENCOM: foreground #00a595
        overflowY: 'auto',
        padding: '10px 14px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(0,165,149,0.3) transparent',
        cursor: 'text',
      }}
      onClick={focusInput}
    >
      {/* Render buffer */}
      {session.buffer.map((line, i) => {
        if (line.kind === 'output') {
          return <OutputLine key={i} segments={line.segments} />;
        }
        if (line.kind === 'prompt') {
          return <PromptLine key={i} user={line.user} host={line.host} cwd={line.cwd} cmd={line.cmd} />;
        }
        return <div key={i} style={{ minHeight: '1.4em' }} />;
      })}

      {/* Live input line */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', lineHeight: '1.55', minHeight: '1.4em' }}>
        <span style={{ color: '#00ee00', fontWeight: 'bold' }}>{session.user}</span>
        <span style={{ color: '#00a595' }}>@</span>
        <span style={{ color: '#00cdcd', fontWeight: 'bold' }}>{session.host}</span>
        <span style={{ color: '#00a595' }}>:</span>
        <span style={{ color: '#00a595', fontWeight: 'bold' }}>{session.cwd}</span>
        <span style={{ color: session.user === 'root' ? '#ff0000' : '#00a595' }}>
          {session.user === 'root' ? '# ' : '$ '}
        </span>
        <div style={{ position: 'relative', flex: 1, minWidth: '2px' }}>
          <span style={{ color: '#bbbbbb', whiteSpace: 'pre', pointerEvents: 'none', display: 'inline-block', minHeight: '1em' }}>
            {input}
          </span>
          {/* ENCOM cursor color: #bbbbbb */}
          <span style={{
            display: 'inline-block', width: '0.6em', height: '1.1em',
            background: '#bbbbbb',
            verticalAlign: 'text-bottom', marginLeft: '1px',
            animation: 'kitty-blink 1.2s step-end infinite', opacity: 0.9,
          }} />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{
              position: 'absolute', left: 0, top: 0,
              width: '100%', height: '100%',
              background: 'transparent', border: 'none', outline: 'none',
              color: 'transparent', caretColor: 'transparent',
              fontFamily: 'inherit', fontSize: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Scroll anchor */}
      <div ref={endRef} />
    </div>
  );
}

// Kitty cursor blink keyframe — injected once
(function injectKittyCursorStyle() {
  if (document.getElementById('kitty-cursor-style')) return;
  const s = document.createElement('style');
  s.id = 'kitty-cursor-style';
  s.textContent = `
    @keyframes kitty-blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0; }
    }
    .kitty-term { font-feature-settings: "liga" 1, "calt" 1; }
  `;
  document.head.appendChild(s);
})();

// ── Terminal Pane (multi-tab) ─────────────────────────────────────────────────
function TerminalPane({ winId, sessions, activeSess, onTabChange, onAddTab, onCloseTab, onUpdateSession }) {
  const winSessions = sessions.filter(s => s.winId === winId);
  const activeSession = winSessions.find(s => s.id === activeSess) || winSessions[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#000000' }}>
      {/* Tab bar — matches Gene's kitty active_tab_background/foreground from 01-Wallust.conf */}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        background: '#000000',
        borderBottom: '1px solid rgba(0,165,149,0.25)',
        overflow: 'hidden', flexShrink: 0, minHeight: 30,
      }}>
        {winSessions.map((sess, i) => {
          const isActive = sess.id === (activeSession && activeSession.id);
          return (
            <button
              key={sess.id}
              onClick={() => onTabChange(winId, sess.id)}
              style={{
                background: isActive ? '#000000' : 'rgba(0,0,0,0.6)',
                border: 'none',
                borderRight: '1px solid rgba(0,165,149,0.15)',
                borderBottom: isActive ? '2px solid #00a595' : '2px solid transparent',
                color: isActive ? '#00a595' : 'rgba(0,165,149,0.45)',
                fontFamily: "'FantasqueSansM Nerd Font Mono', 'JetBrains Mono', monospace",
                fontSize: '11px',
                padding: '0 14px',
                cursor: 'pointer',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'color 0.15s, background 0.15s',
                minHeight: '100%',
              }}
            >
              <span style={{ color: isActive ? '#00cdcd' : 'rgba(0,165,149,0.4)', fontSize: '10px' }}>{i + 1}</span>
              <span>{sess.host}</span>
              {winSessions.length > 1 && (
                <span
                  onClick={e => { e.stopPropagation(); onCloseTab(winId, sess.id); }}
                  style={{ color: 'rgba(0,165,149,0.4)', fontSize: '10px', marginLeft: 2, padding: '0 2px' }}
                >×</span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => onAddTab(winId)}
          style={{
            background: 'transparent', border: 'none',
            borderRight: '1px solid rgba(0,165,149,0.15)',
            color: 'rgba(0,165,149,0.4)',
            fontFamily: "'FantasqueSansM Nerd Font Mono', monospace",
            fontSize: '16px', padding: '0 12px', cursor: 'pointer', lineHeight: 1,
            transition: 'color 0.15s',
          }}
          title="New tab"
        >+</button>
        <div style={{ flex: 1 }} />
        {activeSession && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px',
            fontSize: '10px', color: 'rgba(0,165,149,0.5)', letterSpacing: '0.5px',
          }}>
            <span style={{ color: '#00a595' }}>●</span>
            <span>ssh {activeSession.user}@{activeSession.host}</span>
          </div>
        )}
      </div>

      {/* Terminal body */}
      {activeSession && (
        <TermSession
          key={activeSession.id}
          session={activeSession}
          onUpdate={onUpdateSession}
        />
      )}
    </div>
  );
}

window.TerminalPane = TerminalPane;
window.createSession = createSession;

const fs = require('fs').promises;
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

function formatUptime(secs) {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function parseCpuLine(line) {
  const parts = line.trim().split(/\s+/);
  const [user, nice, system, idle, iowait, irq, softirq, steal] =
    parts.slice(1).map(Number);
  const total = user + nice + system + idle + iowait + irq + softirq + steal;
  const busy  = user + nice + system + irq + softirq + steal;
  return { total, busy };
}

function parseMemInfo(content) {
  const get = (key) => {
    const m = content.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
    return m ? parseInt(m[1]) * 1024 : 0;
  };
  const total     = get('MemTotal');
  const available = get('MemAvailable');
  return { total, used: total - available };
}

function parseNetDev(content) {
  const lines = content.trim().split('\n').slice(2);
  const result = {};
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const iface = parts[0].replace(':', '');
    result[iface] = { rx: parseInt(parts[1]), tx: parseInt(parts[9]) };
  }
  return result;
}

async function getStats() {
  // Sample 1: CPU + network at t=0
  const [stat1, netDev1] = await Promise.all([
    fs.readFile('/proc/stat', 'utf8'),
    fs.readFile('/proc/net/dev', 'utf8'),
  ]);

  await new Promise(r => setTimeout(r, 500));

  // Sample 2: CPU + network + RAM + disk at t=500ms
  const [stat2, netDev2, memContent, { stdout: dfOut }] = await Promise.all([
    fs.readFile('/proc/stat', 'utf8'),
    fs.readFile('/proc/net/dev', 'utf8'),
    fs.readFile('/proc/meminfo', 'utf8'),
    execAsync('df -B1 / --output=used,size'),
  ]);

  // CPU %
  const cpu1 = parseCpuLine(stat1.split('\n')[0]);
  const cpu2 = parseCpuLine(stat2.split('\n')[0]);
  const cpuPercent = ((cpu2.busy - cpu1.busy) / (cpu2.total - cpu1.total)) * 100;

  // RAM
  const ram = parseMemInfo(memContent);

  // Disk (root filesystem)
  const [usedStr, sizeStr] = dfOut.trim().split('\n')[1].trim().split(/\s+/);
  const disk = { used: parseInt(usedStr), total: parseInt(sizeStr) };

  // Network — sum non-loopback, convert 500ms window → per-second
  const net1 = parseNetDev(netDev1);
  const net2 = parseNetDev(netDev2);
  let rxDelta = 0, txDelta = 0;
  for (const iface of Object.keys(net2)) {
    if (iface === 'lo') continue;
    rxDelta += net2[iface].rx - (net1[iface]?.rx || 0);
    txDelta += net2[iface].tx - (net1[iface]?.tx || 0);
  }

  // Uptime + load — cheap, no /proc parsing required.
  const uptimeSecs = os.uptime();
  const [load1, load5, load15] = os.loadavg();

  return {
    cpu:     { percent: Math.round(cpuPercent * 10) / 10 },
    ram,
    disk,
    network: { rxBytesPerSec: rxDelta * 2, txBytesPerSec: txDelta * 2 },
    uptime:  { seconds: Math.round(uptimeSecs), formatted: formatUptime(uptimeSecs) },
    load:    { one: load1, five: load5, fifteen: load15 },
  };
}

async function getProcesses() {
  const { stdout } = await execAsync(
    "ps aux --sort=-%cpu | head -21 | tail -20 | awk '{print $1,$2,$3,$4,$11}'"
  );
  return stdout.trim().split('\n').map(line => {
    const [user, pid, cpu, mem, cmd] = line.split(' ');
    return { user, pid: parseInt(pid), cpu: parseFloat(cpu), mem: parseFloat(mem), cmd };
  });
}

module.exports = { getStats, getProcesses, parseCpuLine, parseMemInfo, parseNetDev, formatUptime };

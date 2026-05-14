const Dockerode = require('dockerode');
const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

// Flatten a dockerode container summary into the shape the UI expects.
// We expose CPU%/mem/ports/created so DockerManager can render real values
// instead of blanks. CPU is left null in the list-call (computing requires
// a separate one-shot stats sample) and filled in by getContainerStats().
function formatPorts(ports) {
  if (!Array.isArray(ports) || !ports.length) return '';
  return ports
    .filter(p => p.PublicPort)
    .map(p => `${p.PublicPort}:${p.PrivatePort}/${p.Type}`)
    .join(', ');
}

function formatCreated(unixSec) {
  if (!unixSec) return '';
  const ageSec = Math.floor(Date.now() / 1000 - unixSec);
  if (ageSec < 60) return `${ageSec}s ago`;
  if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m ago`;
  if (ageSec < 86400) return `${Math.floor(ageSec / 3600)}h ago`;
  return `${Math.floor(ageSec / 86400)}d ago`;
}

async function getContainers() {
  const containers = await docker.listContainers({ all: true });
  // Best-effort stats sampling. Skipped for stopped containers since
  // dockerode would block. Errors are swallowed per-container.
  const enriched = await Promise.all(containers.map(async c => {
    let cpu = null, mem = null;
    if (c.State === 'running') {
      try {
        const stats = await docker.getContainer(c.Id).stats({ stream: false });
        cpu = computeCpuPct(stats);
        mem = stats.memory_stats && stats.memory_stats.usage
          ? Math.round(stats.memory_stats.usage / (1024 * 1024))
          : null;
      } catch (_) { /* container disappeared mid-call */ }
    }
    return {
      id:      c.Id.slice(0, 12),
      name:    c.Names[0].replace(/^\//, ''),
      image:   c.Image,
      status:  c.Status,
      state:   c.State,
      ports:   formatPorts(c.Ports),
      created: formatCreated(c.Created),
      cpu, mem,
    };
  }));
  return enriched;
}

function computeCpuPct(stats) {
  const cpu = stats.cpu_stats;
  const pre = stats.precpu_stats;
  if (!cpu || !pre) return null;
  const cpuDelta = cpu.cpu_usage.total_usage - pre.cpu_usage.total_usage;
  const sysDelta = cpu.system_cpu_usage - pre.system_cpu_usage;
  const cores    = (cpu.online_cpus || (cpu.cpu_usage.percpu_usage || []).length || 1);
  if (!sysDelta || cpuDelta < 0) return 0;
  return +(100 * (cpuDelta / sysDelta) * cores).toFixed(1);
}

async function startContainer(id) {
  await docker.getContainer(id).start();
}

async function stopContainer(id) {
  await docker.getContainer(id).stop();
}

async function restartContainer(id) {
  await docker.getContainer(id).restart();
}

async function getLogs(id) {
  const buf = await docker.getContainer(id).logs({
    stdout: true, stderr: true, tail: 100,
  });
  return buf.toString('utf8');
}

module.exports = {
  getContainers,
  startContainer,
  stopContainer,
  restartContainer,
  getLogs,
};

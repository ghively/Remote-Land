/* network.js — Read-only network introspection.
   interfaces() lists IP addresses, neighbors() lists ARP/ND cache,
   connections() lists active TCP/UDP sockets. No privileged operations. */

const { execFile } = require('child_process');
const os = require('os');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(new Error((stderr || '').trim() || err.message), { code: err.code }));
      else resolve(stdout);
    });
  });
}

async function interfaces() {
  // Use Node's os.networkInterfaces() as a portable fallback — `ip` may be
  // missing on minimal images.
  const ifaces = os.networkInterfaces();
  return Object.entries(ifaces).map(([name, addrs]) => ({
    name,
    addresses: addrs.map(a => ({
      family: a.family,
      address: a.address,
      cidr: a.cidr,
      mac: a.mac,
      internal: a.internal,
    })),
  }));
}

async function neighbors() {
  // `ip neigh` is read-only and unprivileged on all major distros.
  try {
    const out = await run('ip', ['neigh', 'show']);
    return out.split('\n').filter(Boolean).map(line => {
      // e.g. "192.168.1.1 dev eth0 lladdr 5c:5b:35:11:22:33 REACHABLE"
      const m = line.match(/^(\S+)\s+dev\s+(\S+)(?:.*lladdr\s+(\S+))?.*?(\S+)\s*$/);
      if (!m) return null;
      return {
        ip:    m[1],
        iface: m[2],
        mac:   m[3] || '',
        state: m[4] || '',
      };
    }).filter(Boolean);
  } catch (_) {
    return [];
  }
}

async function connections({ limit = 100 } = {}) {
  // `ss -tunap` requires root for process names; without root we still get
  // sockets but no peer process. Either way the data is informational.
  try {
    const out = await run('ss', ['-tunaH']);
    return out.split('\n').filter(Boolean).slice(0, limit).map(line => {
      const parts = line.split(/\s+/);
      // netid state recv-q send-q local peer
      const [proto, state, recvq, sendq, local, peer] = parts;
      return { proto, state, recvq, sendq, local, peer };
    });
  } catch (_) {
    return [];
  }
}

async function snapshot() {
  const [ifs, neigh, conn] = await Promise.all([
    interfaces(),
    neighbors(),
    connections({ limit: 50 }),
  ]);
  return { interfaces: ifs, neighbors: neigh, connections: conn };
}

module.exports = { interfaces, neighbors, connections, snapshot };

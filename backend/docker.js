const Dockerode = require('dockerode');
const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

async function getContainers() {
  const containers = await docker.listContainers({ all: true });
  return containers.map(c => ({
    id:     c.Id.slice(0, 12),
    name:   c.Names[0].replace(/^\//, ''),
    image:  c.Image,
    status: c.Status,
    state:  c.State,
  }));
}

async function startContainer(id) {
  await docker.getContainer(id).start();
}

async function stopContainer(id) {
  await docker.getContainer(id).stop();
}

async function getLogs(id) {
  const buf = await docker.getContainer(id).logs({
    stdout: true, stderr: true, tail: 100,
  });
  return buf.toString('utf8');
}

module.exports = { getContainers, startContainer, stopContainer, getLogs };

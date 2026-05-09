const WebSocket = require('ws');
const pty = require('node-pty');

function attachTerminal(httpServer, config) {
  const wss = new WebSocket.Server({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (!url.pathname.startsWith('/terminal')) {
      socket.destroy();
      return;
    }
    if (url.searchParams.get('token') !== config.apiKey) {
      wss.handleUpgrade(req, socket, head, (ws) => ws.close(4401, 'Unauthorized'));
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });

  wss.on('connection', (ws) => {
    const shell = config.shell || '/bin/bash';
    let ptyProcess;

    try {
      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || '/',
        env: process.env,
      });
    } catch (err) {
      ws.close(1011, `PTY spawn failed: ${err.message}`);
      return;
    }

    ptyProcess.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(Buffer.from(data));
    });

    ptyProcess.onExit(() => {
      if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'Process exited');
    });

    ws.on('message', (raw) => {
      try {
        const { type, data, cols, rows } = JSON.parse(raw.toString());
        if (type === 'input')  ptyProcess.write(data);
        if (type === 'resize') ptyProcess.resize(Number(cols), Number(rows));
      } catch (_) {}
    });

    ws.on('close', () => { try { ptyProcess.kill(); } catch (_) {} });
  });
}

module.exports = { attachTerminal };

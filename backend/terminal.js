const WebSocket = require('ws');
const pty = require('node-pty');

// Hard kill any PTYs that don't exit cleanly within this window after their
// WebSocket closes. Prevents zombie shells when a client reconnects rapidly
// or a session ends abnormally.
const PTY_TEARDOWN_GRACE_MS = 10_000;

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
    let teardownTimer = null;

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

    let exited = false;
    ptyProcess.onExit(() => {
      exited = true;
      if (teardownTimer) { clearTimeout(teardownTimer); teardownTimer = null; }
      if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'Process exited');
    });

    ws.on('message', (raw) => {
      try {
        const { type, data, cols, rows } = JSON.parse(raw.toString());
        if (type === 'input')  ptyProcess.write(data);
        if (type === 'resize') ptyProcess.resize(Number(cols), Number(rows));
      } catch (_) {}
    });

    ws.on('close', () => {
      // First ask the PTY to exit (SIGHUP). If it's still alive after the
      // grace window, follow up with SIGKILL so we never accumulate
      // zombie shells across rapid reconnect cycles.
      try { ptyProcess.kill(); } catch (_) {}
      teardownTimer = setTimeout(() => {
        if (exited) return;
        try { ptyProcess.kill('SIGKILL'); } catch (_) {}
      }, PTY_TEARDOWN_GRACE_MS);
      // Don't keep the process alive just for this timer.
      if (teardownTimer.unref) teardownTimer.unref();
    });
  });
}

module.exports = { attachTerminal, _internals: { PTY_TEARDOWN_GRACE_MS } };

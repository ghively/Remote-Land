const { EventEmitter } = require('events');

// node-pty mock — must be set up before requiring terminal.js.
const mockPtySpawn = jest.fn();
jest.mock('node-pty', () => ({ spawn: (...args) => mockPtySpawn(...args) }));

// ws mock — gives us a Server with handleUpgrade + emit + a connection event.
class MockWSServer extends EventEmitter {
  constructor() { super(); this.handleUpgrade = jest.fn(); }
}
const wsServerInstances = [];
jest.mock('ws', () => ({
  Server: jest.fn().mockImplementation(() => {
    const s = new MockWSServer();
    wsServerInstances.push(s);
    return s;
  }),
  OPEN: 1,
}));

const ws = require('ws');
const { attachTerminal, _internals } = require('../terminal');

function makePty() {
  const handlers = {};
  return {
    write: jest.fn(),
    resize: jest.fn(),
    kill: jest.fn(),
    onData: (cb) => { handlers.data = cb; },
    onExit: (cb) => { handlers.exit = cb; },
    _fire: (type, ...args) => handlers[type] && handlers[type](...args),
    _handlers: handlers,
  };
}

function makeWs() {
  const sock = new EventEmitter();
  sock.send = jest.fn();
  sock.close = jest.fn();
  sock.readyState = ws.OPEN;
  return sock;
}

function makeHttpServer() {
  const server = new EventEmitter();
  return server;
}

beforeEach(() => { mockPtySpawn.mockReset(); wsServerInstances.length = 0; jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

test('rejects upgrade for paths other than /terminal', () => {
  const http = makeHttpServer();
  attachTerminal(http, { apiKey: 'k' });
  const wss = wsServerInstances[0];
  const sock = { destroy: jest.fn() };
  http.emit('upgrade', { url: '/other?token=k', headers: { host: 'x' } }, sock, Buffer.alloc(0));
  expect(sock.destroy).toHaveBeenCalled();
  expect(wss.handleUpgrade).not.toHaveBeenCalled();
});

test('rejects upgrade when token does not match config.apiKey', () => {
  const http = makeHttpServer();
  attachTerminal(http, { apiKey: 'right' });
  const wss = wsServerInstances[0];
  http.emit('upgrade', { url: '/terminal?token=wrong', headers: { host: 'x' } }, {}, Buffer.alloc(0));
  expect(wss.handleUpgrade).toHaveBeenCalledTimes(1);
  // The callback passed in here closes the socket with 4401.
  const cb = wss.handleUpgrade.mock.calls[0][3];
  const fakeWs = { close: jest.fn() };
  cb(fakeWs);
  expect(fakeWs.close).toHaveBeenCalledWith(4401, 'Unauthorized');
});

test('accepts upgrade when token matches and emits connection', () => {
  const http = makeHttpServer();
  attachTerminal(http, { apiKey: 'k' });
  const wss = wsServerInstances[0];
  http.emit('upgrade', { url: '/terminal?token=k', headers: { host: 'x' } }, {}, Buffer.alloc(0));
  expect(wss.handleUpgrade).toHaveBeenCalledTimes(1);
});

test('spawns a PTY on connection and pipes input/resize messages', () => {
  const http = makeHttpServer();
  attachTerminal(http, { apiKey: 'k', shell: '/bin/zsh' });
  const wss = wsServerInstances[0];
  const ptyProc = makePty();
  mockPtySpawn.mockReturnValue(ptyProc);

  const sock = makeWs();
  wss.emit('connection', sock);

  expect(mockPtySpawn).toHaveBeenCalledWith('/bin/zsh', [], expect.objectContaining({
    name: 'xterm-256color', cols: 80, rows: 24,
  }));

  // input
  sock.emit('message', Buffer.from(JSON.stringify({ type: 'input', data: 'ls\n' })));
  expect(ptyProc.write).toHaveBeenCalledWith('ls\n');

  // resize
  sock.emit('message', Buffer.from(JSON.stringify({ type: 'resize', cols: 120, rows: 40 })));
  expect(ptyProc.resize).toHaveBeenCalledWith(120, 40);
});

test('pipes PTY output back to the WebSocket', () => {
  const http = makeHttpServer();
  attachTerminal(http, { apiKey: 'k' });
  const wss = wsServerInstances[0];
  const ptyProc = makePty();
  mockPtySpawn.mockReturnValue(ptyProc);
  const sock = makeWs();
  wss.emit('connection', sock);

  ptyProc._fire('data', 'hello');
  expect(sock.send).toHaveBeenCalledWith(Buffer.from('hello'));
});

test('PTY exit closes the WebSocket cleanly', () => {
  const http = makeHttpServer();
  attachTerminal(http, { apiKey: 'k' });
  const wss = wsServerInstances[0];
  const ptyProc = makePty();
  mockPtySpawn.mockReturnValue(ptyProc);
  const sock = makeWs();
  wss.emit('connection', sock);

  ptyProc._fire('exit');
  expect(sock.close).toHaveBeenCalledWith(1000, 'Process exited');
});

test('ws close kills the PTY immediately and SIGKILLs after the grace window', () => {
  const http = makeHttpServer();
  attachTerminal(http, { apiKey: 'k' });
  const wss = wsServerInstances[0];
  const ptyProc = makePty();
  mockPtySpawn.mockReturnValue(ptyProc);
  const sock = makeWs();
  wss.emit('connection', sock);

  sock.emit('close');
  expect(ptyProc.kill).toHaveBeenCalledTimes(1); // SIGHUP / default

  // Fast-forward past the teardown grace.
  jest.advanceTimersByTime(_internals.PTY_TEARDOWN_GRACE_MS + 1);
  expect(ptyProc.kill).toHaveBeenCalledTimes(2);
  expect(ptyProc.kill).toHaveBeenLastCalledWith('SIGKILL');
});

test('clean exit before grace window cancels the SIGKILL', () => {
  const http = makeHttpServer();
  attachTerminal(http, { apiKey: 'k' });
  const wss = wsServerInstances[0];
  const ptyProc = makePty();
  mockPtySpawn.mockReturnValue(ptyProc);
  const sock = makeWs();
  wss.emit('connection', sock);

  sock.emit('close');               // schedules the SIGKILL
  ptyProc._fire('exit');            // process exits cleanly before grace
  jest.advanceTimersByTime(_internals.PTY_TEARDOWN_GRACE_MS + 1);

  // Only the initial soft kill — no follow-up SIGKILL.
  expect(ptyProc.kill).toHaveBeenCalledTimes(1);
});

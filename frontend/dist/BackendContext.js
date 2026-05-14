/* BackendContext.jsx — Backend connection state + heartbeat.
   Mounts above WMDesktop / MobileDeck. Panels read connection status
   and the typed api client via useBackend(). When apiKey === '__demo__'
   the provider stays in 'demo' state and skips all network probes.

   Also exports two shared hooks used by every periodic effect in the
   app so all polling pauses together when the tab is hidden:
     usePageVisible()   — subscribes to document.visibilitychange
     usePoller(fn, ms, enabled) — runs fn() now + every `ms` while
       enabled is truthy and the page is visible. Re-runs on re-show
       so the UI feels fresh when you come back to the tab. */
const BackendCtx = React.createContext(null);
function usePageVisible() {
  const [visible, setVisible] = React.useState(typeof document === 'undefined' ? true : !document.hidden);
  React.useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}
function usePoller(fn, ms, enabled = true) {
  const visible = usePageVisible();
  const fnRef = React.useRef(fn);
  React.useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  React.useEffect(() => {
    if (!enabled || !visible || !ms) return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) fnRef.current();
    };
    run();
    const id = setInterval(run, ms);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ms, enabled, visible]);
}
function BackendProvider({
  host,
  apiKey,
  children
}) {
  const api = React.useMemo(() => window.makeApi(host, apiKey), [host, apiKey]);
  const [status, setStatus] = React.useState(apiKey === '__demo__' ? 'demo' : 'connecting');
  const [lastError, setLastError] = React.useState(null);
  const [aiEnabled, setAiEnabled] = React.useState(false);
  const visible = usePageVisible();
  React.useEffect(() => {
    if (apiKey === '__demo__') {
      setStatus('demo');
      setLastError(null);
      setAiEnabled(false);
      return;
    }
    if (!visible) return; // pause heartbeat while tab hidden
    const ctl = new AbortController();
    const tick = async () => {
      try {
        const h = await api.health({
          signal: ctl.signal
        });
        if (ctl.signal.aborted) return;
        setStatus('online');
        setLastError(null);
        setAiEnabled(!!(h && h.ai === 'configured'));
      } catch (err) {
        if (ctl.signal.aborted || err.name === 'AbortError') return;
        setStatus('offline');
        setLastError(err && err.message ? err.message : 'unreachable');
        setAiEnabled(false);
      }
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => {
      ctl.abort();
      clearInterval(iv);
    };
  }, [api, apiKey, visible]);
  const ai = React.useMemo(() => apiKey === '__demo__' || !aiEnabled ? null : window.makeAiClient(host, apiKey), [host, apiKey, aiEnabled]);
  const value = React.useMemo(() => ({
    host,
    apiKey,
    api,
    ai,
    status,
    lastError,
    isDemo: apiKey === '__demo__',
    aiEnabled
  }), [host, apiKey, api, ai, status, lastError, aiEnabled]);
  return /*#__PURE__*/React.createElement(BackendCtx.Provider, {
    value: value
  }, children);
}
function useBackend() {
  const ctx = React.useContext(BackendCtx);
  if (!ctx) {
    return {
      host: 'nas.local',
      apiKey: '__demo__',
      api: null,
      ai: null,
      status: 'demo',
      lastError: null,
      isDemo: true,
      aiEnabled: false
    };
  }
  return ctx;
}
window.BackendProvider = BackendProvider;
window.useBackend = useBackend;
window.usePageVisible = usePageVisible;
window.usePoller = usePoller;
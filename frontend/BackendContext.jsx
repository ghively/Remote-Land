/* BackendContext.jsx — Backend connection state + heartbeat.
   Mounts above WMDesktop / MobileDeck. Panels read connection status
   and the typed api client via useBackend(). When apiKey === '__demo__'
   the provider stays in 'demo' state and skips all network probes. */
const BackendCtx = React.createContext(null);

function BackendProvider({ host, apiKey, children }) {
  const api = React.useMemo(
    () => window.makeApi(host, apiKey),
    [host, apiKey]
  );
  const [status, setStatus]       = React.useState(apiKey === '__demo__' ? 'demo' : 'connecting');
  const [lastError, setLastError] = React.useState(null);

  React.useEffect(() => {
    if (apiKey === '__demo__') { setStatus('demo'); setLastError(null); return; }
    let alive = true;
    const tick = async () => {
      try {
        await api.health();
        if (alive) { setStatus('online'); setLastError(null); }
      } catch (err) {
        if (alive) { setStatus('offline'); setLastError(err.message); }
      }
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, [api, apiKey]);

  const value = React.useMemo(
    () => ({ host, apiKey, api, status, lastError, isDemo: apiKey === '__demo__' }),
    [host, apiKey, api, status, lastError]
  );

  return <BackendCtx.Provider value={value}>{children}</BackendCtx.Provider>;
}

function useBackend() {
  const ctx = React.useContext(BackendCtx);
  if (!ctx) {
    return {
      host: 'nas.local', apiKey: '__demo__', api: null,
      status: 'demo', lastError: null, isDemo: true,
    };
  }
  return ctx;
}

window.BackendProvider = BackendProvider;
window.useBackend      = useBackend;

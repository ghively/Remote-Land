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
  const [aiEnabled, setAiEnabled] = React.useState(false);

  React.useEffect(() => {
    if (apiKey === '__demo__') {
      setStatus('demo');
      setLastError(null);
      setAiEnabled(false);
      return;
    }
    let alive = true;
    const tick = async () => {
      try {
        const h = await api.health();
        if (alive) {
          setStatus('online');
          setLastError(null);
          setAiEnabled(!!(h && h.ai === 'configured'));
        }
      } catch (err) {
        if (alive) { setStatus('offline'); setLastError(err.message); setAiEnabled(false); }
      }
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, [api, apiKey]);

  const ai = React.useMemo(
    () => (apiKey === '__demo__' || !aiEnabled ? null : window.makeAiClient(host, apiKey)),
    [host, apiKey, aiEnabled]
  );

  const value = React.useMemo(
    () => ({ host, apiKey, api, ai, status, lastError, isDemo: apiKey === '__demo__', aiEnabled }),
    [host, apiKey, api, ai, status, lastError, aiEnabled]
  );

  return <BackendCtx.Provider value={value}>{children}</BackendCtx.Provider>;
}

function useBackend() {
  const ctx = React.useContext(BackendCtx);
  if (!ctx) {
    return {
      host: 'nas.local', apiKey: '__demo__', api: null, ai: null,
      status: 'demo', lastError: null, isDemo: true, aiEnabled: false,
    };
  }
  return ctx;
}

window.BackendProvider = BackendProvider;
window.useBackend      = useBackend;

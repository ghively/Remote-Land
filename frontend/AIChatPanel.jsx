/* AIChatPanel.jsx — Streaming AI chat. Uses BackendContext.ai. */
function AIChatPanel() {
  const { ai, isDemo, aiEnabled } = useBackend();
  const [messages, setMessages]   = useState([]);   // [{role, content, usage?, error?}]
  const [input, setInput]         = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(null);
  const listRef  = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  if (isDemo || !aiEnabled || !ai) {
    return (
      <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: '0.85rem',
                    display: 'flex', flexDirection: 'column', gap: 12,
                    alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--neon-cyan)', letterSpacing: 2, textShadow: 'var(--bloom-cyan)' }}>
          [ AI REQUIRES BACKEND ]
        </div>
        <div style={{ textAlign: 'center', lineHeight: 1.7 }}>
          {isDemo
            ? <>&gt; Demo mode — log in with a real API key to enable AI.</>
            : <>&gt; Set <code style={{ color: 'var(--neon-green)' }}>ai.apiKey</code> or <code style={{ color: 'var(--neon-green)' }}>ai.baseUrl</code> in <code style={{ color: 'var(--neon-green)' }}>backend/config.json</code>.</>}
        </div>
      </div>
    );
  }

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const next = [
      ...messages,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ];
    setMessages(next);
    setInput('');
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      // Chat history sent upstream excludes the empty placeholder we appended.
      for await (const ev of ai.chat(next.slice(0, -1), ctrl.signal)) {
        if (ev.delta) {
          setMessages(m => {
            const last = m[m.length - 1];
            return [...m.slice(0, -1), { ...last, content: last.content + ev.delta }];
          });
        } else if (ev.error) {
          setMessages(m => {
            const last = m[m.length - 1];
            return [...m.slice(0, -1), { ...last, content: last.content + `\n[error: ${ev.error}]`, error: true }];
          });
        } else if (ev.done && ev.usage) {
          setMessages(m => {
            const last = m[m.length - 1];
            return [...m.slice(0, -1), { ...last, usage: ev.usage }];
          });
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(m => {
          const last = m[m.length - 1];
          return [...m.slice(0, -1), { ...last, content: last.content + `\n[error: ${err.message}]`, error: true }];
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop  = () => { if (abortRef.current) abortRef.current.abort(); };
  const clear = () => { stop(); setMessages([]); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 6, padding: '6px 10px',
                    borderBottom: '1px solid rgba(0,255,0,0.1)',
                    background: 'rgba(0,0,0,0.5)', flexShrink: 0, alignItems: 'center' }}>
        <span style={{ color: 'var(--neon-cyan)', fontSize: '0.75rem', letterSpacing: 2,
                       textShadow: 'var(--bloom-cyan)' }}>[AI_CHAT]</span>
        <span style={{ flex: 1 }} />
        <button className="cmd-btn-sm" onClick={stop} disabled={!streaming}>[STOP]</button>
        <button className="cmd-btn-sm" onClick={clear} disabled={messages.length === 0}>[CLEAR]</button>
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12,
                                  display: 'flex', flexDirection: 'column', gap: 14,
                                  fontSize: '0.85rem', lineHeight: 1.6,
                                  scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,255,0,0.3) transparent' }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>
            &gt; Ask anything about the server.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: '0.7rem', letterSpacing: 2,
                          color: m.role === 'user' ? 'var(--neon-purple)' : 'var(--neon-green)' }}>
              {m.role === 'user' ? '> USER' : '> ASSISTANT'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap',
                          color: m.error ? '#ff5f56' : 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)' }}>
              {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
            </div>
            {m.usage && (
              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                in: {m.usage.prompt_tokens != null ? m.usage.prompt_tokens : '?'}
                {'  '}out: {m.usage.completion_tokens != null ? m.usage.completion_tokens : '?'}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, padding: 8,
                    borderTop: '1px solid rgba(0,255,0,0.1)', flexShrink: 0 }}>
        <input className="logview-filter" style={{ flex: 1 }}
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="$ ask..." disabled={streaming} autoFocus />
        <button className="cmd-btn" onClick={send} disabled={streaming || !input.trim()}>
          {streaming ? '[ ... ]' : '[ SEND ]'}
        </button>
      </div>
    </div>
  );
}

window.AIChatPanel = AIChatPanel;

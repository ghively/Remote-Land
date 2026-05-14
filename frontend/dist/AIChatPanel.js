/* AIChatPanel.jsx — Streaming AI chat. Uses BackendContext.ai. */
function AIChatPanel() {
  const {
    ai,
    isDemo,
    aiEnabled
  } = useBackend();
  // messages: [{role:'user'|'assistant', content, usage?, error?}]
  // toolEvents: chronological [{kind:'start'|'result', id, name, ok?, args?}]
  const [messages, setMessages] = useState([]);
  const [toolEvents, setToolEvents] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [includeContext, setIncludeContext] = useState(true);
  const [useTools, setUseTools] = useState(true);
  const abortRef = useRef(null);
  const listRef = useRef(null);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);
  if (isDemo || !aiEnabled || !ai) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 24,
        color: 'var(--text-dim)',
        fontSize: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--neon-cyan)',
        letterSpacing: 2,
        textShadow: 'var(--bloom-cyan)'
      }
    }, "[ AI REQUIRES BACKEND ]"), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'center',
        lineHeight: 1.7
      }
    }, isDemo ? /*#__PURE__*/React.createElement(React.Fragment, null, "> Demo mode \u2014 log in with a real API key to enable AI.") : /*#__PURE__*/React.createElement(React.Fragment, null, "> Set ", /*#__PURE__*/React.createElement("code", {
      style: {
        color: 'var(--neon-green)'
      }
    }, "ai.apiKey"), " or ", /*#__PURE__*/React.createElement("code", {
      style: {
        color: 'var(--neon-green)'
      }
    }, "ai.baseUrl"), " in ", /*#__PURE__*/React.createElement("code", {
      style: {
        color: 'var(--neon-green)'
      }
    }, "backend/config.json"), ".")));
  }
  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const next = [...messages, {
      role: 'user',
      content: text
    }, {
      role: 'assistant',
      content: ''
    }];
    setMessages(next);
    setInput('');
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      // Chat history sent upstream excludes the empty placeholder we appended.
      for await (const ev of ai.chat(next.slice(0, -1), ctrl.signal, {
        includeContext,
        useTools
      })) {
        if (ev.delta) {
          setMessages(m => {
            const last = m[m.length - 1];
            return [...m.slice(0, -1), {
              ...last,
              content: last.content + ev.delta
            }];
          });
        } else if (ev.tool_call_start) {
          setToolEvents(t => [...t, {
            kind: 'start',
            id: ev.tool_call_start.id,
            name: ev.tool_call_start.name,
            args: ev.tool_call_start.arguments
          }]);
        } else if (ev.tool_call_result) {
          setToolEvents(t => [...t, {
            kind: 'result',
            id: ev.tool_call_result.id,
            name: ev.tool_call_result.name,
            ok: ev.tool_call_result.ok
          }]);
        } else if (ev.error) {
          setMessages(m => {
            const last = m[m.length - 1];
            return [...m.slice(0, -1), {
              ...last,
              content: last.content + `\n[error: ${ev.error}]`,
              error: true
            }];
          });
        } else if (ev.done && ev.usage) {
          setMessages(m => {
            const last = m[m.length - 1];
            return [...m.slice(0, -1), {
              ...last,
              usage: ev.usage
            }];
          });
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(m => {
          const last = m[m.length - 1];
          return [...m.slice(0, -1), {
            ...last,
            content: last.content + `\n[error: ${err.message}]`,
            error: true
          }];
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };
  const stop = () => {
    if (abortRef.current) abortRef.current.abort();
  };
  const clear = () => {
    stop();
    setMessages([]);
    setToolEvents([]);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      padding: '6px 10px',
      borderBottom: '1px solid rgba(0,255,0,0.1)',
      background: 'rgba(0,0,0,0.5)',
      flexShrink: 0,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--neon-cyan)',
      fontSize: '0.75rem',
      letterSpacing: 2,
      textShadow: 'var(--bloom-cyan)'
    }
  }, "[AI_CHAT]"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: `cmd-btn-sm${includeContext ? ' cyan' : ''}`,
    title: "Include a live system snapshot (CPU/RAM/disk/containers) with each message",
    onClick: () => setIncludeContext(v => !v)
  }, includeContext ? '[CTX:ON]' : '[CTX:OFF]'), /*#__PURE__*/React.createElement("button", {
    className: `cmd-btn-sm${useTools ? ' cyan' : ''}`,
    title: "Allow the model to call read-only tools (system stats, container list, logs, media status)",
    onClick: () => setUseTools(v => !v)
  }, useTools ? '[TOOLS:ON]' : '[TOOLS:OFF]'), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm",
    onClick: stop,
    disabled: !streaming
  }, "[STOP]"), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn-sm",
    onClick: clear,
    disabled: messages.length === 0
  }, "[CLEAR]")), /*#__PURE__*/React.createElement("div", {
    ref: listRef,
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      fontSize: '0.85rem',
      lineHeight: 1.6,
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, messages.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-dim)',
      textAlign: 'center',
      padding: 20
    }
  }, "> Ask anything about the server."), messages.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.7rem',
      letterSpacing: 2,
      color: m.role === 'user' ? 'var(--neon-purple)' : 'var(--neon-green)'
    }
  }, m.role === 'user' ? '> USER' : '> ASSISTANT'), /*#__PURE__*/React.createElement("div", {
    style: {
      whiteSpace: 'pre-wrap',
      color: m.error ? 'var(--color-error)' : 'var(--text-primary)',
      fontFamily: 'var(--font-mono)'
    }
  }, m.content || (streaming && i === messages.length - 1 ? '…' : '')), m.usage && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.65rem',
      color: 'var(--text-dim)'
    }
  }, "in: ", m.usage.prompt_tokens != null ? m.usage.prompt_tokens : '?', '  ', "out: ", m.usage.completion_tokens != null ? m.usage.completion_tokens : '?')))), toolEvents.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid rgba(0,255,0,0.1)',
      padding: '6px 10px',
      background: 'rgba(0,0,0,0.4)',
      maxHeight: 96,
      overflowY: 'auto',
      fontSize: '0.7rem',
      fontFamily: 'var(--font-mono)',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,0,0.3) transparent'
    }
  }, toolEvents.slice(-8).map((ev, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: ev.kind === 'start' ? 'var(--neon-cyan)' : ev.ok === false ? 'var(--color-error)' : 'var(--neon-green)',
      letterSpacing: 1
    }
  }, ev.kind === 'start' ? '→ tool' : ev.ok === false ? '✗ tool' : '← tool'), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-primary)'
    }
  }, ev.name), ev.kind === 'start' && ev.args && ev.args !== '{}' && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-dim)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flex: 1
    }
  }, ev.args)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      padding: 8,
      borderTop: '1px solid rgba(0,255,0,0.1)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "logview-filter",
    style: {
      flex: 1
    },
    value: input,
    onChange: e => setInput(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    placeholder: "$ ask...",
    disabled: streaming,
    autoFocus: true
  }), /*#__PURE__*/React.createElement("button", {
    className: "cmd-btn",
    onClick: send,
    disabled: streaming || !input.trim()
  }, streaming ? '[ ... ]' : '[ SEND ]')));
}
window.AIChatPanel = AIChatPanel;
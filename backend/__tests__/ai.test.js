jest.mock('axios');
jest.mock('../system', () => ({
  getStats:     jest.fn(),
  getProcesses: jest.fn(),
}));
jest.mock('../docker', () => ({
  getContainers:  jest.fn(),
  startContainer: jest.fn(),
  stopContainer:  jest.fn(),
  getLogs:        jest.fn(),
}));
jest.mock('../media', () => ({
  getEmbyData:   jest.fn(),
  getRadarrData: jest.fn(),
  getSonarrData: jest.fn(),
}));
const axios   = require('axios');
const system  = require('../system');
const docker  = require('../docker');
const media   = require('../media');
const ai = require('../ai');

// Helper: build a fake fetch Response with a streamable body.
function fakeStreamResponse(chunks, opts = {}) {
  const encoder = new TextEncoder();
  let i = 0;
  const reader = {
    read: async () => {
      if (i >= chunks.length) return { value: undefined, done: true };
      return { value: encoder.encode(chunks[i++]), done: false };
    },
  };
  return {
    ok: opts.ok !== false,
    status: opts.status || 200,
    body: { getReader: () => reader },
    text: async () => chunks.join(''),
  };
}

const KEYED = { ai: { apiKey: 'k' } };

describe('streamChat', () => {
  afterEach(() => { delete global.fetch; });

  test('parses upstream SSE chunks into envelope events', async () => {
    global.fetch = jest.fn().mockResolvedValue(fakeStreamResponse([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":10,"completion_tokens":2}}\n\n',
      'data: [DONE]\n\n',
    ]));

    const events = [];
    for await (const ev of ai.streamChat(KEYED, [{ role: 'user', content: 'hi' }])) {
      events.push(ev);
    }

    expect(events).toEqual([
      { delta: 'Hello' },
      { delta: ' world' },
      { done: true, usage: { prompt_tokens: 10, completion_tokens: 2 } },
    ]);
  });

  test('throws on upstream HTTP error', async () => {
    global.fetch = jest.fn().mockResolvedValue(fakeStreamResponse(['oops'], { ok: false, status: 500 }));
    const gen = ai.streamChat(KEYED, [{ role: 'user', content: 'hi' }]);
    await expect(gen.next()).rejects.toThrow(/HTTP 500/);
  });

  test('handles deltas split across read chunks', async () => {
    global.fetch = jest.fn().mockResolvedValue(fakeStreamResponse([
      'data: {"choices":[{"delta":{"content":"He',
      'llo"}}]}\n\ndata: [DONE]\n\n',
    ]));
    const events = [];
    for await (const ev of ai.streamChat(KEYED, [{ role: 'user', content: 'hi' }])) {
      events.push(ev);
    }
    expect(events).toEqual([{ delta: 'Hello' }, { done: true, usage: null }]);
  });

  test('sends Bearer token when apiKey present', async () => {
    let capturedHeaders;
    global.fetch = jest.fn().mockImplementation((_url, init) => {
      capturedHeaders = init.headers;
      return Promise.resolve(fakeStreamResponse(['data: [DONE]\n\n']));
    });
    // eslint-disable-next-line no-empty
    for await (const _ of ai.streamChat(KEYED, [{ role: 'user', content: 'hi' }])) {}
    expect(capturedHeaders.authorization).toBe('Bearer k');
  });

  test('omits authorization header when apiKey blank (local server)', async () => {
    let capturedHeaders;
    global.fetch = jest.fn().mockImplementation((_url, init) => {
      capturedHeaders = init.headers;
      return Promise.resolve(fakeStreamResponse(['data: [DONE]\n\n']));
    });
    const cfg = { ai: { baseUrl: 'http://localhost:11434/v1' } };
    // eslint-disable-next-line no-empty
    for await (const _ of ai.streamChat(cfg, [{ role: 'user', content: 'hi' }])) {}
    expect(capturedHeaders.authorization).toBeUndefined();
  });
});

describe('streamLogAnalysis', () => {
  afterEach(() => { delete global.fetch; });

  test('truncates input to 50KB before sending', async () => {
    let captured;
    global.fetch = jest.fn().mockImplementation((_url, init) => {
      captured = JSON.parse(init.body);
      return Promise.resolve(fakeStreamResponse(['data: [DONE]\n\n']));
    });
    const huge = Array.from({ length: 60_000 }, (_, i) => `line${i}`); // ~600KB joined
    // eslint-disable-next-line no-empty
    for await (const _ of ai.streamLogAnalysis(KEYED, huge)) {}

    const userMsg = captured.messages.find(m => m.role === 'user').content;
    expect(userMsg.length).toBeLessThanOrEqual(50_000);
  });
});

describe('suggestShell', () => {
  afterEach(() => jest.clearAllMocks());

  function mockReply(text) {
    axios.post.mockResolvedValue({
      data: { choices: [{ message: { content: text } }] },
    });
  }

  test('parses a clean json_schema reply', async () => {
    mockReply('{"command":"ls","explanation":"List","danger":"safe"}');
    const out = await ai.suggestShell(KEYED, 'list files');
    expect(out).toEqual({ command: 'ls', explanation: 'List', danger: 'safe' });
  });

  test('falls back to scraping JSON from prose', async () => {
    mockReply('Sure! Here is the command: {"command":"ls","explanation":"List","danger":"safe"} as requested.');
    const out = await ai.suggestShell(KEYED, 'list files');
    expect(out.command).toBe('ls');
  });

  test('rejects malformed output (bad enum)', async () => {
    mockReply('{"command":"ls","explanation":"x","danger":"sketchy"}');
    await expect(ai.suggestShell(KEYED, 'list')).rejects.toThrow(/malformed/);
  });

  test('rejects malformed output (missing field)', async () => {
    mockReply('{"command":"ls","danger":"safe"}');
    await expect(ai.suggestShell(KEYED, 'list')).rejects.toThrow(/malformed/);
  });

  test('rejects when no JSON is present', async () => {
    mockReply('I refuse.');
    await expect(ai.suggestShell(KEYED, 'rm -rf /')).rejects.toThrow(/no JSON/);
  });

  test('uses configured shellModel + temperature 0', async () => {
    mockReply('{"command":"ls","explanation":"x","danger":"safe"}');
    const cfg = { ai: { apiKey: 'k', shellModel: 'mistral-7b' } };
    await ai.suggestShell(cfg, 'list');
    const callArgs = axios.post.mock.calls[0];
    expect(callArgs[1].model).toBe('mistral-7b');
    expect(callArgs[1].temperature).toBe(0);
    expect(callArgs[1].response_format.type).toBe('json_schema');
  });
});

describe('streamChat with live context', () => {
  afterEach(() => { delete global.fetch; jest.clearAllMocks(); });

  test('includes a <live-snapshot> system message when opts.includeContext', async () => {
    system.getStats.mockResolvedValue({
      cpu: { percent: 13.4 },
      ram: { used: 4e9, total: 16e9 },
      disk: { used: 200e9, total: 1000e9 },
      network: { rxBytesPerSec: 1024, txBytesPerSec: 2048 },
      uptime: { seconds: 86400, formatted: '1d 0h' },
      load: { one: 0.5, five: 0.4, fifteen: 0.3 },
    });
    docker.getContainers.mockResolvedValue([
      { id: 'a', name: 'emby',   image: 'e/e:latest', state: 'running', status: 'Up 2d' },
      { id: 'b', name: 'radarr', image: 'l/r:latest', state: 'running', status: 'Up 5d' },
    ]);

    let captured;
    global.fetch = jest.fn().mockImplementation((_url, init) => {
      captured = JSON.parse(init.body);
      return Promise.resolve(fakeStreamResponse(['data: [DONE]\n\n']));
    });

    // eslint-disable-next-line no-empty
    for await (const _ of ai.streamChat(KEYED, [{ role: 'user', content: 'hi' }], { includeContext: true })) {}

    const sysMsgs = captured.messages.filter(m => m.role === 'system');
    expect(sysMsgs.length).toBe(2);
    expect(sysMsgs[1].content).toMatch(/<live-snapshot>/);
    expect(sysMsgs[1].content).toMatch(/CPU:\s+13\.4%/);
    expect(sysMsgs[1].content).toMatch(/emby \[running\]/);
    expect(sysMsgs[1].content).toMatch(/radarr \[running\]/);
  });

  test('omits snapshot block when opts.includeContext is false', async () => {
    let captured;
    global.fetch = jest.fn().mockImplementation((_url, init) => {
      captured = JSON.parse(init.body);
      return Promise.resolve(fakeStreamResponse(['data: [DONE]\n\n']));
    });

    // eslint-disable-next-line no-empty
    for await (const _ of ai.streamChat(KEYED, [{ role: 'user', content: 'hi' }], { includeContext: false })) {}

    expect(system.getStats).not.toHaveBeenCalled();
    expect(captured.messages.filter(m => m.role === 'system').length).toBe(1);
  });

  test('degrades silently when snapshot collection fails', async () => {
    system.getStats.mockRejectedValue(new Error('proc unreadable'));
    docker.getContainers.mockRejectedValue(new Error('socket missing'));

    let captured;
    global.fetch = jest.fn().mockImplementation((_url, init) => {
      captured = JSON.parse(init.body);
      return Promise.resolve(fakeStreamResponse(['data: [DONE]\n\n']));
    });

    // eslint-disable-next-line no-empty
    for await (const _ of ai.streamChat(KEYED, [{ role: 'user', content: 'hi' }], { includeContext: true })) {}

    // Only the static SYSTEM_CHAT message — no snapshot block on failure.
    expect(captured.messages.filter(m => m.role === 'system').length).toBe(1);
  });
});

describe('streamChat tool calling', () => {
  afterEach(() => { delete global.fetch; jest.clearAllMocks(); });

  // Builds a fake fetch that returns a fresh stream on each call. `pages`
  // is an array of arrays-of-SSE-chunks — one page per HTTP request.
  function fakeMultiPageFetch(pages) {
    let i = 0;
    return jest.fn().mockImplementation(() => {
      const chunks = pages[i++] || ['data: [DONE]\n\n'];
      return Promise.resolve(fakeStreamResponse(chunks));
    });
  }

  test('executes tool then continues with the model response', async () => {
    docker.getContainers.mockResolvedValue([
      { id: 'a1', name: 'emby',   image: 'e/e:1', state: 'running', status: 'Up 2d' },
      { id: 'b2', name: 'radarr', image: 'l/r:1', state: 'running', status: 'Up 5d' },
    ]);

    global.fetch = fakeMultiPageFetch([
      // Pass 1: model emits a tool_calls request and stops.
      [
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"listContainers","arguments":""}}]}}]}\n\n',
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{}"}}]}}]}\n\n',
        'data: {"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n',
        'data: [DONE]\n\n',
      ],
      // Pass 2: model uses the tool result to write a normal text reply.
      [
        'data: {"choices":[{"index":0,"delta":{"content":"You have 2 containers."}}]}\n\n',
        'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ],
    ]);

    const events = [];
    for await (const ev of ai.streamChat(KEYED, [{ role: 'user', content: 'how many containers?' }], { useTools: true })) {
      events.push(ev);
    }

    // Sequence: tool_call_start → tool_call_result → delta(s) → done
    expect(events[0]).toEqual({ tool_call_start: { id: 'call_1', name: 'listContainers', arguments: '{}' } });
    expect(events[1]).toEqual({ tool_call_result: { id: 'call_1', name: 'listContainers', ok: true } });
    expect(events.find(e => e.delta)).toEqual({ delta: 'You have 2 containers.' });
    expect(events[events.length - 1]).toEqual({ done: true, usage: null });

    // listContainers actually ran.
    expect(docker.getContainers).toHaveBeenCalled();

    // Second request body must include the assistant tool_calls + tool result message.
    const secondBody = JSON.parse(global.fetch.mock.calls[1][1].body);
    const assistantTurn = secondBody.messages[secondBody.messages.length - 2];
    const toolTurn      = secondBody.messages[secondBody.messages.length - 1];
    expect(assistantTurn.role).toBe('assistant');
    expect(assistantTurn.tool_calls[0].id).toBe('call_1');
    expect(assistantTurn.tool_calls[0].function.name).toBe('listContainers');
    expect(toolTurn.role).toBe('tool');
    expect(toolTurn.tool_call_id).toBe('call_1');
    expect(toolTurn.content).toMatch(/emby/);
  });

  test('reports tool errors via tool_call_result ok:false and lets the model recover', async () => {
    docker.getContainers.mockResolvedValue([
      { id: 'a1', name: 'emby', image: 'e/e:1', state: 'running', status: 'Up 2d' },
    ]);

    global.fetch = fakeMultiPageFetch([
      [
        'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_2","type":"function","function":{"name":"containerLogs","arguments":"{\\"nameOrId\\":\\"nope\\"}"}}]}}]}\n\n',
        'data: {"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n',
        'data: [DONE]\n\n',
      ],
      [
        'data: {"choices":[{"index":0,"delta":{"content":"That container does not exist."}}]}\n\n',
        'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ],
    ]);

    const events = [];
    for await (const ev of ai.streamChat(KEYED, [{ role: 'user', content: 'show logs for nope' }], { useTools: true })) {
      events.push(ev);
    }

    const result = events.find(e => e.tool_call_result);
    expect(result.tool_call_result.ok).toBe(false);
    expect(events.find(e => e.delta && /does not exist/.test(e.delta))).toBeTruthy();
  });

  test('caps the tool-call loop and surfaces an error event', async () => {
    docker.getContainers.mockResolvedValue([]);
    // Every page asks for the same tool call again — trips the cap.
    const loopPage = [
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_x","type":"function","function":{"name":"listContainers","arguments":"{}"}}]}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n',
      'data: [DONE]\n\n',
    ];
    global.fetch = fakeMultiPageFetch([loopPage, loopPage, loopPage]);

    const events = [];
    for await (const ev of ai.streamChat(KEYED, [{ role: 'user', content: 'hi' }], {
      useTools: true, includeContext: false, maxIterations: 3,
    })) {
      events.push(ev);
    }

    expect(events.find(e => e.error && /loop exceeded/.test(e.error))).toBeTruthy();
    expect(events[events.length - 1]).toEqual({ done: true, usage: null });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

describe('executeTool', () => {
  afterEach(() => jest.clearAllMocks());

  test('containerLogs maps a container name to its id', async () => {
    docker.getContainers.mockResolvedValue([
      { id: 'abc123def456', name: 'emby', image: 'e/e:1', state: 'running', status: 'Up 2d' },
    ]);
    docker.getLogs.mockResolvedValue('line1\nline2\nline3\n');
    const out = await ai._internals.executeTool('containerLogs', { nameOrId: 'emby' }, KEYED);
    expect(docker.getLogs).toHaveBeenCalledWith('abc123def456');
    expect(out.name).toBe('emby');
    expect(out.logs).toMatch(/line2/);
  });

  test('mediaStatus dispatches by service', async () => {
    media.getEmbyData.mockResolvedValue({ activeSessions: 1 });
    const out = await ai._internals.executeTool('mediaStatus', { service: 'emby' }, KEYED);
    expect(out).toEqual({ activeSessions: 1 });
  });

  test('rejects unknown tool', async () => {
    await expect(ai._internals.executeTool('nope', {}, KEYED)).rejects.toThrow(/unknown tool/);
  });
});

describe('isConfigured', () => {
  test.each([
    [{}, false],
    [{ ai: {} }, false],
    [{ ai: { apiKey: 'x' } }, true],
    [{ ai: { baseUrl: 'http://localhost:11434/v1' } }, true],
    [{ ai: { apiKey: '', baseUrl: '' } }, false],
  ])('isConfigured(%j) === %s', (cfg, expected) => {
    expect(ai.isConfigured(cfg)).toBe(expected);
  });
});

describe('endpoint helper', () => {
  test('strips trailing slashes and appends /chat/completions', () => {
    expect(ai._internals.endpoint({ ai: { baseUrl: 'http://x/v1/' } })).toBe('http://x/v1/chat/completions');
    expect(ai._internals.endpoint({ ai: { baseUrl: 'http://x/v1' } })).toBe('http://x/v1/chat/completions');
    expect(ai._internals.endpoint({ ai: {} })).toBe('https://api.openai.com/v1/chat/completions');
  });
});

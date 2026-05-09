jest.mock('axios');
const axios = require('axios');
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

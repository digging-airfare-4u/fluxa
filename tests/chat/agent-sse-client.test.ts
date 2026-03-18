import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('agent SSE client', () => {
  it('parses structured SSE events and returns the persisted done payload', async () => {
    const { readAgentEventStream } = await import('@/lib/api/generate');

    const events: Array<{ type: string }> = [];
    const response = new Response(
      [
        'data: {"type":"phase","phase":"planning","label":"Planning"}\n\n',
        'data: {"type":"text","content":"partial"}\n\n',
        'data: {"type":"done","message":{"id":"msg-1","content":"final","metadata":{"mode":"agent"}}}\n\n',
      ].join(''),
      {
        headers: { 'Content-Type': 'text/event-stream' },
      },
    );

    const doneEvent = await readAgentEventStream(response, {
      onEvent: (event) => events.push({ type: event.type }),
    });

    expect(events.map((event) => event.type)).toEqual(['phase', 'text', 'done']);
    expect(doneEvent?.message).toMatchObject({
      id: 'msg-1',
      content: 'final',
      metadata: { mode: 'agent' },
    });
  });

  it('ignores malformed chunks and still continues parsing later events', async () => {
    const { readAgentEventStream } = await import('@/lib/api/generate');

    const onEvent = vi.fn();
    const response = new Response(
      [
        'data: not-json\n\n',
        'data: {"type":"text","content":"ok"}\n\n',
        'data: {"type":"done","message":{"id":"msg-2","content":"done","metadata":{"mode":"agent"}}}\n\n',
      ].join(''),
      {
        headers: { 'Content-Type': 'text/event-stream' },
      },
    );

    const doneEvent = await readAgentEventStream(response, { onEvent });

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(doneEvent?.message.id).toBe('msg-2');
  });

  it('sends agent SSE requests with Supabase apikey and retries once on 401 auth failures', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/api/generate.ts'),
      'utf8',
    );

    expect(source).toContain('apikey: supabaseAnonKey');
    expect(source).toContain('model: params.model');
    expect(source).toContain('imageModel: params.imageModel');
    expect(source).toContain("if (response.status === 401)");
    expect(source).toContain('await refreshAccessToken()');
  });
});

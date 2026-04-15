import { describe, expect, it } from 'vitest';
import {
  buildProgressiveTextFrames,
  emitGraphemeDeltas,
  splitIntoGraphemes,
} from '../../supabase/functions/_shared/utils/agent-orchestrator';

describe('agent orchestrator streaming', () => {
  it('builds cumulative text frames for progressive agent output', () => {
    const frames = buildProgressiveTextFrames('第一句总结。第二句补充。第三句收束。');

    expect(frames.length).toBeGreaterThan(1);
    expect(frames.at(-1)).toBe('第一句总结。第二句补充。第三句收束。');
    expect(frames[0].length).toBeLessThan(frames.at(-1)!.length);
    expect(
      frames.every((frame, index) => (
        index === 0 || frame.startsWith(frames[index - 1]!)
      )),
    ).toBe(true);
  });

  it('keeps combined emoji and CJK text intact when splitting graphemes', () => {
    expect(splitIntoGraphemes('A👨‍👩‍👧‍👦好')).toEqual(['A', '👨‍👩‍👧‍👦', '好']);
  });

  it('emits grapheme-sized deltas in order', async () => {
    const deltas: string[] = [];

    await emitGraphemeDeltas('你好👋', (delta) => {
      deltas.push(delta);
    }, 0);

    expect(deltas).toEqual(['你', '好', '👋']);
  });
});

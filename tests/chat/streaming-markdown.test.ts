import { describe, expect, it } from 'vitest';
import { splitStableMarkdown } from '../../src/components/chat/streaming-markdown';

describe('streaming markdown split', () => {
  it('keeps completed markdown blocks stable and leaves the active tail raw', () => {
    const content = '# 标题\n\n第一段已经完成。\n\n第二段还在';

    expect(splitStableMarkdown(content)).toEqual({
      stable: '# 标题\n\n第一段已经完成。\n\n',
      tail: '第二段还在',
    });
  });

  it('keeps an open fenced code block entirely in the tail', () => {
    const content = '```ts\nconst value = 1;';

    expect(splitStableMarkdown(content)).toEqual({
      stable: '',
      tail: '```ts\nconst value = 1;',
    });
  });

  it('marks a fenced code block stable only after the closing fence arrives', () => {
    const content = '```ts\nconst value = 1;\n```\n接着输出';

    expect(splitStableMarkdown(content)).toEqual({
      stable: '```ts\nconst value = 1;\n```\n',
      tail: '接着输出',
    });
  });
});

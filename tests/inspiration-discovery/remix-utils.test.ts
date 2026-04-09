import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRemixPrompt, buildRemixEditorUrl } from '@/lib/inspiration/remix';
import {
  cachePublicationSnapshotMessages,
  clearCachedPublicationSnapshotMessages,
} from '@/lib/discover/publication-snapshot-cache';

afterEach(() => {
  clearCachedPublicationSnapshotMessages();
  vi.unstubAllGlobals();
});

describe('inspiration remix utils', () => {
  it('prefers the latest substantive user prompt from snapshot messages', () => {
    const prompt = buildRemixPrompt({
      title: 'Neon city poster',
      categoryName: 'Poster',
      tags: ['neon', 'cyberpunk'],
      description: 'High contrast night city scene',
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: '参考图',
          metadata: { kind: 'reference-image', imageUrl: 'https://example.com/ref.jpg' },
          created_at: '2026-04-06T00:00:00.000Z',
        },
        {
          id: 'm2',
          role: 'assistant',
          content: 'Here is the result.',
          metadata: null,
          created_at: '2026-04-06T00:00:01.000Z',
        },
        {
          id: 'm3',
          role: 'user',
          content: '把这张街景做成手绘等距示意图',
          metadata: null,
          created_at: '2026-04-06T00:00:02.000Z',
        },
      ],
    });

    expect(prompt).toBe('把这张街景做成手绘等距示意图');
  });

  it('falls back to summary fields when no substantive user prompt exists in snapshot messages', () => {
    const prompt = buildRemixPrompt({
      title: 'Neon city poster',
      categoryName: 'Poster',
      tags: ['neon', 'cyberpunk'],
      description: 'High contrast night city scene',
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: '参考图',
          metadata: { kind: 'reference-image', imageUrl: 'https://example.com/ref.jpg' },
          created_at: '2026-04-06T00:00:00.000Z',
        },
      ],
    });

    expect(prompt).toContain('Neon city poster');
    expect(prompt).toContain('Poster');
    expect(prompt).toContain('neon');
    expect(prompt).toContain('High contrast');
  });

  it('builds prompt from title/category/tags/description', () => {
    const prompt = buildRemixPrompt({
      title: 'Neon city poster',
      categoryName: 'Poster',
      tags: ['neon', 'cyberpunk'],
      description: 'High contrast night city scene',
    });

    expect(prompt).toContain('Neon city poster');
    expect(prompt).toContain('Poster');
    expect(prompt).toContain('neon');
    expect(prompt).toContain('High contrast');
  });

  it('falls back to safe default prompt when fields are empty', () => {
    const prompt = buildRemixPrompt({
      title: '',
      categoryName: '',
      tags: [],
      description: '',
    });

    expect(prompt).toContain('Generate an editable version');
  });

  it('applies maxLength to fallback prompt path', () => {
    const prompt = buildRemixPrompt({
      title: '',
      categoryName: '',
      tags: [],
      description: '',
      maxLength: 20,
    });

    expect(prompt.length).toBe(20);
  });

  it('respects maxLength when prompt gets too long', () => {
    const prompt = buildRemixPrompt({
      title: 'A'.repeat(120),
      description: 'B'.repeat(120),
      maxLength: 80,
    });

    expect(prompt.length).toBe(80);
  });

  it('applies maxLength to source prompt extracted from snapshot messages', () => {
    const prompt = buildRemixPrompt({
      title: '',
      categoryName: '',
      tags: [],
      description: '',
      maxLength: 10,
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: '1234567890abcdef',
          metadata: null,
          created_at: '2026-04-06T00:00:00.000Z',
        },
      ],
    });

    expect(prompt).toBe('1234567890');
  });

  it('falls back to cached publication snapshot messages on detail pages', () => {
    cachePublicationSnapshotMessages('pub_detail', [
      {
        id: 'm1',
        role: 'user',
        content: '参考图',
        metadata: { kind: 'reference-image', imageUrl: 'https://example.com/ref.jpg' },
        created_at: '2026-04-06T00:00:00.000Z',
      },
      {
        id: 'm2',
        role: 'user',
        content: '把这个版式复刻成可编辑海报，保留配色和信息层级',
        metadata: null,
        created_at: '2026-04-06T00:00:01.000Z',
      },
    ]);

    vi.stubGlobal('window', {
      location: {
        pathname: '/app/discover/pub_detail',
      },
    });

    const prompt = buildRemixPrompt({
      title: 'Fallback title',
      categoryName: 'Poster',
      tags: ['layout'],
      description: 'Fallback description',
    });

    expect(prompt).toBe('把这个版式复刻成可编辑海报，保留配色和信息层级');
  });

  it('builds editor URL with source entry and ref', () => {
    const url = buildRemixEditorUrl({
      projectId: 'p_123',
      prompt: 'hello world',
      entry: 'card',
      publicationId: 'pub_1',
    });

    expect(url).toContain('/app/p/p_123?');
    expect(url).toContain('source=discover');
    expect(url).toContain('entry=card');
    expect(url).toContain('ref=pub_1');
    expect(url).toContain('prompt=');
  });

  it('encodes projectId when building editor URL path segment', () => {
    const url = buildRemixEditorUrl({
      projectId: 'project/a b',
      prompt: 'hello world',
      entry: 'detail',
      publicationId: 'pub_2',
    });

    expect(url).toContain('/app/p/project%2Fa%20b?');
  });
});

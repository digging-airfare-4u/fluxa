import { describe, expect, it } from 'vitest';
import { buildRemixPrompt, buildRemixEditorUrl } from '@/lib/inspiration/remix';

describe('inspiration remix utils', () => {
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

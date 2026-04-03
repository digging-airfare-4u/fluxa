import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('editor toolbar style contract', () => {
  it('groups canvas tools and keeps image/ai actions visually separated', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/editor/LeftToolbar.tsx'),
      'utf8',
    );

    expect(source).toContain("group: 'core'");
    expect(source).toContain("group: 'actions'");
    expect(source).toContain('const toolGroups = [');
    expect(source).toContain('editor-toolbar__group');
    expect(source).toContain('editor-toolbar__divider');
    expect(source).toContain('editor-toolbar__button');
    expect(source).toContain('editor-toolbar__button--active');
  });

  it('defines a denser floating toolbar shell and a slightly smaller bottom toolbar', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/globals.css'),
      'utf8',
    );

    expect(source).toContain('.editor-toolbar__group {');
    expect(source).toContain('.editor-toolbar__divider {');
    expect(source).toContain('.editor-toolbar__button {');
    expect(source).toContain('.editor-toolbar__button--active {');
    expect(source).toContain('.editor-toolbar--horizontal .editor-toolbar__group {');
    expect(source).toContain('.editor-toolbar--horizontal {');
    expect(source).toContain('.editor-toolbar--horizontal .editor-toolbar__button {');
    expect(source).toContain('gap: 6px;');
    expect(source).toContain('height: 24px;');
    expect(source).toContain('width: 40px;');
    expect(source).toContain('height: 40px;');
    expect(source).toContain('box-shadow: 0 12px 28px');
    expect(source).toContain('background: #2f2f2f;');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('canvas controls layout contract', () => {
  it('globals should only layer the canvas itself and leave overlay z-index utilities intact', () => {
    const source = readSource('src/app/globals.css');

    expect(source).toContain('.canvas-container > canvas {');
    expect(source).toContain('z-index: 1;');
    expect(source).not.toContain('.canvas-container > * {');
  });
});

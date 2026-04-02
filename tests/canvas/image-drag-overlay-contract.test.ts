import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('image drag overlay contract', () => {
  it('CanvasStage should cancel pending selection RAF before hiding image overlays on drag', () => {
    const source = readSource('src/components/canvas/CanvasStage.tsx');

    expect(source).toContain('const cancelPendingSelectionUpdate = useCallback(() => {');
    expect(source).toContain('selectionUpdateRafRef.current = null;');
    expect(source).toContain('cancelPendingSelectionUpdate();');
  });
});

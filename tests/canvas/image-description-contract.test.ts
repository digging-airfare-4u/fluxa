import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('canvas image description wiring', () => {
  it('SelectionInfo should expose editable label props for image descriptions', () => {
    const source = readSource('src/components/canvas/SelectionInfo.tsx');

    expect(source).toContain('label?: string;');
    expect(source).toContain('editable?: boolean;');
    expect(source).toContain('onLabelChange?: (value: string) => void;');
  });

  it('CanvasStage should persist image description edits through the layer store', () => {
    const source = readSource('src/components/canvas/CanvasStage.tsx');

    expect(source).toContain('handleImageDescriptionChange');
    expect(source).toContain('persistName');
    expect(source).toContain('renameLayer');
    expect(source).toContain('onLabelChange={handleImageDescriptionChange}');
  });

  it('LayerPanel rename flow should also persist renamed descriptions', () => {
    const source = readSource('src/components/layer/LayerPanel.tsx');

    expect(source).toContain('persistName');
    expect(source).toContain('await persistName(layerId, name)');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('classic image generation regression contract', () => {
  it('keeps classic image models on the existing image generation path in ChatPanel', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/chat/ChatPanel.tsx'),
      'utf8',
    );

    expect(source).toContain("if (chatMode === 'agent')");
    expect(source).toContain('const isImageModel = isSelectableImageModel(currentModel, selectableModels)');
    expect(source).toContain('await startImageGeneration(ctx);');
    expect(source).toContain('await startOpsGeneration(ctx);');
  });

  it('preserves placeholder lifecycle, aspect ratio, resolution, and referenced asset routing in useGeneration', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/hooks/chat/useGeneration.ts'),
      'utf8',
    );

    expect(source).toContain('pendingGenerationTracker.registerGeneration');
    expect(source).toContain('onAddPlaceholder?.(');
    expect(source).toContain('subscribeToJob(result.jobId');
    expect(source).toContain('await saveOp({ documentId, op: opToSave });');
    expect(source).toContain('imageUrl: referencedImage?.url');
    expect(source).toContain('aspectRatio: selectedAspectRatio');
    expect(source).toContain('resolution: selectedResolution');
  });

  it('validates classic reference images against trusted project assets before generation', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'supabase/functions/generate-image/index.ts'),
      'utf8',
    );

    expect(source).toContain('validateTrustedProjectReferenceImageUrl');
    expect(source).toContain('request.imageUrl');
  });
});

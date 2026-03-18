/**
 * Feature: shared-image-generation-core
 * Property 1: Preserve classic generate-image output contract while extracting reusable Gemini logic
 * Validates: Requirements 1.2-1.4
 */

import { describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../../supabase/functions/_shared/errors/index.ts';
import {
  executeSharedImageGeneration,
  resolveSystemImageGenerationProvider,
} from '../../supabase/functions/_shared/utils/image-generation-core.ts';

describe('resolveSystemImageGenerationProvider', () => {
  it('falls back to the default model when the requested system model is unsupported', () => {
    const registry = {
      isSupported: (modelName: string) => modelName === 'gemini-3-pro-image-preview',
      getImageProvider: (modelName: string) => ({ name: `provider:${modelName}` }),
    };

    const resolved = resolveSystemImageGenerationProvider({
      selectedModel: 'unknown-model',
      defaultModel: 'gemini-3-pro-image-preview',
      registry,
    });

    expect(resolved.modelName).toBe('gemini-3-pro-image-preview');
    expect(resolved.provider).toEqual({ name: 'provider:gemini-3-pro-image-preview' });
    expect(resolved.fallbackApplied).toBe(true);
  });
});

describe('executeSharedImageGeneration', () => {
  it('uploads generated images and returns the classic job output contract', async () => {
    const provider = {
      name: 'gemini',
      capabilities: {
        supportsImageToImage: true,
        maxResolution: '4K' as const,
        supportedAspectRatios: ['1:1'] as const,
      },
      validateRequest: () => ({ valid: true, errors: [] }),
      generate: vi.fn(async (request) => {
        expect(request.referenceImageBase64).toBe('AQID');
        expect(request.referenceImageMimeType).toBe('image/png');

        return {
          imageData: new Uint8Array([9, 8, 7, 6]).buffer,
          mimeType: 'image/png',
          width: 640,
          height: 480,
          metadata: {
            textResponse: 'Rendered image',
            thoughtSummary: 'Used the shared core',
          },
        };
      }),
    };

    const assetService = {
      uploadImage: vi.fn(async () => ({
        id: 'asset-1',
        projectId: 'project-1',
        userId: 'user-1',
        storagePath: 'user-1/project-1/asset-1.png',
        publicUrl: 'https://cdn.example.com/generated.png',
        mimeType: 'image/png',
        sizeBytes: 4,
      })),
    };

    const result = await executeSharedImageGeneration({
      provider,
      prompt: 'generate a poster',
      selectedModel: 'gemini-3-pro-image-preview',
      resolution: '1K',
      aspectRatio: '1:1',
      userId: 'user-1',
      projectId: 'project-1',
      imageUrl: 'https://example.com/reference.png',
      placeholderX: 12,
      placeholderY: 34,
      assetService,
      compressThresholdBytes: 1024,
      fetcher: vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      })),
    });

    expect(result.kind).toBe('image');
    if (result.kind !== 'image') {
      throw new Error('Expected image result');
    }

    expect(assetService.uploadImage).toHaveBeenCalledOnce();
    expect(result.jobOutput).toMatchObject({
      assetId: 'asset-1',
      storagePath: 'user-1/project-1/asset-1.png',
      publicUrl: 'https://cdn.example.com/generated.png',
      model: 'gemini-3-pro-image-preview',
      resolution: '1K',
      aspectRatio: '1:1',
      textResponse: 'Rendered image',
      thoughtSummary: 'Used the shared core',
      op: {
        type: 'addImage',
        payload: {
          src: 'https://cdn.example.com/generated.png',
          x: 12,
          y: 34,
          width: 640,
          height: 480,
        },
      },
    });
  });

  it('normalizes text-only provider responses without uploading an asset', async () => {
    const provider = {
      name: 'gemini',
      capabilities: {
        supportsImageToImage: true,
        maxResolution: '4K' as const,
        supportedAspectRatios: ['1:1'] as const,
      },
      validateRequest: () => ({ valid: true, errors: [] }),
      generate: vi.fn(async () => {
        throw new ProviderError(
          'No image returned',
          'TEXT_ONLY_RESPONSE',
          {
            textResponse: 'Here is a text-only answer',
            thoughtSummary: 'Gemini declined to return image bytes',
          },
          'gemini',
          'gemini-3-pro-image-preview',
        );
      }),
    };

    const assetService = {
      uploadImage: vi.fn(),
    };

    const result = await executeSharedImageGeneration({
      provider,
      prompt: 'answer with text',
      selectedModel: 'gemini-3-pro-image-preview',
      resolution: '1K',
      aspectRatio: '1:1',
      userId: 'user-1',
      projectId: 'project-1',
      assetService,
    });

    expect(result).toEqual({
      kind: 'text-only',
      output: {
        model: 'gemini-3-pro-image-preview',
        resolution: '1K',
        aspectRatio: '1:1',
        textResponse: 'Here is a text-only answer',
        thoughtSummary: 'Gemini declined to return image bytes',
        providerCode: 'TEXT_ONLY_RESPONSE',
      },
    });
    expect(assetService.uploadImage).not.toHaveBeenCalled();
  });
});

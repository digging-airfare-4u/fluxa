/**
 * Shared Image Generation Core
 * Reuses provider execution, reference image preparation, asset upload, and
 * text-only normalization across generate-image and future Agent tooling.
 */

import { ProviderError } from '../errors/index.ts';
import type { ImageProvider } from '../providers/types.ts';
import type { AspectRatio, AssetRecord, ResolutionPreset } from '../types/index.ts';
import { RESOLUTION_PRESETS } from '../types/index.ts';
import { fetchReferenceImageForGemini } from './reference-image.ts';

const DEFAULT_REFERENCE_COMPRESS_THRESHOLD_BYTES = 2 * 1024 * 1024; // 2MB

export interface ImageProviderRegistryLike {
  isSupported(modelName: string): boolean;
  getImageProvider(modelName: string): ImageProvider;
}

export interface ImageAssetServiceLike {
  uploadImage(
    userId: string,
    projectId: string,
    imageData: ArrayBuffer,
    contentType: string,
    metadata: {
      model?: string;
      prompt?: string;
      resolution?: string;
      aspectRatio?: string;
    },
  ): Promise<AssetRecord>;
}

export interface PreparedReferenceImage {
  base64: string;
  mimeType: string;
  sizeBytes: number;
  strategy: string;
}

export interface SharedImageGenerationOutput {
  assetId: string;
  storagePath: string;
  publicUrl: string;
  layerId: string;
  op: {
    type: 'addImage';
    payload: {
      id: string;
      src: string;
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  model: string;
  resolution: string;
  aspectRatio: string;
  textResponse?: string;
  thoughtSummary?: string;
}

export interface SharedImageResult {
  kind: 'image';
  asset: AssetRecord;
  jobOutput: SharedImageGenerationOutput;
}

export interface SharedTextOnlyResult {
  kind: 'text-only';
  output: {
    model: string;
    resolution: string;
    aspectRatio: string;
    textResponse: string;
    thoughtSummary?: string;
    providerCode: string;
  };
}

export type SharedImageGenerationResult = SharedImageResult | SharedTextOnlyResult;

export interface ExecuteSharedImageGenerationArgs {
  provider: ImageProvider;
  prompt: string;
  selectedModel: string;
  resolution: ResolutionPreset;
  aspectRatio: AspectRatio;
  userId: string;
  projectId: string;
  assetService: ImageAssetServiceLike;
  imageUrl?: string;
  placeholderX?: number;
  placeholderY?: number;
  compressThresholdBytes?: number;
  fetcher?: typeof fetch;
}

function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function calculateDimensions(
  resolution: ResolutionPreset,
  aspectRatio: AspectRatio,
): { width: number; height: number } {
  const maxDimension = RESOLUTION_PRESETS[resolution];
  const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);

  if (!widthRatio || !heightRatio) {
    return { width: maxDimension, height: maxDimension };
  }

  if (widthRatio >= heightRatio) {
    return {
      width: maxDimension,
      height: Math.round((maxDimension * heightRatio) / widthRatio),
    };
  }

  return {
    width: Math.round((maxDimension * widthRatio) / heightRatio),
    height: maxDimension,
  };
}

export async function prepareReferenceImageForGeneration(
  imageUrl: string,
  options?: {
    compressThresholdBytes?: number;
    fetcher?: typeof fetch;
  },
): Promise<PreparedReferenceImage | null> {
  const preparedReference = await fetchReferenceImageForGemini(imageUrl, {
    compressThresholdBytes:
      options?.compressThresholdBytes ?? DEFAULT_REFERENCE_COMPRESS_THRESHOLD_BYTES,
    fetcher: options?.fetcher,
  });

  if (!preparedReference) {
    return null;
  }

  return {
    base64: arrayBufferToBase64(preparedReference.arrayBuffer),
    mimeType: preparedReference.mimeType,
    sizeBytes: preparedReference.sizeBytes,
    strategy: preparedReference.strategy,
  };
}

export function resolveSystemImageGenerationProvider(args: {
  selectedModel: string;
  defaultModel: string;
  registry: ImageProviderRegistryLike;
}): {
  modelName: string;
  provider: ImageProvider;
  fallbackApplied: boolean;
} {
  const modelName = args.registry.isSupported(args.selectedModel)
    ? args.selectedModel
    : args.defaultModel;

  return {
    modelName,
    provider: args.registry.getImageProvider(modelName),
    fallbackApplied: modelName !== args.selectedModel,
  };
}

function normalizeTextOnlyResponse(
  error: ProviderError,
  selectedModel: string,
  resolution: ResolutionPreset,
  aspectRatio: AspectRatio,
): SharedTextOnlyResult {
  const details = (error.details as Record<string, unknown> | undefined) || {};
  return {
    kind: 'text-only',
    output: {
      model: selectedModel,
      resolution,
      aspectRatio,
      textResponse:
        typeof details.textResponse === 'string' ? details.textResponse : error.message,
      thoughtSummary:
        typeof details.thoughtSummary === 'string' ? details.thoughtSummary : undefined,
      providerCode: error.providerCode || 'TEXT_ONLY_RESPONSE',
    },
  };
}

export async function executeSharedImageGeneration(
  args: ExecuteSharedImageGenerationArgs,
): Promise<SharedImageGenerationResult> {
  const referenceImage = args.imageUrl
    ? await prepareReferenceImageForGeneration(args.imageUrl, {
        compressThresholdBytes: args.compressThresholdBytes,
        fetcher: args.fetcher,
      })
    : null;

  let imageResult;
  try {
    imageResult = await args.provider.generate({
      prompt: args.prompt,
      aspectRatio: args.aspectRatio,
      resolution: args.resolution,
      referenceImageBase64: referenceImage?.base64,
      referenceImageMimeType: referenceImage?.mimeType,
      referenceImageUrl: args.imageUrl,
    });
  } catch (error) {
    if (error instanceof ProviderError && error.providerCode === 'TEXT_ONLY_RESPONSE') {
      return normalizeTextOnlyResponse(
        error,
        args.selectedModel,
        args.resolution,
        args.aspectRatio,
      );
    }

    throw error;
  }

  const providerTextResponse =
    typeof imageResult.metadata?.textResponse === 'string'
      ? imageResult.metadata.textResponse
      : undefined;
  const providerThoughtSummary =
    typeof imageResult.metadata?.thoughtSummary === 'string'
      ? imageResult.metadata.thoughtSummary
      : undefined;

  const asset = await args.assetService.uploadImage(
    args.userId,
    args.projectId,
    imageResult.imageData,
    imageResult.mimeType,
    {
      model: args.selectedModel,
      prompt: args.prompt,
      resolution: args.resolution,
      aspectRatio: args.aspectRatio,
    },
  );

  const fallbackDimensions = calculateDimensions(args.resolution, args.aspectRatio);
  const layerId = `layer-${crypto.randomUUID().slice(0, 8)}`;

  return {
    kind: 'image',
    asset,
    jobOutput: {
      assetId: asset.id,
      storagePath: asset.storagePath,
      publicUrl: asset.publicUrl,
      layerId,
      op: {
        type: 'addImage',
        payload: {
          id: layerId,
          src: asset.publicUrl,
          x: args.placeholderX ?? 100,
          y: args.placeholderY ?? 100,
          width: imageResult.width ?? fallbackDimensions.width,
          height: imageResult.height ?? fallbackDimensions.height,
        },
      },
      model: args.selectedModel,
      resolution: args.resolution,
      aspectRatio: args.aspectRatio,
      textResponse: providerTextResponse,
      thoughtSummary: providerThoughtSummary,
    },
  };
}

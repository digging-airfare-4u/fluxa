/**
 * Gemini Image Generation Provider
 * Supports text-to-image and image-to-image generation via Google Generative AI API
 * Requirements: 1.1, 1.2, 1.3, 1.4, 3.8, 4.1, 4.2, 7.6, 7.7
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';

// Resolution presets mapping to max pixel dimensions
// Requirements: 3.8
export const RESOLUTION_PRESETS = {
  '1K': 1024,
  '2K': 2048,
  '4K': 4096,
} as const;

export type ResolutionPreset = keyof typeof RESOLUTION_PRESETS;

// Supported aspect ratios
// Requirements: 4.1
export const SUPPORTED_ASPECT_RATIOS = [
  '1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2', '4:5', '5:4', '21:9'
] as const;

export type AspectRatio = typeof SUPPORTED_ASPECT_RATIOS[number];

// Model capabilities
// Requirements: 1.1, 1.2
export const GEMINI_MODELS = {
  'gemini-2.5-flash-image': {
    maxResolution: '2K' as ResolutionPreset,
    supportsImageToImage: true,
  },
  'gemini-3-pro-image-preview': {
    maxResolution: '4K' as ResolutionPreset,
    supportsImageToImage: true,
  },
} as const;

export type GeminiModelName = keyof typeof GEMINI_MODELS;

export interface GeminiGenerateRequest {
  prompt: string;
  model: GeminiModelName;
  aspectRatio?: AspectRatio;
  resolution?: ResolutionPreset;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
}

export interface GeminiGenerateResponse {
  imageBase64: string;
  mimeType: string;
  thoughtSignature?: string;
}

/**
 * Parse aspect ratio string to width/height ratio
 */
export function parseAspectRatio(aspectRatio: AspectRatio): { widthRatio: number; heightRatio: number } {
  const [w, h] = aspectRatio.split(':').map(Number);
  return { widthRatio: w, heightRatio: h };
}

/**
 * Calculate pixel dimensions from resolution preset and aspect ratio
 * Requirements: 3.8
 */
export function calculateDimensions(
  resolution: ResolutionPreset,
  aspectRatio: AspectRatio
): { width: number; height: number } {
  const maxDimension = RESOLUTION_PRESETS[resolution];
  const { widthRatio, heightRatio } = parseAspectRatio(aspectRatio);
  
  let width: number;
  let height: number;
  
  if (widthRatio >= heightRatio) {
    // Landscape or square: width is the limiting factor
    width = maxDimension;
    height = Math.round((maxDimension * heightRatio) / widthRatio);
  } else {
    // Portrait: height is the limiting factor
    height = maxDimension;
    width = Math.round((maxDimension * widthRatio) / heightRatio);
  }
  
  return { width, height };
}

/**
 * Validate model supports requested resolution
 * Requirements: 3.8
 */
export function validateModelResolution(model: GeminiModelName, resolution: ResolutionPreset): boolean {
  const modelConfig = GEMINI_MODELS[model];
  if (!modelConfig) return false;
  
  const modelMaxPixels = RESOLUTION_PRESETS[modelConfig.maxResolution];
  const requestedPixels = RESOLUTION_PRESETS[resolution];
  
  return requestedPixels <= modelMaxPixels;
}

/**
 * Get Gemini API host from system_settings
 * Requirements: 7.6, 7.7
 */
export async function getGeminiApiHost(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'gemini_api_host')
    .single();
  
  if (error || !data?.value?.host) {
    // Default fallback
    return 'https://generativelanguage.googleapis.com';
  }
  
  return data.value.host;
}

/**
 * Build Gemini API request body
 * Requirements: 1.3, 1.4, 4.2
 */
function buildGeminiRequestBody(request: GeminiGenerateRequest): Record<string, unknown> {
  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];
  const parts: Array<Record<string, unknown>> = [];
  
  // Add reference image if provided (image-to-image)
  // Requirements: 1.4
  if (request.referenceImageBase64 && request.referenceImageMimeType) {
    parts.push({
      inlineData: {
        mimeType: request.referenceImageMimeType,
        data: request.referenceImageBase64,
      },
    });
  }
  
  // Add text prompt
  parts.push({ text: request.prompt });
  
  contents.push({
    role: 'user',
    parts,
  });
  
  // Build generation config
  const generationConfig: Record<string, unknown> = {
    responseModalities: ['image', 'text'],
  };
  
  // Add image config with aspect ratio
  // Requirements: 4.2
  if (request.aspectRatio) {
    generationConfig.imageConfig = {
      aspectRatio: request.aspectRatio,
    };
  }
  
  return {
    contents,
    generationConfig,
  };
}

/**
 * Parse Gemini API response to extract image data
 */
function parseGeminiResponse(responseData: Record<string, unknown>): GeminiGenerateResponse {
  const candidates = responseData.candidates as Array<Record<string, unknown>> | undefined;
  if (!candidates || candidates.length === 0) {
    throw new Error('No candidates in Gemini response');
  }
  
  const content = candidates[0].content as Record<string, unknown> | undefined;
  if (!content) {
    throw new Error('No content in Gemini response candidate');
  }
  
  const parts = content.parts as Array<Record<string, unknown>> | undefined;
  if (!parts || parts.length === 0) {
    throw new Error('No parts in Gemini response content');
  }
  
  // Find the image part
  for (const part of parts) {
    const inlineData = part.inlineData as { mimeType: string; data: string } | undefined;
    if (inlineData?.data) {
      return {
        imageBase64: inlineData.data,
        mimeType: inlineData.mimeType || 'image/png',
        thoughtSignature: responseData.thoughtSignature as string | undefined,
      };
    }
  }
  
  throw new Error('No image data found in Gemini response');
}

/**
 * Generate image using Gemini API
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
export async function generateImageGemini(
  supabase: SupabaseClient,
  request: GeminiGenerateRequest
): Promise<GeminiGenerateResponse> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  
  // Validate model
  if (!GEMINI_MODELS[request.model]) {
    throw new Error(`Unsupported Gemini model: ${request.model}`);
  }
  
  // Validate resolution if specified
  const resolution = request.resolution || '1K';
  if (!validateModelResolution(request.model, resolution)) {
    throw new Error(
      `Model ${request.model} does not support ${resolution} resolution. ` +
      `Maximum supported: ${GEMINI_MODELS[request.model].maxResolution}`
    );
  }
  
  // Get API host from settings
  const apiHost = await getGeminiApiHost(supabase);
  
  // Build API URL
  // Requirements: 7.7
  const apiUrl = `${apiHost}/v1beta/models/${request.model}:generateContent?key=${apiKey}`;
  
  // Build request body
  const requestBody = buildGeminiRequestBody(request);
  
  console.log(`[Gemini] Generating image with model: ${request.model}, resolution: ${resolution}, aspectRatio: ${request.aspectRatio || '1:1'}`);
  
  // Make API request
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Gemini] API error: ${response.status} - ${errorText}`);
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }
  
  const responseData = await response.json();
  
  // Parse and return response
  return parseGeminiResponse(responseData);
}

/**
 * Calculate points cost multiplier based on resolution
 * Requirements: 5.3, 5.4, 5.5
 */
export function getResolutionPointsMultiplier(resolution: ResolutionPreset): number {
  switch (resolution) {
    case '1K':
      return 1.0;
    case '2K':
      return 1.5;
    case '4K':
      return 2.0;
    default:
      return 1.0;
  }
}

/**
 * Calculate total points cost for Gemini image generation
 * Requirements: 5.2, 5.3, 5.4, 5.5
 */
export function calculateGeminiPointsCost(
  basePointsCost: number,
  resolution: ResolutionPreset
): number {
  const multiplier = getResolutionPointsMultiplier(resolution);
  return Math.ceil(basePointsCost * multiplier);
}

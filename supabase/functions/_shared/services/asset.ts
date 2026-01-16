/**
 * Asset Service Module
 * Handles image upload, storage, and asset record management
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import { AssetError } from '../errors/index.ts';
import type { AssetRecord } from '../types/index.ts';

// Re-export types for convenience
export type { AssetRecord };

/**
 * Asset metadata for generation tracking
 */
export interface AssetMetadata {
  model: string;
  prompt: string;
  resolution?: string;
  aspectRatio?: string;
}

/**
 * Asset Service
 * Manages image uploads, storage, and asset records
 * Requirements: 5.1
 */
export class AssetService {
  constructor(
    private supabase: SupabaseClient,
    private supabaseUrl: string
  ) {}

  /**
   * Upload image and create asset record
   * Requirements: 5.2, 5.3, 5.6
   * 
   * @param userId - User ID who owns the asset
   * @param projectId - Project ID the asset belongs to
   * @param imageData - Raw image data as ArrayBuffer
   * @param contentType - MIME type of the image
   * @param metadata - Generation metadata for tracking
   * @returns Created asset record
   * @throws AssetError if upload or record creation fails
   */
  async uploadImage(
    userId: string,
    projectId: string,
    imageData: ArrayBuffer,
    contentType: string,
    metadata: AssetMetadata
  ): Promise<AssetRecord> {
    // Generate unique asset ID
    // Requirements: 5.6
    const assetId = crypto.randomUUID();
    const extension = contentType === 'image/jpeg' ? 'jpg' : 'png';
    const storagePath = `${userId}/${projectId}/${assetId}.${extension}`;


    // Upload to storage
    const { error: uploadError } = await this.supabase.storage
      .from('assets')
      .upload(storagePath, imageData, { contentType, upsert: false });

    if (uploadError) {
      throw new AssetError(
        `Upload failed: ${uploadError.message}`,
        'UPLOAD_FAILED'
      );
    }

    // Get image dimensions
    const dimensions = this.getImageDimensions(imageData, contentType);

    // Create asset record
    // Requirements: 5.3
    const { error: assetError } = await this.supabase.from('assets').insert({
      id: assetId,
      project_id: projectId,
      user_id: userId,
      type: 'generate',
      storage_path: storagePath,
      filename: `generated-${assetId}.${extension}`,
      mime_type: contentType,
      size_bytes: imageData.byteLength,
      metadata: {
        source: {
          type: 'generate',
          origin: 'ai_generation',
          timestamp: new Date().toISOString(),
        },
        generation: {
          model: metadata.model,
          prompt: metadata.prompt,
          parameters: {
            resolution: metadata.resolution,
            aspectRatio: metadata.aspectRatio,
          },
        },
        scan: { status: 'pending' },
        dimensions,
      },
    });

    if (assetError) {
      throw new AssetError(
        `Asset creation failed: ${assetError.message}`,
        'RECORD_FAILED'
      );
    }

    return {
      id: assetId,
      projectId,
      userId,
      storagePath,
      publicUrl: this.getPublicUrl(storagePath),
      mimeType: contentType,
      sizeBytes: imageData.byteLength,
      dimensions: dimensions || undefined,
    };
  }

  /**
   * Get public URL for a storage path
   * Requirements: 5.4
   * 
   * @param storagePath - Storage path in the assets bucket
   * @returns Public URL to access the asset
   */
  getPublicUrl(storagePath: string): string {
    return `${this.supabaseUrl}/storage/v1/object/public/assets/${storagePath}`;
  }

  /**
   * Validate user owns an asset
   * Requirements: 5.5
   * 
   * @param userId - User ID to validate ownership for
   * @param assetId - Asset ID to check
   * @returns true if user owns the asset
   */
  async validateOwnership(userId: string, assetId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('assets')
      .select('user_id')
      .eq('id', assetId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.user_id === userId;
  }

  /**
   * Get image dimensions from raw image data
   * Supports PNG and JPEG formats
   * 
   * @param data - Raw image data as ArrayBuffer
   * @param contentType - MIME type of the image
   * @returns Dimensions object or null if unable to parse
   */
  getImageDimensions(
    data: ArrayBuffer,
    contentType: string
  ): { width: number; height: number } | null {
    const bytes = new Uint8Array(data);

    // PNG: dimensions at bytes 16-23 (width: 16-19, height: 20-23)
    if (contentType.includes('png') && bytes[0] === 0x89 && bytes[1] === 0x50) {
      const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      return { width, height };
    }

    // JPEG: need to parse markers to find SOF0/SOF2
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      let i = 2; // Skip SOI marker
      while (i < bytes.length - 8) {
        if (bytes[i] !== 0xFF) break;
        const marker = bytes[i + 1];
        // SOF0 (0xC0) or SOF2 (0xC2) contain dimensions
        if (marker === 0xC0 || marker === 0xC2) {
          const height = (bytes[i + 5] << 8) | bytes[i + 6];
          const width = (bytes[i + 7] << 8) | bytes[i + 8];
          return { width, height };
        }
        // Skip to next marker
        const length = (bytes[i + 2] << 8) | bytes[i + 3];
        i += 2 + length;
      }
    }

    return null;
  }
}

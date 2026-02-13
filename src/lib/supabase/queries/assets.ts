/**
 * Assets Queries
 * Fetch project assets (generated images)
 */

import { supabase } from '../client';

// Tencent Cloud COS configuration
const COS_BUCKET = process.env.NEXT_PUBLIC_COS_BUCKET || 'fluxa-1390058464';
const COS_REGION = process.env.NEXT_PUBLIC_COS_REGION || 'ap-tokyo';
const COS_PUBLIC_URL = `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`;

export interface Asset {
  id: string;
  project_id: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  created_at: string;
  url: string;
  metadata?: {
    source?: {
      type?: string;
      origin?: string;
    };
    generation?: {
      prompt?: string;
    };
  };
}

/**
 * Get public URL for an asset storage path
 */
export function getAssetUrl(storagePath: string): string {
  const normalizedPath = storagePath.trim();

  // Backward compatibility: some rows may already store a full URL.
  if (/^https?:\/\//i.test(normalizedPath)) {
    try {
      const parsed = new URL(normalizedPath);

      // COS signed URLs can expire; static path remains publicly accessible.
      if (parsed.hostname.includes('.cos.') && parsed.hostname.endsWith('.myqcloud.com')) {
        return `${parsed.origin}${parsed.pathname}`;
      }

      // Convert signed Supabase URL to public URL for public buckets.
      if (parsed.pathname.includes('/storage/v1/object/sign/assets/')) {
        return `${parsed.origin}${parsed.pathname.replace('/object/sign/assets/', '/object/public/assets/')}`;
      }
    } catch {
      // Fall through to returning the original string below.
    }
    return normalizedPath;
  }

  return `${COS_PUBLIC_URL}/${normalizedPath.replace(/^\/+/, '')}`;
}

/**
 * Fetch all assets for a project
 */
export async function fetchProjectAssets(projectId: string): Promise<Asset[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data.map(asset => ({
    ...asset,
    url: getAssetUrl(asset.storage_path),
  }));
}

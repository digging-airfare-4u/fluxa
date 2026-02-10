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
  return `${COS_PUBLIC_URL}/${storagePath}`;
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

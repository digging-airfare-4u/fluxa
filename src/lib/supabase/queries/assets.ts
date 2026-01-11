/**
 * Assets Queries
 * Fetch project assets (generated images)
 */

import { supabase } from '../client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

export interface Asset {
  id: string;
  project_id: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  created_at: string;
  url: string;
  metadata?: {
    generation?: {
      prompt?: string;
    };
  };
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
    url: `${SUPABASE_URL}/storage/v1/object/public/assets/${asset.storage_path}`,
  }));
}

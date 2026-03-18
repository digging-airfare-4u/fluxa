/**
 * Trusted reference image helpers
 * Ensures only trusted storage origins or current project assets are accepted
 * as reference images in classic and agent image generation flows.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import { ValidationError } from '../errors/index.ts';

interface EnvLike {
  get(name: string): string | undefined;
}

function getDefaultEnv(): EnvLike {
  const env = globalThis.Deno?.env;
  if (env && typeof env.get === 'function') {
    return env;
  }

  return {
    get: (name: string) => process.env[name],
  };
}

function normalizeStorageUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

function getCosOrigin(env: EnvLike = getDefaultEnv()): string {
  const bucket = env.get('COS_BUCKET') || 'fluxa-1390058464';
  const region = env.get('COS_REGION') || 'ap-tokyo';
  return `https://${bucket}.cos.${region}.myqcloud.com`;
}

function getSupabaseStorageOrigin(env: EnvLike = getDefaultEnv()): string | null {
  const supabaseUrl = env.get('SUPABASE_URL');
  if (!supabaseUrl) return null;

  try {
    const parsed = new URL(supabaseUrl);
    return `${parsed.origin}/storage/v1/object`;
  } catch {
    return null;
  }
}

function getAssetPublicUrl(
  storagePath: string,
  env: EnvLike = getDefaultEnv(),
): string {
  if (/^https?:\/\//i.test(storagePath)) {
    return normalizeStorageUrl(storagePath);
  }

  return `${getCosOrigin(env)}/${storagePath.replace(/^\/+/, '')}`;
}

export async function validateTrustedProjectReferenceImageUrl(
  serviceClient: SupabaseClient,
  projectId: string,
  referenceImageUrl?: string,
  env: EnvLike = getDefaultEnv(),
): Promise<void> {
  if (!referenceImageUrl) {
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(referenceImageUrl);
  } catch {
    throw new ValidationError('referenceImageUrl must be a valid URL');
  }

  const normalized = normalizeStorageUrl(parsed.toString());
  const trustedOrigins = [getCosOrigin(env), getSupabaseStorageOrigin(env)].filter(Boolean) as string[];
  if (trustedOrigins.some((origin) => normalized.startsWith(origin))) {
    return;
  }

  const { data: assets, error } = await serviceClient
    .from('assets')
    .select('storage_path')
    .eq('project_id', projectId);

  if (error) {
    throw new ValidationError('Failed to validate referenceImageUrl');
  }

  const matchesProjectAsset = (assets || []).some((asset) => {
    if (typeof asset.storage_path !== 'string') {
      return false;
    }

    return getAssetPublicUrl(asset.storage_path, env) === normalized;
  });

  if (!matchesProjectAsset) {
    throw new ValidationError('referenceImageUrl must point to a trusted project asset');
  }
}

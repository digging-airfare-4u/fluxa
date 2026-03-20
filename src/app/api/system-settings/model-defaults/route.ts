/**
 * API Route: Model Defaults
 * GET  - Fetch current model defaults from system_settings
 * POST - Upsert model defaults (partial update, null to reset)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthenticatedClient,
  createServiceClient,
  getUserAdminFlags,
  ApiAuthError,
} from '@/lib/supabase/server';
import { createLogger } from '@/lib/observability/logger';

const log = createLogger('API:system-settings/model-defaults');

/** The three model-default keys we manage */
const MODEL_KEYS = [
  'default_chat_model',
  'default_image_model',
  'agent_default_brain_model',
] as const;

type ModelKey = (typeof MODEL_KEYS)[number];
type ModelDefaults = Record<ModelKey, string | null>;

// ---------------------------------------------------------------------------
// GET – return current model defaults
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { user } = await createAuthenticatedClient(request);
    const { isSuperAdmin } = await getUserAdminFlags(user.id);

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only super admins can manage model defaults' } },
        { status: 403 },
      );
    }

    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from('system_settings')
      .select('key, value')
      .in('key', MODEL_KEYS as unknown as string[]);

    if (error) {
      log.error('GET DB error', { user_id: user.id, reason: error.message });
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: 'Failed to fetch model defaults' } },
        { status: 500 },
      );
    }

    const result: ModelDefaults = {
      default_chat_model: null,
      default_image_model: null,
      agent_default_brain_model: null,
    };

    for (const row of data ?? []) {
      const key = row.key as ModelKey;
      const model = (row.value as { model?: string } | null)?.model;
      if (MODEL_KEYS.includes(key) && typeof model === 'string' && model.trim()) {
        result[key] = model.trim();
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: err.message } },
        { status: 401 },
      );
    }
    log.error('GET unexpected error', { reason: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST – upsert model defaults (partial update)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const { user } = await createAuthenticatedClient(request);
    const { isSuperAdmin } = await getUserAdminFlags(user.id);

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only super admins can manage model defaults' } },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Partial<Record<ModelKey, string | null>>;

    // Validate: only accept known keys with string or null values
    const updates: { key: string; value: { model: string } }[] = [];
    const deletes: string[] = [];

    for (const key of MODEL_KEYS) {
      if (!(key in body)) continue;
      const val = body[key];
      if (val === null || val === '') {
        deletes.push(key);
      } else if (typeof val === 'string' && val.trim()) {
        updates.push({ key, value: { model: val.trim() } });
      } else {
        return NextResponse.json(
          { error: { code: 'INVALID_REQUEST', message: `Invalid value for ${key}: must be a non-empty string or null` } },
          { status: 400 },
        );
      }
    }

    if (updates.length === 0 && deletes.length === 0) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'No valid model keys provided' } },
        { status: 400 },
      );
    }

    const serviceClient = createServiceClient();

    // Upsert non-null values
    if (updates.length > 0) {
      const { error } = await serviceClient
        .from('system_settings')
        .upsert(updates, { onConflict: 'key' });

      if (error) {
        log.error('POST upsert error', { user_id: user.id, reason: error.message });
        return NextResponse.json(
          { error: { code: 'DB_ERROR', message: 'Failed to update model defaults' } },
          { status: 500 },
        );
      }
    }

    // Delete null values (reset to system default)
    if (deletes.length > 0) {
      const { error } = await serviceClient
        .from('system_settings')
        .delete()
        .in('key', deletes);

      if (error) {
        log.error('POST delete error', { user_id: user.id, reason: error.message });
        return NextResponse.json(
          { error: { code: 'DB_ERROR', message: 'Failed to reset model defaults' } },
          { status: 500 },
        );
      }
    }

    log.info('POST success', { user_id: user.id, updates: updates.length, deletes: deletes.length });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: err.message } },
        { status: 401 },
      );
    }
    log.error('POST unexpected error', { reason: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

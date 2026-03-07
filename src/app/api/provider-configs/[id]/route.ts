/**
 * API Route: Provider Config by ID
 * PATCH  - Update config fields or is_enabled
 * DELETE - Delete config and its credentials
 * Requirements: 2.5, 7.2-7.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient, createServiceClient, ApiAuthError } from '@/lib/supabase/server';
import { encryptApiKey, getApiKeyLast4 } from '@/lib/security/encryption';
import { createLogger } from '@/lib/observability/logger';
import { trackMetric } from '@/lib/observability/metrics';
import { revalidateProviderConfigBeforeSave } from '@/lib/security/provider-revalidation';

const log = createLogger('API:provider-configs/[id]');

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/provider-configs/[id]
 * Update config fields by ID. Supports partial updates including is_enabled toggle.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { client, user } = await createAuthenticatedClient(request);
    const body = await request.json();

    const { apiKey, apiUrl, modelName, displayName, isEnabled } = body;

    const trimmedApiKey = typeof apiKey === 'string' ? apiKey.trim() : undefined;
    const requiresRevalidation =
      (trimmedApiKey !== undefined && trimmedApiKey !== '') ||
      apiUrl !== undefined ||
      modelName !== undefined;

    // Build update payload — only include provided fields
    const updates: Record<string, unknown> = {};

    if (trimmedApiKey !== undefined && trimmedApiKey !== '') {
      updates.api_key_encrypted = await encryptApiKey(trimmedApiKey);
      updates.api_key_last4 = getApiKeyLast4(trimmedApiKey);
    }
    if (apiUrl !== undefined) {
      if (!apiUrl.trim()) {
        return NextResponse.json(
          { error: { code: 'INVALID_REQUEST', message: 'apiUrl must not be empty' } },
          { status: 400 }
        );
      }
      updates.api_url = apiUrl.trim();
    }
    if (modelName !== undefined) {
      if (!modelName.trim()) {
        return NextResponse.json(
          { error: { code: 'INVALID_REQUEST', message: 'modelName must not be empty' } },
          { status: 400 }
        );
      }
      updates.model_name = modelName.trim();
    }
    if (displayName !== undefined) {
      if (!displayName.trim()) {
        return NextResponse.json(
          { error: { code: 'INVALID_REQUEST', message: 'displayName must not be empty' } },
          { status: 400 }
        );
      }
      updates.display_name = displayName.trim();
    }
    if (isEnabled !== undefined) {
      updates.is_enabled = Boolean(isEnabled);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'No fields to update' } },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    if (requiresRevalidation) {
      const { data: existing, error: existingError } = await client
        .from('user_provider_configs')
        .select('api_url, model_name')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (existingError || !existing) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Config not found' } },
          { status: 404 }
        );
      }

      const targetApiUrl =
        typeof updates.api_url === 'string'
          ? updates.api_url
          : existing.api_url;
      const targetModelName =
        typeof updates.model_name === 'string'
          ? updates.model_name
          : existing.model_name;

      const serviceClient = createServiceClient();
      const revalidation = await revalidateProviderConfigBeforeSave({
        userClient: client,
        serviceClient,
        userId: user.id,
        apiUrl: targetApiUrl,
        modelName: targetModelName,
        apiKey: trimmedApiKey,
        configId: id,
      });

      if (!revalidation.success) {
        log.warn('PATCH revalidation failed', {
          user_id: user.id,
          config_id: id,
          code: revalidation.code,
          reason: revalidation.message,
        });
        trackMetric({
          event: 'config_save_failure',
          user_id: user.id,
          config_id: id,
          reason: `${revalidation.code}:${revalidation.message}`,
        });
        if (revalidation.code === 'ALLOWLIST_UNAVAILABLE') {
          trackMetric({
            event: 'allowlist_fail_closed',
            user_id: user.id,
            config_id: id,
          });
        }
        if (revalidation.code === 'REVALIDATION_TIMEOUT') {
          trackMetric({
            event: 'provider_revalidation_timeout',
            user_id: user.id,
            config_id: id,
          });
        }
        return NextResponse.json(
          { error: { code: revalidation.code, message: revalidation.message } },
          { status: revalidation.status }
        );
      }
    }

    // RLS ensures user can only update own records
    const { data, error } = await client
      .from('user_provider_configs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, user_id, provider, api_url, model_name, display_name, is_enabled, created_at, updated_at, api_key_last4')
      .single();

    if (error) {
      log.error('PATCH DB error', { user_id: user.id, config_id: id, reason: error.message });

      if (error.code === '23505') {
        return NextResponse.json(
          { error: { code: 'DUPLICATE_MODEL', message: 'A config with this model name already exists' } },
          { status: 409 }
        );
      }
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Config not found' } },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: 'Failed to update provider config' } },
        { status: 500 }
      );
    }

    const result = {
      ...data,
      api_key_masked: data.api_key_last4 ? `****${data.api_key_last4}` : '****',
      model_identifier: `user:${data.id}`,
    };
    const safeResult = { ...result };
    delete safeResult.api_key_last4;

    log.info('PATCH success', { user_id: user.id, config_id: id });
    return NextResponse.json({ data: safeResult });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: err.message } },
        { status: 401 }
      );
    }
    log.error('PATCH unexpected error', { reason: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/provider-configs/[id]
 * Delete a provider config and its stored credentials.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { client, user } = await createAuthenticatedClient(request);

    // RLS ensures user can only delete own records
    const { error, count } = await client
      .from('user_provider_configs')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      log.error('DELETE DB error', { user_id: user.id, config_id: id, reason: error.message });
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: 'Failed to delete provider config' } },
        { status: 500 }
      );
    }

    if (count === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Config not found' } },
        { status: 404 }
      );
    }

    log.info('DELETE success', { user_id: user.id, config_id: id });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: err.message } },
        { status: 401 }
      );
    }
    log.error('DELETE unexpected error', { reason: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

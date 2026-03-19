/**
 * API Route: Provider Configs
 * GET  - List visible shared provider configs (masked keys)
 * POST - Create a new shared provider config (super admin only)
 * Requirements: 2.4, 2.6, 6.2
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthenticatedClient,
  createServiceClient,
  getUserAdminFlags,
  ApiAuthError,
} from '@/lib/supabase/server';
import { encryptApiKey, getApiKeyLast4 } from '@/lib/security/encryption';
import { createLogger } from '@/lib/observability/logger';
import { trackMetric } from '@/lib/observability/metrics';
import { revalidateProviderConfigBeforeSave } from '@/lib/security/provider-revalidation';

const log = createLogger('API:provider-configs');

const VALID_PROVIDERS = ['volcengine', 'openai-compatible', 'anthropic-compatible'] as const;
const VALID_MODEL_TYPES = ['image', 'chat'] as const;

/**
 * GET /api/provider-configs
 * Returns the shared provider configs visible to the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await createAuthenticatedClient(request);
    const serviceClient = createServiceClient();
    const { isSuperAdmin } = await getUserAdminFlags(user.id);

    let query = serviceClient
      .from('user_provider_configs_safe')
      .select('*')
      .order('created_at', { ascending: false });

    if (isSuperAdmin) {
      query = query.eq('user_id', user.id);
    } else {
      const { data: adminProfiles, error: adminProfilesError } = await serviceClient
        .from('user_profiles')
        .select('id')
        .eq('is_super_admin', true);

      if (adminProfilesError) {
        log.error('GET failed to load super admins', {
          user_id: user.id,
          reason: adminProfilesError.message,
        });
        return NextResponse.json(
          { error: { code: 'DB_ERROR', message: 'Failed to fetch provider configs' } },
          { status: 500 }
        );
      }

      const adminIds = (adminProfiles || []).map((profile) => profile.id);
      if (adminIds.length === 0) {
        return NextResponse.json({ data: [], canManage: false });
      }

      query = query.in('user_id', adminIds).eq('is_enabled', true);
    }

    const { data, error } = await query;

    if (error) {
      log.error('GET failed', { user_id: user.id, reason: error.message });
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: 'Failed to fetch provider configs' } },
        { status: 500 }
      );
    }

    // Attach model_identifier for frontend convenience
    const configs = (data || []).map(row => ({
      ...row,
      model_identifier: `user:${row.id}`,
    }));

    return NextResponse.json({ data: configs, canManage: isSuperAdmin });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: err.message } },
        { status: 401 }
      );
    }
    console.error('[API] provider-configs GET unexpected error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/provider-configs
 * Create a new shared provider config. Always inserts (no upsert by provider).
 */
export async function POST(request: NextRequest) {
  try {
    const { client, user } = await createAuthenticatedClient(request);
    const { isSuperAdmin } = await getUserAdminFlags(user.id);
    const body = await request.json();

    const { provider, apiKey, apiUrl, modelName, displayName, modelType } = body;

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only super admins can manage shared provider configs' } },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!provider || !apiKey || !apiUrl || !modelName || !displayName) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'All fields are required: provider, apiKey, apiUrl, modelName, displayName' } },
        { status: 400 }
      );
    }

    // Validate provider type
    if (!VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: { code: 'INVALID_PROVIDER', message: `Provider must be one of: ${VALID_PROVIDERS.join(', ')}` } },
        { status: 400 }
      );
    }

    if (modelType !== undefined && !VALID_MODEL_TYPES.includes(modelType)) {
      return NextResponse.json(
        { error: { code: 'INVALID_MODEL_TYPE', message: `modelType must be one of: ${VALID_MODEL_TYPES.join(', ')}` } },
        { status: 400 }
      );
    }

    if (provider === 'anthropic-compatible' && modelType !== 'chat') {
      return NextResponse.json(
        { error: { code: 'INVALID_MODEL_TYPE', message: 'Anthropic-compatible provider only supports chat modelType' } },
        { status: 400 }
      );
    }

    // Validate trimmed values
    if (!apiKey.trim() || !apiUrl.trim() || !modelName.trim() || !displayName.trim()) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Fields must not be empty after trimming' } },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();
    const revalidation = await revalidateProviderConfigBeforeSave({
      userClient: client,
      serviceClient,
      userId: user.id,
      provider,
      apiUrl: apiUrl.trim(),
      modelName: modelName.trim(),
      apiKey: apiKey.trim(),
    });

    if (!revalidation.success) {
      log.warn('POST revalidation failed', {
        user_id: user.id,
        provider,
        code: revalidation.code,
        reason: revalidation.message,
      });
      trackMetric({
        event: 'config_save_failure',
        user_id: user.id,
        provider,
        reason: `${revalidation.code}:${revalidation.message}`,
      });
      if (revalidation.code === 'ALLOWLIST_UNAVAILABLE') {
        trackMetric({
          event: 'allowlist_fail_closed',
          user_id: user.id,
          provider,
        });
      }
      if (revalidation.code === 'REVALIDATION_TIMEOUT') {
        trackMetric({
          event: 'provider_revalidation_timeout',
          user_id: user.id,
          provider,
        });
      }
      return NextResponse.json(
        { error: { code: revalidation.code, message: revalidation.message } },
        { status: revalidation.status },
      );
    }

    // Encrypt API key
    const apiKeyEncrypted = await encryptApiKey(apiKey.trim());
    const apiKeyLast4 = getApiKeyLast4(apiKey.trim());

    const { data, error } = await client
      .from('user_provider_configs')
      .insert({
        user_id: user.id,
        provider: provider.trim(),
        api_key_encrypted: apiKeyEncrypted,
        api_key_last4: apiKeyLast4,
        api_url: apiUrl.trim(),
        model_name: modelName.trim(),
        display_name: displayName.trim(),
        model_type: provider === 'anthropic-compatible' ? 'chat' : modelType === 'chat' ? 'chat' : 'image',
        is_enabled: true,
      })
      .select('id, user_id, provider, api_url, model_name, display_name, model_type, is_enabled, created_at, updated_at, api_key_last4')
      .single();

    if (error) {
      log.error('POST DB error', { user_id: user.id, provider, reason: error.message });
      trackMetric({ event: 'config_save_failure', user_id: user.id, provider, reason: error.message });

      // Handle unique constraint violation (user_id, model_name, model_type)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: { code: 'DUPLICATE_MODEL', message: 'A config with this model name already exists' } },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: 'Failed to create provider config' } },
        { status: 500 }
      );
    }

    const result = {
      ...data,
      api_key_masked: data.api_key_last4 ? `****${data.api_key_last4}` : '****',
      model_identifier: `user:${data.id}`,
    };
    // Remove raw last4 from response
    const safeResult = { ...result };
    delete safeResult.api_key_last4;

    log.info('POST success', { user_id: user.id, config_id: data.id, provider });
    trackMetric({ event: 'config_save_success', user_id: user.id, config_id: data.id, provider });
    return NextResponse.json({ data: safeResult }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: err.message } },
        { status: 401 }
      );
    }
    log.error('POST unexpected error', { reason: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

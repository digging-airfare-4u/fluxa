/**
 * API Route: Test Provider
 * POST - Validate provider connectivity via list-models + fallback chat completion
 * Requirements: 4.3-4.5, 4.8, 4.9, 4.10
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthenticatedClient,
  createServiceClient,
  getUserAdminFlags,
  ApiAuthError,
} from '@/lib/supabase/server';
import { createLogger } from '@/lib/observability/logger';
import { trackMetric } from '@/lib/observability/metrics';
import { revalidateProviderConfigBeforeSave } from '@/lib/security/provider-revalidation';

const log = createLogger('API:test-provider');

/**
 * POST /api/test-provider
 * Tests connectivity to a provider endpoint.
 *
 * Body:
 *   - apiUrl: string (required)
 *   - apiKey: string (optional if configId provided — will load existing key)
 *   - modelName: string (required)
 *   - configId?: string (for edit scenario — loads existing key if apiKey is empty)
 */
export async function POST(request: NextRequest) {
  try {
    const { client, user } = await createAuthenticatedClient(request);
    const { isSuperAdmin } = await getUserAdminFlags(user.id);
    const body = await request.json();

    const { apiUrl, apiKey, modelName, configId } = body;

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only super admins can test shared provider configs' } },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!apiUrl || !modelName) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'apiUrl and modelName are required' } },
        { status: 400 }
      );
    }

    const trimmedUrl = apiUrl.trim();
    const trimmedModel = modelName.trim();

    const trimmedKey = apiKey?.trim();
    if (!trimmedKey && !configId) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ID_REQUIRED', message: 'configId is required when apiKey is omitted' } },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();
    const t0 = Date.now();
    const testResult = await revalidateProviderConfigBeforeSave({
      userClient: client,
      serviceClient,
      userId: user.id,
      apiUrl: trimmedUrl,
      modelName: trimmedModel,
      apiKey: trimmedKey,
      configId,
    });
    const duration_ms = Date.now() - t0;

    if (testResult.success === true) {
      log.info('Test passed', { user_id: user.id, model_name: trimmedModel });
      trackMetric({ event: 'test_provider_success', user_id: user.id, model_name: trimmedModel, duration_ms });
      return NextResponse.json({ success: true });
    }

    if (testResult.code === 'ALLOWLIST_UNAVAILABLE') {
      log.error('Fail-closed triggered: allowlist unavailable', {
        user_id: user.id,
        model_name: trimmedModel,
      });
      trackMetric({
        event: 'allowlist_fail_closed',
        user_id: user.id,
        model_name: trimmedModel,
        duration_ms,
      });
    }

    log.warn('Test failed', { user_id: user.id, model_name: trimmedModel, reason: testResult.message, code: testResult.code });
    trackMetric({
      event: 'test_provider_failure',
      user_id: user.id,
      model_name: trimmedModel,
      duration_ms,
      reason: testResult.message,
    });
    return NextResponse.json(
      { success: false, error: { code: testResult.code, message: testResult.message } },
      { status: testResult.status }
    );
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: err.message } },
        { status: 401 }
      );
    }
    log.error('Unexpected error', { reason: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

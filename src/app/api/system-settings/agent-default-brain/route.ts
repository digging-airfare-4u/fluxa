/**
 * API Route: Agent Default Brain Setting
 * POST - Upsert hidden default Agent Brain model
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthenticatedClient,
  createServiceClient,
  getUserAdminFlags,
  ApiAuthError,
} from '@/lib/supabase/server';
import { createLogger } from '@/lib/observability/logger';

const log = createLogger('API:system-settings/agent-default-brain');

export async function POST(request: NextRequest) {
  try {
    const { user } = await createAuthenticatedClient(request);
    const { isSuperAdmin } = await getUserAdminFlags(user.id);

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only super admins can manage system settings' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const model = typeof body?.model === 'string' ? body.model.trim() : '';

    if (!model) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'model is required' } },
        { status: 400 },
      );
    }

    const serviceClient = createServiceClient();
    const { error } = await serviceClient
      .from('system_settings')
      .upsert({
        key: 'agent_default_brain_model',
        value: { model },
        description: 'Default hidden Agent Brain model selection',
      })
      .select()
      .single();

    if (error) {
      log.error('POST DB error', { user_id: user.id, reason: error.message });
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: 'Failed to update system setting' } },
        { status: 500 },
      );
    }

    log.info('POST success', { user_id: user.id, model });
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

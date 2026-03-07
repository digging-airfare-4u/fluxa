/**
 * GET /api/payments/channels?scene=desktop
 * Returns available payment channels for the given checkout scene.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getAvailableChannels } from '@/lib/payments/channels';
import { resolveScene } from '@/lib/payments/scene';
import { getServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const sceneHint = request.nextUrl.searchParams.get('scene') ?? undefined;
    const ua = request.headers.get('user-agent');
    const scene = resolveScene(sceneHint, ua);

    const sc = getServiceClient();
    const result = await getAvailableChannels(sc, scene);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[API/payments/channels] Error:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load channels' } },
      { status: 500 }
    );
  }
}

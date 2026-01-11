/**
 * API Route: Generate Ops
 * Proxies requests to Supabase Edge Function
 * Requirements: 12.1-12.7 - AI design generation
 */

import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, documentId, conversationId, prompt, model } = body;

    // Validate required fields
    if (!projectId || !documentId || !conversationId || !prompt) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    console.log('[API] authHeader present:', !!authHeader);

    // Call Edge Function directly with fetch
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/generate-ops`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        ...(authHeader ? { 'Authorization': authHeader } : {}),
      },
      body: JSON.stringify({ projectId, documentId, conversationId, prompt, model }),
    });

    const data = await response.json();
    console.log('[API] Edge Function response:', { status: response.status, data });

    if (!response.ok) {
      console.error('[API] generate-ops error:', data);
      return NextResponse.json(
        { error: data.error || { code: 'AI_ERROR', message: 'Edge function error' } },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] generate-ops unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

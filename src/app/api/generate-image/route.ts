/**
 * API Route: Generate Image
 * Proxies requests to Supabase Edge Function for image generation
 */

import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, documentId, prompt, width, height, conversationId, imageUrl } = body;

    if (!projectId || !documentId || !prompt) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization');
    
    // Debug: log auth header presence
    console.log('[API] generate-image auth header present:', !!authHeader);
    console.log('[API] generate-image auth header prefix:', authHeader?.substring(0, 20));

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/generate-image`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        ...(authHeader ? { 'Authorization': authHeader } : {}),
      },
      body: JSON.stringify({ projectId, documentId, prompt, width, height, conversationId, imageUrl }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[API] generate-image error:', data);
      return NextResponse.json(
        { error: data.error || { code: 'IMAGE_ERROR', message: 'Edge function error' } },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] generate-image unexpected error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

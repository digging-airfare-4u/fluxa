/**
 * API Route: Generate Image
 * Proxies requests to Supabase Edge Function for image generation
 * Supports Gemini models with aspectRatio and resolution parameters
 * Requirements: 1.1-1.8, 3.1-3.8, 4.1-4.4
 */

import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      projectId, 
      documentId, 
      prompt, 
      model,
      width, 
      height, 
      conversationId, 
      imageUrl,
      placeholderX,
      placeholderY,
      // Gemini-specific parameters
      aspectRatio,
      resolution,
    } = body;

    if (!projectId || !documentId || !prompt) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization');
    
    // Debug: log auth header details
    console.log('[API] generate-image auth header present:', !!authHeader);
    console.log('[API] generate-image model:', model);
    if (authHeader) {
      // Log token prefix to help debug (don't log full token for security)
      const tokenParts = authHeader.split(' ');
      console.log('[API] generate-image auth type:', tokenParts[0]);
      console.log('[API] generate-image token length:', tokenParts[1]?.length || 0);
    }

    if (!authHeader) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' } },
        { status: 401 }
      );
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/generate-image`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': authHeader,
      },
      body: JSON.stringify({ 
        projectId, 
        documentId, 
        prompt, 
        model,
        width, 
        height, 
        conversationId, 
        imageUrl,
        placeholderX,
        placeholderY,
        // Gemini-specific parameters
        aspectRatio,
        resolution,
      }),
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

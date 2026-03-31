/**
 * Feature: MiniMax native image compatibility
 * Property 1: Reuse the shared user-configured image provider for MiniMax native image_generation
 * Validates: Requirements 5.2, 5.5
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserConfiguredImageProvider } from '../../supabase/functions/_shared/providers/user-configured-provider.ts';
import { OpenAICompatibleClient } from '../../supabase/functions/_shared/providers/openai-client.ts';

const fetchMock = vi.fn();

describe('UserConfiguredImageProvider MiniMax compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('calls the MiniMax native image_generation endpoint and forwards subject references', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        base_resp: { status_code: 0, status_msg: 'success' },
        data: {
          image_base64: ['QUJDRA=='],
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const provider = new UserConfiguredImageProvider(
      new OpenAICompatibleClient({
        apiUrl: 'https://api.minimaxi.com/v1',
        apiKey: 'sk-test',
        providerName: 'user-configured:openai-compatible',
      }),
      {
        id: 'cfg-1',
        user_id: 'user-1',
        provider: 'openai-compatible',
        api_key: 'sk-test',
        api_url: 'https://api.minimaxi.com/v1',
        model_name: 'image-01',
        display_name: 'MiniMax Image',
        model_type: 'image',
        is_enabled: true,
      },
    );

    const result = await provider.generate({
      prompt: 'A girl looking into the distance from a library window',
      aspectRatio: '16:9',
      referenceImageUrl: 'https://cdn.example.com/reference.png',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(requestUrl).toBe('https://api.minimaxi.com/v1/image_generation');
    expect(requestInit.method).toBe('POST');
    expect(requestInit.headers).toMatchObject({
      Authorization: 'Bearer sk-test',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(requestInit.body))).toEqual({
      model: 'image-01',
      prompt: 'A girl looking into the distance from a library window',
      aspect_ratio: '16:9',
      n: 1,
      response_format: 'base64',
      subject_reference: [
        {
          type: 'character',
          image_file: 'https://cdn.example.com/reference.png',
        },
      ],
    });

    expect(result.mimeType).toBe('image/png');
    expect(new Uint8Array(result.imageData)).toEqual(new Uint8Array([65, 66, 67, 68]));
    expect(result.metadata).toMatchObject({
      provider: 'openai-compatible',
      model: 'image-01',
      responseType: 'base64',
    });
  });
});

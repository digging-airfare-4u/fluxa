import { beforeEach, describe, expect, it, vi } from 'vitest';

function createQueryChain(rows: unknown[]) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(async () => ({ data: rows, error: null })),
  };

  return chain;
}

describe('classic model query filtering', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('filters agent-only models out of fetchModels even if they are accidentally visible', async () => {
    const rows = [
      {
        id: 'classic-1',
        name: 'gemini-3-pro-image-preview',
        display_name: 'Nano Banana Pro',
        provider: 'google',
        description: null,
        type: 'image',
        is_default: true,
        is_enabled: true,
        sort_order: 1,
        points_cost: 40,
        usage_scope: 'classic',
        is_visible_in_selector: true,
      },
      {
        id: 'agent-1',
        name: 'fluxa-agent',
        display_name: 'Fluxa Agent',
        provider: 'system',
        description: null,
        type: 'ops',
        is_default: false,
        is_enabled: true,
        sort_order: 2,
        points_cost: 12,
        usage_scope: 'agent',
        is_visible_in_selector: true,
      },
    ];

    const query = createQueryChain(rows);

    vi.doMock('@/lib/supabase/client', () => ({
      supabase: {
        from: vi.fn(() => query),
      },
    }));

    const { fetchModels } = await import('@/lib/supabase/queries/models');
    const models = await fetchModels();

    expect(models.map((model) => model.name)).toEqual(['gemini-3-pro-image-preview']);
  });

  it('keeps classic and all-scope image models in fetchImageModels', async () => {
    const rows = [
      {
        id: 'classic-image',
        name: 'gemini-3-pro-image-preview',
        display_name: 'Nano Banana Pro',
        provider: 'google',
        description: null,
        type: 'image',
        is_default: true,
        is_enabled: true,
        sort_order: 1,
        points_cost: 40,
        usage_scope: 'classic',
        is_visible_in_selector: true,
      },
      {
        id: 'all-image',
        name: 'seedream-4',
        display_name: 'Seedream 4',
        provider: 'byteplus',
        description: null,
        type: 'image',
        is_default: false,
        is_enabled: true,
        sort_order: 2,
        points_cost: 32,
        usage_scope: 'all',
        is_visible_in_selector: true,
      },
      {
        id: 'agent-image',
        name: 'internal-agent-image',
        display_name: 'Internal Agent Image',
        provider: 'google',
        description: null,
        type: 'image',
        is_default: false,
        is_enabled: true,
        sort_order: 3,
        points_cost: 10,
        usage_scope: 'agent',
        is_visible_in_selector: true,
      },
    ];

    const query = createQueryChain(rows);

    vi.doMock('@/lib/supabase/client', () => ({
      supabase: {
        from: vi.fn(() => query),
      },
    }));

    const { fetchImageModels } = await import('@/lib/supabase/queries/models');
    const models = await fetchImageModels();

    expect(models.map((model) => model.name)).toEqual([
      'gemini-3-pro-image-preview',
      'seedream-4',
    ]);
  });
});

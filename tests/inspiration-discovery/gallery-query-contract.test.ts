import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
const authGetUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
    auth: { getUser: authGetUserMock },
    from: fromMock,
  },
}));

describe('inspiration-discovery gallery query contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls get_gallery_publications rpc with expected cursor/filter params', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    const { fetchGalleryPublications } = await import('@/lib/supabase/queries/publications');

    await fetchGalleryPublications({
      categorySlug: 'poster-design',
      searchQuery: 'poster',
      sortBy: 'popular',
      cursorPublishedAt: '2026-03-04T00:00:00.000Z',
      cursorId: 'pub-1',
      limit: 20,
    });

    expect(rpcMock).toHaveBeenCalledWith('get_gallery_publications', {
      p_category_slug: 'poster-design',
      p_search_query: 'poster',
      p_sort_by: 'popular',
      p_cursor_published_at: '2026-03-04T00:00:00.000Z',
      p_cursor_id: 'pub-1',
      p_limit: 20,
    });
  });
});

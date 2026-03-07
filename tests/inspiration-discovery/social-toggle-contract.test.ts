import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

describe('inspiration-discovery social toggle contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses toggle_like rpc in query layer', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    const { toggleLike } = await import('@/lib/supabase/queries/publications');

    const result = await toggleLike('pub-like-1');

    expect(result).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('toggle_like', { p_publication_id: 'pub-like-1' });
  });

  it('uses toggle_bookmark rpc in query layer', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });
    const { toggleBookmark } = await import('@/lib/supabase/queries/publications');

    const result = await toggleBookmark('pub-bookmark-1');

    expect(result).toBe(false);
    expect(rpcMock).toHaveBeenCalledWith('toggle_bookmark', { p_publication_id: 'pub-bookmark-1' });
  });
});

import { supabase } from '../client';

export interface GalleryPublication {
  id: string; title: string; description: string | null; cover_image_url: string;
  category_slug: string; category_name: string; tags: string[];
  view_count: number; like_count: number; comment_count: number; bookmark_count: number;
  published_at: string; user_id: string; display_name: string | null; avatar_url: string | null;
  canvas_width?: number | null; canvas_height?: number | null;
  status?: 'published' | 'hidden' | 'removed' | string;
}

export interface PublicationDetail {
  id: string; user_id: string; title: string; description: string | null;
  cover_image_url: string; category_id: string; tags: string[]; status: string;
  view_count: number; like_count: number; comment_count: number; bookmark_count: number;
  published_at: string; conversation_id: string;
  category: { name: string; slug: string } | null;
}

export interface PublicationSnapshot {
  messages_snapshot: Array<{ id: string; role: string; content: string; metadata: Record<string, unknown> | null; created_at: string }>;
  ops_snapshot: Array<{ id: string; op_type: string; payload: Record<string, unknown>; seq: number; created_at: string }>;
  canvas_state_snapshot: Record<string, unknown> | null;
  canvas_width: number | null; canvas_height: number | null;
}

export interface Category { id: string; name: string; slug: string; icon: string | null; sort_order: number; }

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('publication_categories').select('*').eq('is_active', true).order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function fetchGalleryPublications(params: {
  categorySlug?: string; searchQuery?: string; sortBy?: 'latest' | 'popular';
  cursorPublishedAt?: string; cursorId?: string; limit?: number;
}): Promise<GalleryPublication[]> {
  const { data, error } = await supabase.rpc('get_gallery_publications', {
    p_category_slug: params.categorySlug || null, p_search_query: params.searchQuery || null,
    p_sort_by: params.sortBy || 'latest', p_cursor_published_at: params.cursorPublishedAt || null,
    p_cursor_id: params.cursorId || null, p_limit: params.limit || 20,
  });
  if (error) throw error;
  return (data || []) as GalleryPublication[];
}

export async function fetchPublicationDetail(id: string): Promise<PublicationDetail | null> {
  const { data, error } = await supabase.from('publications').select('*, category:publication_categories(name, slug)').eq('id', id).single();
  if (error) { if (error.code === 'PGRST116') return null; throw error; }
  return data as unknown as PublicationDetail;
}

export async function fetchPublicationSnapshot(publicationId: string): Promise<PublicationSnapshot | null> {
  const { data, error } = await supabase.from('publication_snapshots').select('messages_snapshot, ops_snapshot, canvas_state_snapshot, canvas_width, canvas_height').eq('publication_id', publicationId).single();
  if (error) { if (error.code === 'PGRST116') return null; throw error; }
  return data as unknown as PublicationSnapshot;
}

export async function attachPublicationCanvasDimensions(publications: GalleryPublication[]): Promise<GalleryPublication[]> {
  if (publications.length === 0) return publications;

  const publicationIds = [...new Set(publications.map((publication) => publication.id))];
  const { data, error } = await supabase
    .from('publication_snapshots')
    .select('publication_id, canvas_width, canvas_height')
    .in('publication_id', publicationIds);

  if (error) {
    console.error('[Publications] Failed to load canvas dimensions:', error);
    return publications;
  }

  const dimensionMap = new Map(
    (data || []).map((row) => [
      row.publication_id,
      {
        canvas_width: row.canvas_width,
        canvas_height: row.canvas_height,
      },
    ]),
  );

  return publications.map((publication) => ({
    ...publication,
    canvas_width: dimensionMap.get(publication.id)?.canvas_width ?? null,
    canvas_height: dimensionMap.get(publication.id)?.canvas_height ?? null,
  }));
}

export async function publishConversation(params: { conversationId: string; title: string; description?: string; coverImageUrl: string; categoryId: string; tags?: string[] }): Promise<string> {
  const { data, error } = await supabase.rpc('publish_conversation', {
    p_conversation_id: params.conversationId, p_title: params.title,
    p_description: params.description || null, p_cover_image_url: params.coverImageUrl,
    p_category_id: params.categoryId, p_tags: params.tags || [],
  });
  if (error) throw error;
  return data as string;
}

export async function updatePublicationSnapshot(publicationId: string): Promise<void> {
  const { error } = await supabase.rpc('update_publication_snapshot', { p_publication_id: publicationId });
  if (error) throw error;
}

export async function updatePublication(id: string, updates: { title?: string; description?: string; category_id?: string; status?: 'published' | 'hidden'; cover_image_url?: string }): Promise<void> {
  const { error } = await supabase.from('publications').update(updates).eq('id', id);
  if (error) throw error;
}

export async function toggleLike(publicationId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_like', { p_publication_id: publicationId });
  if (error) throw error;
  return data as boolean;
}

export async function toggleBookmark(publicationId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_bookmark', { p_publication_id: publicationId });
  if (error) throw error;
  return data as boolean;
}

export async function incrementViewCount(publicationId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_view_count', { p_publication_id: publicationId });
  if (error) console.error('[Publications] Failed to increment view count:', error);
}

export async function checkUserInteractions(publicationIds: string[]): Promise<{ likedIds: Set<string>; bookmarkedIds: Set<string> }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { likedIds: new Set(), bookmarkedIds: new Set() };
  const [likesRes, bookmarksRes] = await Promise.all([
    supabase.from('publication_likes').select('publication_id').eq('user_id', user.id).in('publication_id', publicationIds),
    supabase.from('publication_bookmarks').select('publication_id').eq('user_id', user.id).in('publication_id', publicationIds),
  ]);
  return {
    likedIds: new Set((likesRes.data || []).map(l => l.publication_id)),
    bookmarkedIds: new Set((bookmarksRes.data || []).map(b => b.publication_id)),
  };
}

export async function fetchExistingPublication(conversationId: string): Promise<{ id: string; status: string } | null> {
  const { data, error } = await supabase.from('publications').select('id, status').eq('conversation_id', conversationId).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchRelatedPublications(params: { publicationId: string; userId: string; categoryId: string; limit?: number }): Promise<GalleryPublication[]> {
  const limit = params.limit ?? 4;

  const [sameAuthorRes, sameCategoryRes] = await Promise.all([
    supabase
      .from('publications')
      .select('id, title, description, cover_image_url, tags, status, view_count, like_count, comment_count, bookmark_count, published_at, user_id, category:publication_categories(slug, name)')
      .eq('status', 'published')
      .eq('user_id', params.userId)
      .neq('id', params.publicationId)
      .order('published_at', { ascending: false })
      .limit(limit),
    supabase
      .from('publications')
      .select('id, title, description, cover_image_url, tags, status, view_count, like_count, comment_count, bookmark_count, published_at, user_id, category:publication_categories(slug, name)')
      .eq('status', 'published')
      .eq('category_id', params.categoryId)
      .neq('id', params.publicationId)
      .order('published_at', { ascending: false })
      .limit(limit * 2),
  ]);

  if (sameAuthorRes.error) throw sameAuthorRes.error;
  if (sameCategoryRes.error) throw sameCategoryRes.error;

  const merged = [...(sameAuthorRes.data || []), ...(sameCategoryRes.data || [])];
  const userIds = [...new Set(merged.map((item) => item.user_id))];
  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('id, display_name, avatar_url')
    .in('id', userIds);
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const dedup = new Map<string, GalleryPublication>();

  for (const item of merged) {
    const profile = profileMap.get(item.user_id);
    const mapped: GalleryPublication = {
      id: item.id,
      title: item.title,
      description: item.description,
      cover_image_url: item.cover_image_url,
      category_slug: ((item.category as { slug?: string } | null)?.slug) || 'other',
      category_name: ((item.category as { name?: string } | null)?.name) || 'Other',
      tags: item.tags || [],
      status: item.status,
      view_count: item.view_count,
      like_count: item.like_count,
      comment_count: item.comment_count,
      bookmark_count: item.bookmark_count,
      published_at: item.published_at,
      user_id: item.user_id,
      display_name: profile?.display_name || null,
      avatar_url: profile?.avatar_url || null,
    };

    if (!dedup.has(mapped.id)) dedup.set(mapped.id, mapped);
    if (dedup.size >= limit) break;
  }

  return Array.from(dedup.values());
}

export async function fetchOwnPublications(params?: { status?: 'published' | 'hidden'; limit?: number }): Promise<GalleryPublication[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const query = supabase
    .from('publications')
    .select('id, title, description, cover_image_url, tags, status, view_count, like_count, comment_count, bookmark_count, published_at, user_id, category:publication_categories(slug, name)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(params?.limit || 50);

  if (params?.status) query.eq('status', params.status);

  const { data, error } = await query;
  if (error) throw error;

  const profile = await supabase.from('public_profiles').select('id, display_name, avatar_url').eq('id', user.id).maybeSingle();
  const displayName = profile.data?.display_name || null;
  const avatarUrl = profile.data?.avatar_url || null;

  return (data || []).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    cover_image_url: item.cover_image_url,
    category_slug: ((item.category as { slug?: string } | null)?.slug) || 'other',
    category_name: ((item.category as { name?: string } | null)?.name) || 'Other',
    tags: item.tags || [],
    status: item.status,
    view_count: item.view_count,
    like_count: item.like_count,
    comment_count: item.comment_count,
    bookmark_count: item.bookmark_count,
    published_at: item.published_at,
    user_id: item.user_id,
    display_name: displayName,
    avatar_url: avatarUrl,
  }));
}

export async function fetchMyBookmarkedPublications(limit = 50): Promise<GalleryPublication[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('publication_bookmarks')
    .select('created_at, publication:publications(id, title, description, cover_image_url, tags, view_count, like_count, comment_count, bookmark_count, published_at, user_id, category:publication_categories(slug, name), status)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = ((data || []).map((row) => row.publication).filter(Boolean) as unknown) as Array<Record<string, unknown>>;
  const userIds = [...new Set(rows.map((item) => item.user_id as string))];
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('public_profiles').select('id, display_name, avatar_url').in('id', userIds)
    : { data: [] as Array<{ id: string; display_name: string | null; avatar_url: string | null }> };
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  return rows
    .filter((item) => item.status === 'published')
    .map((item) => {
      const profile = profileMap.get(item.user_id as string);
      return {
        id: item.id as string,
        title: item.title as string,
        description: (item.description as string | null) || null,
        cover_image_url: item.cover_image_url as string,
        category_slug: (((item.category as { slug?: string } | null)?.slug) || 'other') as string,
        category_name: (((item.category as { name?: string } | null)?.name) || 'Other') as string,
        tags: (item.tags as string[]) || [],
        view_count: (item.view_count as number) || 0,
        like_count: (item.like_count as number) || 0,
        comment_count: (item.comment_count as number) || 0,
        bookmark_count: (item.bookmark_count as number) || 0,
        published_at: item.published_at as string,
        user_id: item.user_id as string,
        display_name: profile?.display_name || null,
        avatar_url: profile?.avatar_url || null,
      };
    });
}

export async function uploadCoverImage(file: File, publicationId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `covers/${publicationId}.${ext}`;
  const { error } = await supabase.storage.from('public-assets').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(path);
  return urlData.publicUrl;
}

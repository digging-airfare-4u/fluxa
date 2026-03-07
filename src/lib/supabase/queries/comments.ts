import { supabase } from '../client';

export interface Comment {
  id: string; publication_id: string; user_id: string; content: string;
  parent_id: string | null; created_at: string;
  author?: { display_name: string | null; avatar_url: string | null };
  replies?: Comment[];
}

export async function fetchComments(publicationId: string, params?: { limit?: number; offset?: number }): Promise<Comment[]> {
  const limit = params?.limit || 20;
  const offset = params?.offset || 0;
  const { data, error } = await supabase.from('publication_comments').select('*').eq('publication_id', publicationId).is('parent_id', null).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;
  const comments = data || [];
  if (comments.length === 0) return [];
  const commentIds = comments.map(c => c.id);
  const { data: replies } = await supabase.from('publication_comments').select('*').in('parent_id', commentIds).order('created_at', { ascending: true });
  const allUserIds = [...new Set([...comments.map(c => c.user_id), ...(replies || []).map(r => r.user_id)])];
  const { data: profiles } = await supabase.from('public_profiles').select('id, display_name, avatar_url').in('id', allUserIds);
  const profileMap = new Map((profiles || []).map(p => [p.id, p]));
  const repliesByParent = new Map<string, Comment[]>();
  for (const reply of (replies || [])) {
    const profile = profileMap.get(reply.user_id);
    const mapped: Comment = { ...reply, author: profile ? { display_name: profile.display_name, avatar_url: profile.avatar_url } : undefined };
    const existing = repliesByParent.get(reply.parent_id!) || [];
    existing.push(mapped);
    repliesByParent.set(reply.parent_id!, existing);
  }
  return comments.map(c => {
    const profile = profileMap.get(c.user_id);
    return { ...c, author: profile ? { display_name: profile.display_name, avatar_url: profile.avatar_url } : undefined, replies: repliesByParent.get(c.id) || [] };
  });
}

export async function createComment(params: { publicationId: string; content: string; parentId?: string }): Promise<Comment> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase.from('publication_comments').insert({ publication_id: params.publicationId, user_id: user.id, content: params.content, parent_id: params.parentId || null }).select().single();
  if (error) throw error;
  return data as Comment;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('publication_comments').delete().eq('id', commentId);
  if (error) throw error;
}

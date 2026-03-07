import { supabase } from '../client';

export interface FollowProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
  publication_count: number;
}

export async function followUser(followingId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('user_follows').insert({ follower_id: user.id, following_id: followingId });
  if (error) throw error;
}

export async function unfollowUser(followingId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', followingId);
  if (error) throw error;
}

export async function checkFollowStatus(followingId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('user_follows').select('follower_id').eq('follower_id', user.id).eq('following_id', followingId).maybeSingle();
  return !!data;
}

export async function fetchFollowers(userId: string, params?: { limit?: number; offset?: number }): Promise<FollowProfile[]> {
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;

  const { data, error } = await supabase
    .from('user_follows')
    .select('follower_id')
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  const ids = (data || []).map((row) => row.follower_id);
  if (ids.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('public_profiles')
    .select('*')
    .in('id', ids);

  if (profilesError) throw profilesError;
  const map = new Map((profiles || []).map((p) => [p.id, p as FollowProfile]));
  return ids.map((id) => map.get(id)).filter(Boolean) as FollowProfile[];
}

export async function fetchFollowing(userId: string, params?: { limit?: number; offset?: number }): Promise<FollowProfile[]> {
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;

  const { data, error } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  const ids = (data || []).map((row) => row.following_id);
  if (ids.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('public_profiles')
    .select('*')
    .in('id', ids);

  if (profilesError) throw profilesError;
  const map = new Map((profiles || []).map((p) => [p.id, p as FollowProfile]));
  return ids.map((id) => map.get(id)).filter(Boolean) as FollowProfile[];
}

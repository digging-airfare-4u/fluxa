import { supabase } from '../client';

export interface PublicProfile {
  id: string; display_name: string | null; avatar_url: string | null;
  bio: string | null; follower_count: number; following_count: number; publication_count: number;
}

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.from('public_profiles').select('*').eq('id', userId).single();
  if (error) { if (error.code === 'PGRST116') return null; throw error; }
  return data as PublicProfile;
}

export async function updateProfile(updates: { display_name?: string; bio?: string; avatar_url?: string }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('user_profiles').update(updates).eq('id', user.id);
  if (error) throw error;
}

export async function uploadAvatar(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const ext = file.name.split('.').pop() || 'png';
  const path = `avatars/${user.id}.${ext}`;
  const { error } = await supabase.storage.from('public-assets').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(path);
  await updateProfile({ avatar_url: urlData.publicUrl });
  return urlData.publicUrl;
}

'use client';
import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AuthDialog } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import { followUser, unfollowUser, checkFollowStatus } from '@/lib/supabase/queries/follows';
import { cn } from '@/lib/utils';
interface FollowButtonProps { userId: string; className?: string; }
export function FollowButton({ userId, className }: FollowButtonProps) {
  const t = useTranslations('common');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  useEffect(() => { checkFollowStatus(userId).then(s => { setIsFollowing(s); setIsLoading(false); }); }, [userId]);
  const handleToggle = useCallback(async () => {
    if (isLoading) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAuthOpen(true); return; }
    setIsLoading(true); const was = isFollowing; setIsFollowing(!was);
    try { if (was) await unfollowUser(userId); else await followUser(userId); } catch { setIsFollowing(was); } finally { setIsLoading(false); }
  }, [userId, isFollowing, isLoading]);
  return (<><Button variant={isFollowing ? 'outline' : 'default'} size="sm" className={cn("h-8 text-xs", className)} onClick={handleToggle} disabled={isLoading}>
    {isFollowing ? t('profile.following_btn') : t('profile.follow')}
  </Button><AuthDialog open={authOpen} onOpenChange={setAuthOpen} /></>);
}

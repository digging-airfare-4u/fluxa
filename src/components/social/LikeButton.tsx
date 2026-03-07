'use client';
import { useState, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthDialog } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import { toggleLike } from '@/lib/supabase/queries/publications';
import { useInteractionStore } from '@/lib/store/useInteractionStore';
import { cn } from '@/lib/utils';
interface LikeButtonProps { publicationId: string; initialCount: number; className?: string; showCount?: boolean; size?: 'sm' | 'default'; }
export function LikeButton({ publicationId, initialCount, className, showCount = true, size = 'default' }: LikeButtonProps) {
  const { isLiked, toggleLiked } = useInteractionStore();
  const liked = isLiked(publicationId);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const handleToggle = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); if (isLoading) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAuthOpen(true); return; }
    setIsLoading(true); toggleLiked(publicationId); setCount(prev => liked ? prev - 1 : prev + 1);
    try { await toggleLike(publicationId); } catch { toggleLiked(publicationId); setCount(prev => liked ? prev + 1 : prev - 1); } finally { setIsLoading(false); }
  }, [publicationId, liked, isLoading, toggleLiked]);
  return (<><Button variant="ghost" size={size === 'sm' ? 'sm' : 'default'} className={cn("gap-1.5", liked && "text-red-500 hover:text-red-600", className)} onClick={handleToggle}>
    <Heart className={cn(size === 'sm' ? 'size-3.5' : 'size-4', liked && "fill-current")} />{showCount && <span className="text-xs">{count}</span>}
  </Button><AuthDialog open={authOpen} onOpenChange={setAuthOpen} /></>);
}

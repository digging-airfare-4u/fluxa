'use client';
import { useState, useCallback } from 'react';
import { Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthDialog } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import { toggleBookmark } from '@/lib/supabase/queries/publications';
import { useInteractionStore } from '@/lib/store/useInteractionStore';
import { cn } from '@/lib/utils';
interface BookmarkButtonProps { publicationId: string; initialCount: number; className?: string; showCount?: boolean; size?: 'sm' | 'default'; }
export function BookmarkButton({ publicationId, initialCount, className, showCount = true, size = 'default' }: BookmarkButtonProps) {
  const { isBookmarked, toggleBookmarked } = useInteractionStore();
  const bookmarked = isBookmarked(publicationId);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const handleToggle = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); if (isLoading) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAuthOpen(true); return; }
    setIsLoading(true); toggleBookmarked(publicationId); setCount(prev => bookmarked ? prev - 1 : prev + 1);
    try { await toggleBookmark(publicationId); } catch { toggleBookmarked(publicationId); setCount(prev => bookmarked ? prev + 1 : prev - 1); } finally { setIsLoading(false); }
  }, [publicationId, bookmarked, isLoading, toggleBookmarked]);
  return (<><Button variant="ghost" size={size === 'sm' ? 'sm' : 'default'} className={cn("gap-1.5", bookmarked && "text-yellow-500 hover:text-yellow-600", className)} onClick={handleToggle}>
    <Bookmark className={cn(size === 'sm' ? 'size-3.5' : 'size-4', bookmarked && "fill-current")} />{showCount && <span className="text-xs">{count}</span>}
  </Button><AuthDialog open={authOpen} onOpenChange={setAuthOpen} /></>);
}

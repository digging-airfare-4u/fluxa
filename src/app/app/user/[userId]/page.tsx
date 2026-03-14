'use client';

/**
 * Creator Profile Page
 * Displays user profile with avatar, stats, follow button, and published works grid.
 */

import { use, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ArrowLeft, ImageOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchPublicProfile, type PublicProfile } from '@/lib/supabase/queries/profiles';
import { fetchGalleryPublications, checkUserInteractions, type GalleryPublication } from '@/lib/supabase/queries/publications';
import { FollowButton } from '@/components/social';
import { PublicationDetailDialog } from '@/components/discover';
import { PublicationCard } from '@/components/discover/PublicationCard';
import { useInteractionStore } from '@/lib/store/useInteractionStore';
import { supabase } from '@/lib/supabase/client';

const PAGE_SIZE = 20;

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();
  const t = useTranslations('common');

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [publications, setPublications] = useState<GalleryPublication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activePublicationId, setActivePublicationId] = useState<string | null>(null);
  const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);

  const { setLikedIds, setBookmarkedIds } = useInteractionStore();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setIsLoading(true);
        const [prof, pubs] = await Promise.all([
          fetchPublicProfile(userId),
          fetchGalleryPublications({ sortBy: 'latest', limit: PAGE_SIZE }),
        ]);
        if (!mounted) return;
        if (!prof) {
          setNotFound(true);
          return;
        }
        setProfile(prof);
        const userPubs = pubs.filter((p) => p.user_id === userId);
        setPublications(userPubs);
        setHasMore(pubs.length === PAGE_SIZE);

        if (userPubs.length > 0) {
          const interactions = await checkUserInteractions(userPubs.map((p) => p.id));
          if (mounted) {
            setLikedIds(interactions.likedIds);
            setBookmarkedIds(interactions.bookmarkedIds);
          }
        }
      } catch (e) {
        console.error('[UserProfile] Failed to load:', e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [userId, router, setLikedIds, setBookmarkedIds]);

  const handleOpenPublication = useCallback((publicationId: string) => {
    setActivePublicationId(publicationId);
    setIsPublicationDialogOpen(true);
  }, []);

  const loadMore = useCallback(async () => {
    if (isFetchingMore || !hasMore || publications.length === 0) return;
    setIsFetchingMore(true);
    try {
      const last = publications[publications.length - 1];
      const data = await fetchGalleryPublications({
        sortBy: 'latest',
        cursorPublishedAt: last.published_at,
        cursorId: last.id,
        limit: PAGE_SIZE,
      });
      const userPubs = data.filter((p) => p.user_id === userId);
      setPublications((prev) => [...prev, ...userPubs]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      console.error('[UserProfile] Failed to load more:', e);
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, hasMore, publications, userId]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0A1F] flex items-center justify-center">
        <div className="space-y-4 w-full max-w-sm text-center">
          <div className="size-20 rounded-full bg-muted animate-pulse mx-auto" />
          <div className="h-5 w-40 bg-muted animate-pulse rounded mx-auto" />
          <div className="h-4 w-60 bg-muted animate-pulse rounded mx-auto" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0A1F] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-foreground">{t('profile.user_not_found')}</h1>
          <Button className="mt-4" onClick={() => router.push('/app/discover')}>
            {t('discover.back_to_gallery')}
          </Button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0A1F]">
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-50 h-14 flex items-center gap-3 px-4 bg-[#FAFAFA]/80 dark:bg-[#0F0A1F]/80 backdrop-blur-lg border-b border-black/5 dark:border-white/5">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium text-foreground truncate">{profile.display_name || t('discover.anonymous')}</span>
      </header>

      <main className="pt-14 pb-16 max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Profile header */}
        <div className="flex flex-col items-center text-center py-10 space-y-4">
          {profile.avatar_url ? (
            <Image src={profile.avatar_url} alt="" width={80} height={80} className="size-20 rounded-full object-cover" unoptimized />
          ) : (
            <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {(profile.display_name || 'U')[0]}
            </div>
          )}

          <h1 className="text-xl font-bold text-foreground">{profile.display_name || t('discover.anonymous')}</h1>
          {profile.bio && <p className="text-sm text-muted-foreground max-w-md">{profile.bio}</p>}

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="font-semibold text-foreground">{profile.follower_count}</div>
              <div className="text-xs text-muted-foreground">{t('profile.followers')}</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-foreground">{profile.following_count}</div>
              <div className="text-xs text-muted-foreground">{t('profile.following')}</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-foreground">{profile.publication_count}</div>
              <div className="text-xs text-muted-foreground">{t('profile.publications')}</div>
            </div>
          </div>

          {currentUserId && currentUserId !== userId && <FollowButton userId={userId} />}
        </div>

        {/* Published works masonry */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">{t('profile.publications')}</h2>

          {publications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ImageOff className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">{t('profile.no_publications')}</p>
            </div>
          ) : (
            <div className="columns-2 sm:columns-3 md:columns-4 gap-4">
              {publications.map((pub) => (
                <PublicationCard key={pub.id} publication={pub} onOpenDetail={handleOpenPublication} />
              ))}
            </div>
          )}

          {hasMore && publications.length > 0 && (
            <div ref={sentinelRef} className="flex justify-center py-8">
              {isFetchingMore && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
            </div>
          )}
        </div>
      </main>

      <PublicationDetailDialog
        open={isPublicationDialogOpen}
        onOpenChange={setIsPublicationDialogOpen}
        publicationId={activePublicationId}
        onPublicationChange={setActivePublicationId}
      />
    </div>
  );
}

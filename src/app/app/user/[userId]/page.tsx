'use client';

/**
 * Creator Profile Page
 * Requirements: 5.1 - Display creator profile and published works
 *
 * Shows the public creator profile with discover-style editorial hero and masonry feed.
 */

import { use, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ArrowLeft, ImageOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchPublicProfile, type PublicProfile } from '@/lib/supabase/queries/profiles';
import {
  fetchGalleryPublications,
  checkUserInteractions,
  type GalleryPublication,
} from '@/lib/supabase/queries/publications';
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

        const userPubs = pubs.filter((publication) => publication.user_id === userId);

        setProfile(prof);
        setPublications(userPubs);
        setHasMore(pubs.length === PAGE_SIZE);

        if (userPubs.length > 0) {
          const interactions = await checkUserInteractions(userPubs.map((publication) => publication.id));

          if (!mounted) return;

          setLikedIds(interactions.likedIds);
          setBookmarkedIds(interactions.bookmarkedIds);
        }
      } catch (error) {
        console.error('[UserProfile] Failed to load:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [setBookmarkedIds, setLikedIds, userId]);

  const handleOpenPublication = useCallback((publicationId: string) => {
    setActivePublicationId(publicationId);
    setIsPublicationDialogOpen(true);
  }, []);

  const loadMore = useCallback(async () => {
    if (isFetchingMore || !hasMore || publications.length === 0) return;

    setIsFetchingMore(true);

    try {
      const lastPublication = publications[publications.length - 1];
      const nextBatch = await fetchGalleryPublications({
        sortBy: 'latest',
        cursorPublishedAt: lastPublication.published_at,
        cursorId: lastPublication.id,
        limit: PAGE_SIZE,
      });

      const userPubs = nextBatch.filter((publication) => publication.user_id === userId);
      setPublications((previous) => [...previous, ...userPubs]);
      setHasMore(nextBatch.length === PAGE_SIZE);
    } catch (error) {
      console.error('[UserProfile] Failed to load more:', error);
    } finally {
      setIsFetchingMore(false);
    }
  }, [hasMore, isFetchingMore, publications, userId]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '220px' },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadMore]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F3EE] dark:bg-[#0F0A1F]">
        <div className="w-full max-w-sm space-y-4 px-6 text-center">
          <div className="mx-auto size-20 animate-pulse rounded-full bg-muted" />
          <div className="mx-auto h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="mx-auto h-4 w-60 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F3EE] px-6 dark:bg-[#0F0A1F]">
        <div className="max-w-md text-center">
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
    <div className="min-h-screen bg-[#F6F3EE] dark:bg-[#0F0A1F]">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[22rem] bg-[radial-gradient(circle_at_top_left,_rgba(233,210,181,0.4),_transparent_44%),radial-gradient(circle_at_top_right,_rgba(186,214,255,0.22),_transparent_32%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(134,85,220,0.2),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(52,116,255,0.14),_transparent_28%)]" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-[#F6F3EE]/78 backdrop-blur-xl dark:border-white/5 dark:bg-[#0F0A1F]/82">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
              <ArrowLeft className="size-4" />
            </Button>
            <span className="truncate text-sm font-medium text-foreground">
              {profile.display_name || t('discover.anonymous')}
            </span>
          </div>
        </div>
      </header>

      <main className="relative px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px] space-y-8">
          <section className="rounded-[32px] border border-black/5 bg-white/82 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center lg:max-w-3xl">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt=""
                    width={92}
                    height={92}
                    className="size-[92px] rounded-full object-cover ring-4 ring-white/80 dark:ring-white/10"
                    unoptimized
                  />
                ) : (
                  <div className="flex size-[92px] items-center justify-center rounded-full bg-[#1E1A16]/6 text-3xl font-semibold text-[#1E1A16] ring-4 ring-white/80 dark:bg-white/10 dark:text-white dark:ring-white/10">
                    {(profile.display_name || 'U')[0]}
                  </div>
                )}

                <div className="space-y-3">
                  <div className="space-y-1">
                    <h1 className="text-[2rem] font-semibold tracking-tight text-[#1E1A16] dark:text-white sm:text-[2.35rem]">
                      {profile.display_name || t('discover.anonymous')}
                    </h1>
                    {profile.bio ? (
                      <p className="max-w-2xl text-sm leading-6 text-[#746C62] dark:text-white/60">
                        {profile.bio}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm">
                    <div className="rounded-full bg-[#F4EEE5] px-4 py-2 text-[#4D473F] dark:bg-white/8 dark:text-white/70">
                      <span className="font-semibold text-[#1E1A16] dark:text-white">{profile.follower_count}</span>{' '}
                      {t('profile.followers')}
                    </div>
                    <div className="rounded-full bg-[#F4EEE5] px-4 py-2 text-[#4D473F] dark:bg-white/8 dark:text-white/70">
                      <span className="font-semibold text-[#1E1A16] dark:text-white">{profile.following_count}</span>{' '}
                      {t('profile.following')}
                    </div>
                    <div className="rounded-full bg-[#F4EEE5] px-4 py-2 text-[#4D473F] dark:bg-white/8 dark:text-white/70">
                      <span className="font-semibold text-[#1E1A16] dark:text-white">{profile.publication_count}</span>{' '}
                      {t('profile.publications')}
                    </div>
                  </div>
                </div>
              </div>

              {currentUserId && currentUserId !== userId ? (
                <div className="self-start lg:self-end">
                  <FollowButton userId={userId} />
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-[#1E1A16] dark:text-white">
                {t('profile.publications')}
              </h2>
              <p className="text-sm text-[#7B7469] dark:text-white/60">
                {profile.display_name || t('discover.anonymous')} {t('discover.browse_subtitle')}
              </p>
            </div>

            {publications.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-black/10 bg-white/72 px-6 py-16 text-center dark:border-white/10 dark:bg-white/5">
                <ImageOff className="mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t('profile.no_publications')}</p>
              </div>
            ) : (
              <div className="mt-6 columns-1 md:columns-2 xl:columns-3 gap-6">
                {publications.map((pub) => (
                  <PublicationCard
                    key={pub.id}
                    publication={pub}
                    onOpenDetail={handleOpenPublication}
                    layout="discover"
                  />
                ))}
              </div>
            )}

            {hasMore && publications.length > 0 ? (
              <div ref={sentinelRef} className="flex justify-center py-8">
                {isFetchingMore ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : null}
              </div>
            ) : null}
          </section>
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

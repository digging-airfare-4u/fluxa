'use client';

/**
 * Publication Detail Page
 * Displays a published work with cover, metadata, conversation replay, and social interactions.
 */

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Eye, Heart, Bookmark, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  fetchPublicationDetail,
  fetchPublicationSnapshot,
  fetchRelatedPublications,
  incrementViewCount,
  checkUserInteractions,
  type PublicationDetail,
  type PublicationSnapshot,
  type GalleryPublication,
} from '@/lib/supabase/queries/publications';
import { fetchPublicProfile, type PublicProfile } from '@/lib/supabase/queries/profiles';
import { LikeButton, BookmarkButton, CommentSection, FollowButton } from '@/components/social';
import { PublicationCard } from '@/components/discover/PublicationCard';
import { useInteractionStore } from '@/lib/store/useInteractionStore';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export default function PublicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations('common');

  const [publication, setPublication] = useState<PublicationDetail | null>(null);
  const [snapshot, setSnapshot] = useState<PublicationSnapshot | null>(null);
  const [author, setAuthor] = useState<PublicProfile | null>(null);
  const [relatedWorks, setRelatedWorks] = useState<GalleryPublication[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const { setLikedIds, setBookmarkedIds } = useInteractionStore();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setIsLoading(true);
        const [pub, snap] = await Promise.all([fetchPublicationDetail(id), fetchPublicationSnapshot(id)]);
        if (!mounted) return;
        if (!pub) {
          setNotFound(true);
          return;
        }
        setPublication(pub);
        setSnapshot(snap);

        const [profile, interactions, related] = await Promise.all([
          fetchPublicProfile(pub.user_id),
          checkUserInteractions([pub.id]),
          fetchRelatedPublications({
            publicationId: pub.id,
            userId: pub.user_id,
            categoryId: pub.category_id,
            limit: 4,
          }),
        ]);
        if (!mounted) return;
        setAuthor(profile);
        setRelatedWorks(related);
        setLikedIds(interactions.likedIds);
        setBookmarkedIds(interactions.bookmarkedIds);

        incrementViewCount(pub.id);
      } catch (e) {
        console.error('[PublicationDetail] Failed to load:', e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id, router, setLikedIds, setBookmarkedIds]);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0A1F] flex items-center justify-center">
        <div className="space-y-4 w-full max-w-2xl px-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="aspect-video w-full bg-muted animate-pulse rounded-xl" />
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0A1F] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-foreground">{t('discover.not_found')}</h1>
          <p className="text-sm text-muted-foreground mt-2">{t('discover.not_found_description')}</p>
          <Button className="mt-4" onClick={() => router.push('/app/discover')}>
            {t('discover.back_to_gallery')}
          </Button>
        </div>
      </div>
    );
  }

  if (!publication) return null;

  const messages = snapshot?.messages_snapshot ?? [];

  const extractMessageImages = (metadata: Record<string, unknown> | null): string[] => {
    if (!metadata) return [];
    const urls: string[] = [];

    const imageUrl = metadata.imageUrl;
    if (typeof imageUrl === 'string') urls.push(imageUrl);

    const images = metadata.images;
    if (Array.isArray(images)) {
      for (const item of images) {
        if (typeof item === 'string') urls.push(item);
        if (item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string') {
          urls.push((item as { url: string }).url);
        }
      }
    }

    const op = metadata.op;
    if (op && typeof op === 'object') {
      const payload = (op as { payload?: unknown }).payload;
      if (payload && typeof payload === 'object') {
        const src = (payload as { src?: unknown }).src;
        if (typeof src === 'string') urls.push(src);
      }
    }

    return [...new Set(urls)];
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0A1F]">
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-50 h-14 flex items-center gap-3 px-4 bg-[#FAFAFA]/80 dark:bg-[#0F0A1F]/80 backdrop-blur-lg border-b border-black/5 dark:border-white/5">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium text-foreground truncate">{publication.title}</span>
      </header>

      <main className="pt-14 pb-16 max-w-3xl mx-auto px-4 sm:px-6">
        {/* Cover image */}
        <div className="relative w-full mt-6 rounded-xl overflow-hidden bg-muted">
          <Image
            src={publication.cover_image_url}
            alt={publication.title}
            width={800}
            height={600}
            unoptimized
            className="w-full h-auto object-cover"
          />
        </div>

        {/* Title and metadata */}
        <div className="mt-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">{publication.title}</h1>
              {publication.category && (
                <Badge variant="secondary">{publication.category.name}</Badge>
              )}
            </div>
          </div>

          {publication.description && (
            <p className="text-sm text-muted-foreground">{publication.description}</p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              {formatDate(publication.published_at)}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="size-3.5" />
              {publication.view_count}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="size-3.5" />
              {publication.like_count}
            </span>
            <span className="flex items-center gap-1">
              <Bookmark className="size-3.5" />
              {publication.bookmark_count}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 border-y border-black/5 dark:border-white/5 py-3">
            <LikeButton publicationId={publication.id} initialCount={publication.like_count} />
            <BookmarkButton publicationId={publication.id} initialCount={publication.bookmark_count} />
          </div>
        </div>

        {/* Author card */}
        {author && (
          <div className="mt-6 p-4 rounded-xl bg-white dark:bg-[#1A1028] border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-3">
              <Link href={`/app/user/${author.id}`}>
                {author.avatar_url ? (
                  <Image src={author.avatar_url} alt="" width={44} height={44} className="size-11 rounded-full object-cover" unoptimized />
                ) : (
                  <div className="size-11 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium text-primary">
                    {(author.display_name || 'U')[0]}
                  </div>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/app/user/${author.id}`} className="text-sm font-semibold hover:underline">
                  {author.display_name || t('discover.anonymous')}
                </Link>
                {author.bio && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{author.bio}</p>}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{author.follower_count} {t('profile.followers')}</span>
                  <span>{author.publication_count} {t('profile.publications')}</span>
                </div>
              </div>
              {currentUserId && currentUserId !== author.id && <FollowButton userId={author.id} />}
            </div>
          </div>
        )}

        {/* Conversation replay */}
        {messages.length > 0 && (
          <div className="mt-8 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{t('discover.conversation_replay')}</h2>
            <div className="space-y-3">
              {messages.map((msg) => {
                const images = extractMessageImages(msg.metadata);
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'p-3 rounded-xl text-sm max-w-[85%] space-y-2',
                      msg.role === 'user'
                        ? 'ml-auto bg-primary text-primary-foreground'
                        : 'bg-white dark:bg-[#1A1028] border border-black/5 dark:border-white/5',
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {images.length > 0 && (
                      <div className="grid grid-cols-1 gap-2">
                        {images.map((url, index) => (
                          <div key={`${msg.id}-${index}`} className="relative w-full rounded-lg overflow-hidden bg-muted">
                            <Image src={url} alt="" width={800} height={600} className="w-full h-auto object-cover" unoptimized />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="mt-8">
          <CommentSection publicationId={publication.id} publicationOwnerId={publication.user_id} commentCount={publication.comment_count} />
        </div>

        {relatedWorks.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-foreground mb-4">{t('discover.related_works')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {relatedWorks.map((item) => (
                <PublicationCard key={item.id} publication={item} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

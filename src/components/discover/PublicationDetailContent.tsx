'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, Heart, Bookmark, Calendar } from 'lucide-react';
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
import { PublicationCard } from './PublicationCard';
import { useInteractionStore } from '@/lib/store/useInteractionStore';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface PublicationDetailContentProps {
  publicationId: string;
  onOpenPublication: (publicationId: string) => void;
}

function extractMessageImages(metadata: Record<string, unknown> | null): string[] {
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
}

export function PublicationDetailContent({ publicationId, onOpenPublication }: PublicationDetailContentProps) {
  const t = useTranslations('common');

  const [publication, setPublication] = useState<PublicationDetail | null>(null);
  const [snapshot, setSnapshot] = useState<PublicationSnapshot | null>(null);
  const [author, setAuthor] = useState<PublicProfile | null>(null);
  const [relatedWorks, setRelatedWorks] = useState<GalleryPublication[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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
        setNotFound(false);
        setLoadError(null);
        setPublication(null);
        setSnapshot(null);
        setAuthor(null);
        setRelatedWorks([]);

        const [pub, snap] = await Promise.all([
          fetchPublicationDetail(publicationId),
          fetchPublicationSnapshot(publicationId),
        ]);

        if (!mounted) return;

        if (!pub) {
          setPublication(null);
          setSnapshot(null);
          setAuthor(null);
          setRelatedWorks([]);
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
      } catch (error) {
        console.error('[PublicationDetailContent] Failed to load:', error);
        if (!mounted) return;
        setLoadError(t('discover.load_error'));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [publicationId, setBookmarkedIds, setLikedIds]);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  if (isLoading) {
    return (
      <div className="max-h-[90vh] overflow-y-auto">
        <div className="space-y-4 px-6 py-6 sm:px-8">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="aspect-video w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-10 text-center sm:px-8">
          <h1 className="text-xl font-semibold text-foreground">{t('discover.not_found')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('discover.not_found_description')}</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-10 sm:px-8">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <h1 className="text-base font-semibold text-foreground">{t('discover.load_error_title')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!publication) return null;

  const messages = snapshot?.messages_snapshot ?? [];

  return (
    <div className="max-h-[90vh] overflow-y-auto bg-[#FAFAFA] dark:bg-[#0F0A1F]">
      <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="relative w-full rounded-xl overflow-hidden bg-muted">
          <Image
            src={publication.cover_image_url}
            alt={publication.title}
            width={800}
            height={600}
            unoptimized
            className="w-full h-auto object-cover"
          />
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">{publication.title}</h1>
              {publication.category && <Badge variant="secondary">{publication.category.name}</Badge>}
            </div>
          </div>

          {publication.description && (
            <p className="text-sm text-muted-foreground">{publication.description}</p>
          )}

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

          <div className="flex items-center gap-2 border-y border-black/5 dark:border-white/5 py-3">
            <LikeButton publicationId={publication.id} initialCount={publication.like_count} />
            <BookmarkButton publicationId={publication.id} initialCount={publication.bookmark_count} />
          </div>
        </div>

        {author && (
          <div className="mt-6 rounded-xl border border-black/5 bg-white p-4 dark:border-white/5 dark:bg-[#1A1028]">
            <div className="flex items-center gap-3">
              <Link href={`/app/user/${author.id}`}>
                {author.avatar_url ? (
                  <Image
                    src={author.avatar_url}
                    alt=""
                    width={44}
                    height={44}
                    className="size-11 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-lg font-medium text-primary">
                    {(author.display_name || 'U')[0]}
                  </div>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/app/user/${author.id}`} className="text-sm font-semibold hover:underline">
                  {author.display_name || t('discover.anonymous')}
                </Link>
                {author.bio && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{author.bio}</p>}
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{author.follower_count} {t('profile.followers')}</span>
                  <span>{author.publication_count} {t('profile.publications')}</span>
                </div>
              </div>
              {currentUserId && currentUserId !== author.id ? <FollowButton userId={author.id} /> : null}
            </div>
          </div>
        )}

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

        <div className="mt-8">
          <CommentSection
            publicationId={publication.id}
            publicationOwnerId={publication.user_id}
            commentCount={publication.comment_count}
          />
        </div>

        {relatedWorks.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-sm font-semibold text-foreground">{t('discover.related_works')}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {relatedWorks.map((item) => (
                <PublicationCard key={item.id} publication={item} onOpenDetail={onOpenPublication} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, Heart, Bookmark, Calendar, ChevronLeft, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
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
import { createProject } from '@/lib/supabase/queries/projects';
import {
  findLatestRemixSourceMessage,
  buildRemixPrompt,
  buildRemixEditorUrl,
} from '@/lib/discover/remix';
import { trackDiscoverRemixEvent } from '@/lib/observability/discover';
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

function ImageCarousel({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState<Set<number>>(new Set());

  if (images.length === 0) return null;

  const prev = () => setCurrent((c) => (c - 1 + images.length) % images.length);
  const next = () => setCurrent((c) => (c + 1) % images.length);

  return (
    <div className="relative w-full bg-black/5 dark:bg-white/5 rounded-xl overflow-hidden">
      <div className="relative aspect-[4/3] w-full">
        <Image
          key={images[current]}
          src={images[current]}
          alt=""
          fill
          unoptimized
          className={cn(
            'object-contain transition-opacity duration-200',
            loaded.has(current) ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={() => setLoaded((s) => new Set(s).add(current))}
        />
        {!loaded.has(current) && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={cn(
                  'size-1.5 rounded-full transition-all',
                  i === current ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
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
  const [isRemixing, setIsRemixing] = useState(false);
  const remixInFlightRef = useRef(false);
  const isMountedRef = useRef(true);

  const { setLikedIds, setBookmarkedIds } = useInteractionStore();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
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

  const handleRemix = useCallback(async () => {
    if (!publication || remixInFlightRef.current) return;

    remixInFlightRef.current = true;
    const newTab = window.open('about:blank', '_blank');
    try {
      setIsRemixing(true);
      trackDiscoverRemixEvent('discover_remix_click', {
        entry: 'detail',
        publicationId: publication.id,
      });

      const prompt = buildRemixPrompt({
        title: publication.title,
        categoryName: publication.category?.name,
        tags: publication.tags,
        description: publication.description,
        messages: snapshot?.messages_snapshot,
      });

      const { project } = await createProject();

      trackDiscoverRemixEvent('discover_remix_project_created', {
        entry: 'detail',
        publicationId: publication.id,
        projectId: project.id,
      });

      const remixUrl = buildRemixEditorUrl({
        projectId: project.id,
        prompt,
        entry: 'detail',
        publicationId: publication.id,
      });

      if (newTab) {
        newTab.location.href = remixUrl;
      }
    } catch (error) {
      newTab?.close();
      console.error('[PublicationDetailContent] Failed to remix:', error);
      toast.error(t('discover.remix_failed'));
    } finally {
      remixInFlightRef.current = false;
      if (isMountedRef.current) {
        setIsRemixing(false);
      }
    }
  }, [publication, snapshot, t]);

  // Collect all images: cover + images from conversation messages
  const allImages = useMemo(() => {
    const imgs: string[] = [];
    if (publication?.cover_image_url) imgs.push(publication.cover_image_url);
    const messages = snapshot?.messages_snapshot ?? [];
    for (const msg of messages) {
      imgs.push(...extractMessageImages(msg.metadata));
    }
    return [...new Set(imgs)];
  }, [publication, snapshot]);

  const promptMessage = useMemo(
    () => findLatestRemixSourceMessage(snapshot?.messages_snapshot ?? []),
    [snapshot],
  );

  if (isLoading) {
    return (
      <div className="flex h-[85vh]">
        <div className="flex-1 p-6 space-y-4">
          <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        </div>
        <div className="w-[340px] border-l border-black/5 dark:border-white/5 p-6 space-y-4">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2 animate-pulse">
              <div className="size-7 rounded-full bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-20 bg-muted rounded" />
                <div className="h-4 w-3/4 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex items-center justify-center h-[85vh]">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">{t('discover.not_found')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('discover.not_found_description')}</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-[85vh]">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
          <h1 className="text-base font-semibold text-foreground">{t('discover.load_error_title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!publication) return null;

  return (
    <div className="flex h-[85vh] bg-[#FAFAFA] dark:bg-[#0F0A1F] rounded-lg overflow-hidden">
      {/* Left column: images + info */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="p-5 sm:p-6 space-y-5">
          <ImageCarousel images={allImages} />

          {/* Title + category */}
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">{publication.title}</h1>
            {publication.category && <Badge variant="secondary">{publication.category.name}</Badge>}
          </div>

          {publication.description && (
            <p className="text-sm text-muted-foreground">{publication.description}</p>
          )}

          {promptMessage?.content && (
            <div className="rounded-xl border border-black/5 bg-white p-4 dark:border-white/5 dark:bg-[#1A1028]">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('discover.prompt_label')}
              </h2>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                {promptMessage.content}
              </p>
            </div>
          )}

          {/* Stats + actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
            <div className="flex items-center gap-2">
              <LikeButton publicationId={publication.id} initialCount={publication.like_count} />
              <BookmarkButton publicationId={publication.id} initialCount={publication.bookmark_count} />
              <button
                type="button"
                disabled={isRemixing}
                aria-busy={isRemixing}
                aria-label={isRemixing ? t('actions.loading') : t('discover.remix_cta')}
                onClick={handleRemix}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 text-sm font-medium text-[#444] transition-all hover:border-black/20 hover:shadow-sm dark:border-white/10 dark:bg-[#1A1028] dark:text-[#AAA] dark:hover:border-white/20',
                  isRemixing && 'cursor-not-allowed opacity-60',
                )}
              >
                {isRemixing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {t('discover.remix_cta')}
              </button>
            </div>
          </div>

          {/* Author */}
          {author && (
            <div className="rounded-xl border border-black/5 bg-white p-4 dark:border-white/5 dark:bg-[#1A1028]">
              <div className="flex items-center gap-3">
                <Link href={`/app/user/${author.id}`}>
                  {author.avatar_url ? (
                    <Image
                      src={author.avatar_url}
                      alt=""
                      width={40}
                      height={40}
                      className="size-10 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-base font-medium text-primary">
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

          {/* Related works */}
          {relatedWorks.length > 0 && (
            <div className="pt-2">
              <h2 className="mb-4 text-base font-semibold tracking-tight text-foreground">{t('discover.related_works')}</h2>
              <div className="columns-1 md:columns-2 gap-5">
                {relatedWorks.map((item) => (
                  <PublicationCard
                    key={item.id}
                    publication={item}
                    onOpenDetail={onOpenPublication}
                    layout="discover"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right column: comments */}
      <div className="w-[340px] shrink-0 border-l border-black/5 dark:border-white/5 flex flex-col bg-white dark:bg-[#1A1028]">
        <div className="flex-1 overflow-y-auto p-5">
          <CommentSection
            publicationId={publication.id}
            publicationOwnerId={publication.user_id}
            commentCount={publication.comment_count}
          />
        </div>
      </div>
    </div>
  );
}

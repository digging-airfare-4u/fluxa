'use client';

/**
 * Discovery Gallery Page
 * Content-first inspiration browsing with category navigation and remix actions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ImageOff, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  attachPublicationCanvasDimensions,
  fetchGalleryPublications,
  fetchCategories,
  fetchPublicationSnapshot,
  type GalleryPublication,
  type Category,
} from '@/lib/supabase/queries/publications';
import { checkUserInteractions } from '@/lib/supabase/queries/publications';
import { createProject } from '@/lib/supabase/queries/projects';
import { buildRemixPrompt, buildRemixEditorUrl } from '@/lib/inspiration/remix';
import { trackDiscoverRemixEvent } from '@/lib/observability/discover';
import { PublicationCard, PublicationDetailDialog } from '@/components/discover';
import { ResponsiveMasonry } from '@/components/discover/ResponsiveMasonry';
import { PointsBalanceIndicator } from '@/components/points';
import { UserPopover } from '@/components/layout';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useInteractionStore } from '@/lib/store/useInteractionStore';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 500;
const DISCOVER_SKELETON_HEIGHTS = ['h-[24rem]', 'h-[16rem]', 'h-[22rem]', 'h-[28rem]'] as const;

export default function DiscoverPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('common');

  const paramSearch = searchParams.get('q') ?? '';
  const paramSort = (searchParams.get('sort') as 'latest' | 'popular') || 'latest';
  const paramCategory = searchParams.get('category') ?? '';

  const [search, setSearch] = useState(paramSearch);
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>(paramSort);
  const [categorySlug, setCategorySlug] = useState(paramCategory);
  const [categories, setCategories] = useState<Category[]>([]);
  const [publications, setPublications] = useState<GalleryPublication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(Boolean(paramSearch));
  const [remixingPublicationId, setRemixingPublicationId] = useState<string | null>(null);
  const [activePublicationId, setActivePublicationId] = useState<string | null>(null);
  const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);

  const { setLikedIds, setBookmarkedIds } = useInteractionStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useRef(paramSearch);
  const publicationsRef = useRef<GalleryPublication[]>([]);
  const remixInFlightRef = useRef(false);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });

      const nextQuery = params.toString();
      router.replace(nextQuery ? `/app/discover?${nextQuery}` : '/app/discover', { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((error) => console.error('[Discover] Failed to load categories:', error));
  }, []);

  const loadPublications = useCallback(
    async (append = false, cursor?: { publishedAt: string; id: string }) => {
      try {
        if (!append) setIsLoading(true);
        else setIsFetchingMore(true);

        const data = await fetchGalleryPublications({
          categorySlug: categorySlug || undefined,
          searchQuery: debouncedSearch.current || undefined,
          sortBy,
          cursorPublishedAt: cursor?.publishedAt,
          cursorId: cursor?.id,
          limit: PAGE_SIZE,
        });

        const publicationsWithDimensions = await attachPublicationCanvasDimensions(data);

        const nextPublications = append
          ? [...publicationsRef.current, ...publicationsWithDimensions]
          : publicationsWithDimensions;

        setPublications((previous) => {
          if (!append) return publicationsWithDimensions;
          return [...previous, ...publicationsWithDimensions];
        });
        publicationsRef.current = nextPublications;
        setHasMore(data.length === PAGE_SIZE);

        const publicationIds = nextPublications.map((publication) => publication.id);
        if (publicationIds.length > 0) {
          checkUserInteractions(publicationIds).then(({ likedIds, bookmarkedIds }) => {
            setLikedIds(likedIds);
            setBookmarkedIds(bookmarkedIds);
          });
        }
      } catch (error) {
        console.error('[Discover] Failed to load publications:', error);
      } finally {
        setIsLoading(false);
        setIsFetchingMore(false);
      }
    },
    [categorySlug, sortBy, setLikedIds, setBookmarkedIds],
  );

  useEffect(() => {
    loadPublications(false);
  }, [categorySlug, sortBy, loadPublications]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debouncedSearch.current = value;
        updateParams({ q: value });
        loadPublications(false);
      }, DEBOUNCE_MS);
    },
    [updateParams, loadPublications],
  );

  const handleSearchToggle = useCallback(() => {
    setIsSearchExpanded((current) => !current);
  }, []);

  const handleSortChange = useCallback(
    (next: 'latest' | 'popular') => {
      if (next === sortBy) return;
      setSortBy(next);
      updateParams({ sort: next });
    },
    [sortBy, updateParams],
  );

  const handleCategoryChange = useCallback(
    (slug: string) => {
      const next = slug === categorySlug ? '' : slug;
      setCategorySlug(next);
      updateParams({ category: next });
    },
    [categorySlug, updateParams],
  );

  const handleOpenPublication = useCallback((publicationId: string) => {
    setActivePublicationId(publicationId);
    setIsPublicationDialogOpen(true);
  }, []);

  const handleRemixFromCard = useCallback(async (publication: GalleryPublication) => {
    if (remixInFlightRef.current) return;

    remixInFlightRef.current = true;

    try {
      setRemixingPublicationId(publication.id);
      trackDiscoverRemixEvent('discover_remix_click', {
        entry: "card",
        publicationId: publication.id,
      });

      const snapshot = await fetchPublicationSnapshot(publication.id);
      const prompt = buildRemixPrompt({
        title: publication.title,
        categoryName: publication.category_name,
        tags: publication.tags,
        description: publication.description,
        messages: snapshot?.messages_snapshot,
      });

      const { project } = await createProject();
      trackDiscoverRemixEvent('discover_remix_project_created', {
        entry: "card",
        publicationId: publication.id,
        projectId: project.id,
      });

      const remixUrl = buildRemixEditorUrl({
        projectId: project.id,
        prompt,
        entry: "card",
        publicationId: publication.id,
      });

      router.push(remixUrl);
    } catch (error) {
      console.error('[Discover] Failed to remix from card:', error);
      toast.error(t('discover.remix_failed'));
    } finally {
      remixInFlightRef.current = false;
      setRemixingPublicationId(null);
    }
  }, [router, t]);

  const loadMore = useCallback(() => {
    if (isFetchingMore || !hasMore || publications.length === 0) return;
    const lastPublication = publications[publications.length - 1];
    loadPublications(true, {
      publishedAt: lastPublication.published_at,
      id: lastPublication.id,
    });
  }, [isFetchingMore, hasMore, publications, loadPublications]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '240px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasActiveFilters = Boolean(search.trim() || categorySlug);

  return (
    <div className="min-h-screen bg-[#F6F3EE] dark:bg-[#0F0A1F]">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[26rem] bg-[radial-gradient(circle_at_top_left,_rgba(233,210,181,0.42),_transparent_45%),radial-gradient(circle_at_top_right,_rgba(186,214,255,0.26),_transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(134,85,220,0.2),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(52,116,255,0.14),_transparent_30%)]" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-[#F6F3EE]/78 backdrop-blur-xl dark:border-white/5 dark:bg-[#0F0A1F]/82">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <button onClick={() => router.push('/app')} className="shrink-0">
            <Image
              src="/logo.png"
              alt={t('accessibility.logo_alt')}
              width={32}
              height={32}
              className="size-8 rounded-xl"
            />
          </button>

          <div className="flex items-center gap-2">
            <PointsBalanceIndicator />
            <LanguageSwitcher />
            <ThemeToggle />
            <UserPopover />
          </div>
        </div>
      </header>

      <main className="relative px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <section className="space-y-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <h1 className="text-[2rem] font-semibold tracking-tight text-[#1E1A16] dark:text-white sm:text-[2.5rem]">
                  {t('discover.title')}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-[#7B7469] dark:text-white/60">
                  {t('discover.browse_subtitle')}
                </p>
              </div>

              <div className="flex items-center gap-2 self-start lg:self-auto">
                <div className="inline-flex rounded-full bg-white/85 p-1 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-white/5 dark:ring-white/10">
                  {(['latest', 'popular'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleSortChange(option)}
                      className={cn(
                        'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                        sortBy === option
                          ? 'bg-[#1E1A16] text-white dark:bg-white dark:text-[#140D21]'
                          : 'text-[#7B7469] hover:text-[#1E1A16] dark:text-white/60 dark:hover:text-white',
                      )}
                    >
                      {option === 'latest' ? t('discover.sort_latest') : t('discover.sort_popular')}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSearchToggle}
                  aria-label={t('discover.search_placeholder')}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/85 text-[#4B463F] shadow-sm ring-1 ring-black/5 backdrop-blur transition-colors hover:text-[#1E1A16] dark:bg-white/5 dark:text-white/70 dark:ring-white/10 dark:hover:text-white"
                >
                  <Search className="size-4" />
                </button>
              </div>
            </div>

            {isSearchExpanded ? (
              <div className="rounded-[28px] border border-black/5 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                <div className="relative max-w-xl">
                  <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8E887F] dark:text-white/45" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    placeholder={t('discover.search_placeholder')}
                    className="h-12 w-full rounded-[20px] border border-black/8 bg-[#F9F7F2] pl-11 pr-4 text-sm text-[#1E1A16] outline-none transition-shadow focus:ring-2 focus:ring-black/10 dark:border-white/10 dark:bg-[#1B112A] dark:text-white dark:focus:ring-white/10"
                  />
                </div>
              </div>
            ) : null}

            {categories.length > 0 ? (
              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-max items-center gap-5 text-sm">
                  <button
                    type="button"
                    onClick={() => handleCategoryChange('')}
                    className={cn(
                      'whitespace-nowrap rounded-xl px-4 py-2 font-medium transition-colors',
                      !categorySlug
                        ? 'bg-[#F3F1ED] text-[#1E1A16] dark:bg-white/10 dark:text-white'
                        : 'text-[#6F685E] hover:text-[#1E1A16] dark:text-white/60 dark:hover:text-white',
                    )}
                  >
                    {t('discover.all_categories')}
                  </button>

                  {categories.map((category) => (
                    <button
                      key={category.slug}
                      type="button"
                      onClick={() => handleCategoryChange(category.slug)}
                      className={cn(
                        'whitespace-nowrap rounded-xl px-4 py-2 font-medium transition-colors',
                        categorySlug === category.slug
                          ? 'bg-[#F3F1ED] text-[#1E1A16] dark:bg-white/10 dark:text-white'
                          : 'text-[#6F685E] hover:text-[#1E1A16] dark:text-white/60 dark:hover:text-white',
                      )}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {isLoading ? (
              <div className="columns-2 lg:columns-3 xl:columns-4 gap-5">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      'mb-5 break-inside-avoid overflow-hidden rounded-[18px] bg-[#F3F1ED] shadow-sm animate-pulse dark:bg-white/10',
                      DISCOVER_SKELETON_HEIGHTS[index%DISCOVER_SKELETON_HEIGHTS.length],
                    )}
                  />
                ))}
              </div>
            ) : publications.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[32px] border border-black/5 bg-white/78 px-6 py-14 text-center shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                <ImageOff className="mb-4 size-12 text-[#B0A89D] dark:text-white/30" />
                <p className="text-base font-medium text-[#1E1A16] dark:text-white">
                  {hasActiveFilters ? t('discover.no_results') : t('discover.empty_title')}
                </p>
                <p className="mt-1 text-sm text-[#7B7469] dark:text-white/60">
                  {hasActiveFilters ? t('discover.no_results_hint') : t('discover.empty_description')}
                </p>
              </div>
            ) : (
              <ResponsiveMasonry
                items={publications}
                getItemKey={(publication) => publication.id}
                renderItem={(publication) => (
                  <PublicationCard
                    publication={publication}
                    onOpenDetail={handleOpenPublication}
                    layout="discover"
                    onRemix={() => handleRemixFromCard(publication)}
                    isRemixing={remixingPublicationId !== null}
                    isRemixActive={remixingPublicationId === publication.id}
                  />
                )}
              />
            )}

            {hasMore && !isLoading ? (
              <div ref={sentinelRef} className="flex justify-center py-8">
                {isFetchingMore ? <Loader2 className="size-5 animate-spin text-[#7B7469] dark:text-white/55" /> : null}
              </div>
            ) : null}

            {!hasMore && !isLoading && publications.length > 0 ? (
              <div className="flex justify-center py-8 text-xs text-[#91897E] dark:text-white/45">
                {t('discover.no_more')}
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

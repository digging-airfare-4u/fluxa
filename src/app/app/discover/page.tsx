'use client';

/**
 * Discovery Gallery Page
 * Browse published works with search, sort, category filters, and infinite scroll.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Search, ArrowUpDown, Loader2, ImageOff } from 'lucide-react';
import { fetchGalleryPublications, fetchCategories, type GalleryPublication, type Category } from '@/lib/supabase/queries/publications';
import { PublicationCard } from '@/components/discover/PublicationCard';
import { PointsBalanceIndicator } from '@/components/points';
import { UserPopover } from '@/components/layout';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 500;
const DISCOVER_SKELETON_HEIGHTS = ['h-48', 'h-64', 'h-56', 'h-72'] as const;
const DISCOVER_MASONRY_CLASS_NAME = 'columns-2 sm:columns-3 md:columns-4 xl:columns-5 gap-3 sm:gap-4 pt-2';

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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useRef(paramSearch);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v);
        else params.delete(k);
      });
      router.replace(`/app/discover?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((e) => console.error('[Discover] Failed to load categories:', e));
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

        const newPubs = append ? [...publications, ...data] : data;
        setPublications(newPubs);
        setHasMore(data.length === PAGE_SIZE);
      } catch (e) {
        console.error('[Discover] Failed to load publications:', e);
      } finally {
        setIsLoading(false);
        setIsFetchingMore(false);
      }
    },
    [categorySlug, sortBy, publications],
  );

  useEffect(() => {
    loadPublications(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug, sortBy]);

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

  const handleSortToggle = useCallback(() => {
    const next = sortBy === 'latest' ? 'popular' : 'latest';
    setSortBy(next);
    updateParams({ sort: next });
  }, [sortBy, updateParams]);

  const handleCategoryChange = useCallback(
    (slug: string) => {
      const next = slug === categorySlug ? '' : slug;
      setCategorySlug(next);
      updateParams({ category: next });
    },
    [categorySlug, updateParams],
  );

  const loadMore = useCallback(() => {
    if (isFetchingMore || !hasMore || publications.length === 0) return;
    const last = publications[publications.length - 1];
    loadPublications(true, { publishedAt: last.published_at, id: last.id });
  }, [isFetchingMore, hasMore, publications, loadPublications]);

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

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0A1F]">
      {/* Fixed top bar */}
      <header className="fixed top-0 inset-x-0 z-50 h-14 flex items-center justify-between px-4 bg-[#FAFAFA]/80 dark:bg-[#0F0A1F]/80 backdrop-blur-lg border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/app')} className="shrink-0">
            <Image src="/logo.png" alt="Fluxa" width={32} height={32} className="size-8 rounded-lg" />
          </button>
          <h1 className="text-base font-semibold text-foreground hidden sm:block">{t('discover.title')}</h1>
        </div>

        <div className="flex items-center gap-2">
          <PointsBalanceIndicator />
          <LanguageSwitcher />
          <ThemeToggle />
          <UserPopover />
        </div>
      </header>

      {/* Main content */}
      <main className="pt-14 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto pb-16">
        {/* Controls */}
        <div className="sticky top-14 z-40 bg-[#FAFAFA]/80 dark:bg-[#0F0A1F]/80 backdrop-blur-lg py-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t('discover.search_placeholder')}
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-white dark:bg-[#1A1028] border border-black/10 dark:border-white/10 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
            </div>

            <button
              onClick={handleSortToggle}
              className={cn(
                'h-9 px-3 rounded-lg flex items-center gap-1.5 text-sm border transition-colors shrink-0',
                'bg-white dark:bg-[#1A1028] border-black/10 dark:border-white/10',
                'hover:border-black/20 dark:hover:border-white/20',
              )}
            >
              <ArrowUpDown className="size-3.5" />
              <span className="hidden sm:inline">{sortBy === 'latest' ? t('discover.sort_latest') : t('discover.sort_popular')}</span>
            </button>
          </div>

          {/* Category pills */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => handleCategoryChange('')}
                className={cn(
                  'h-8 px-3 rounded-full text-sm whitespace-nowrap transition-colors shrink-0',
                  !categorySlug
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white dark:bg-[#1A1028] border border-black/10 dark:border-white/10 text-muted-foreground hover:border-black/20 dark:hover:border-white/20',
                )}
              >
                {t('discover.all_categories')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => handleCategoryChange(cat.slug)}
                  className={cn(
                    'h-8 px-3 rounded-full text-sm whitespace-nowrap transition-colors shrink-0',
                    categorySlug === cat.slug
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white dark:bg-[#1A1028] border border-black/10 dark:border-white/10 text-muted-foreground hover:border-black/20 dark:hover:border-white/20',
                  )}
                >
                  {cat.icon && <span className="mr-1">{cat.icon}</span>}
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Gallery masonry */}
        {isLoading ? (
          <div className={DISCOVER_MASONRY_CLASS_NAME}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'mb-3 break-inside-avoid rounded-2xl bg-muted animate-pulse sm:mb-4',
                  DISCOVER_SKELETON_HEIGHTS[i % DISCOVER_SKELETON_HEIGHTS.length]
                )}
              />
            ))}
          </div>
        ) : publications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <ImageOff className="size-12 text-muted-foreground/40 mb-4" />
            <p className="text-base font-medium text-foreground">{t('discover.empty_title')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('discover.empty_description')}</p>
          </div>
        ) : (
          <div className={DISCOVER_MASONRY_CLASS_NAME}>
            {publications.map((pub) => (
              <PublicationCard key={pub.id} publication={pub} />
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        {hasMore && !isLoading && (
          <div ref={sentinelRef} className="flex justify-center py-8">
            {isFetchingMore && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
          </div>
        )}

        {!hasMore && !isLoading && publications.length > 0 && (
          <div className="flex justify-center py-8 text-xs text-muted-foreground">
            {t('discover.no_more')}
          </div>
        )}
      </main>
    </div>
  );
}

'use client';

/**
 * Home Page - Fluxa homepage (Lovart style)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useT } from '@/lib/i18n/hooks';
import { 
  Plus, Home, FolderOpen, Compass, User, Info, Settings,
  Image as ImageIcon, Star, PenTool, ShoppingBag,
  FileText, Loader2, ShieldCheck
} from 'lucide-react';
import { FullscreenLoading } from '@/components/ui/lottie-loading';
import { HomeInput } from '@/components/home/HomeInput';
import { ProjectGrid, type Project } from '@/components/home/ProjectGrid';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { PointsBalanceIndicator, ProfileDialog } from '@/components/points';
import { UserPopover } from '@/components/layout';
import { ProviderConfigPanel } from '@/components/settings';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicationCard } from '@/components/discover/PublicationCard';
import { PublicationDetailDialog } from '@/components/discover';
import { ResponsiveMasonry } from '@/components/discover/ResponsiveMasonry';
import { buildHomeMixedOrientationFeed } from '@/lib/home-inspiration-feed';
import {
  fetchRecentProjectsFromOps,
  createProject,
  deleteProject
} from '@/lib/supabase/queries/projects';
import {
  attachPublicationCanvasDimensions,
  fetchCategories,
  fetchGalleryPublications,
  type Category,
  type GalleryPublication,
} from '@/lib/supabase/queries/publications';
import { cn } from '@/lib/utils';
import { isModelConfigEnabled as checkModelConfigEnabled } from '@/lib/observability/feature-flags';

const QUICK_TAGS = [
  { id: 'design', label: 'Design', icon: ImageIcon },
  { id: 'branding', label: 'Branding', icon: Star },
  { id: 'illustration', label: 'Illustration', icon: PenTool },
  { id: 'ecommerce', label: 'E-Commerce', icon: ShoppingBag },
];

const HOME_INSPIRATION_SKELETON_HEIGHTS = ['h-[20rem]', 'h-[14rem]', 'h-[18rem]', 'h-[22rem]'] as const;
const HOME_INSPIRATION_MASONRY_BREAKPOINTS = [
  { minWidth: 1536, columns: 5 },
  { minWidth: 1280, columns: 4 },
  { minWidth: 768, columns: 3 },
  { minWidth: 0, columns: 2 },
];
const HOME_INSPIRATION_PAGE_SIZE = 12;

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('home');
  const tCommon = useT('common');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(searchParams.get('settings') === 'true');
  const [isModelConfigEnabled, setIsModelConfigEnabled] = useState(false);
  const [inspirationItems, setInspirationItems] = useState<GalleryPublication[]>([]);
  const [inspirationCategories, setInspirationCategories] = useState<Category[]>([]);
  const [isInspirationLoading, setIsInspirationLoading] = useState(true);
  const [inspirationError, setInspirationError] = useState(false);
  const [hasMoreInspiration, setHasMoreInspiration] = useState(true);
  const [isFetchingMoreInspiration, setIsFetchingMoreInspiration] = useState(false);
  const [activePublicationId, setActivePublicationId] = useState<string | null>(null);
  const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);
  const inspirationSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    checkModelConfigEnabled().then((enabled) => {
      if (mounted) setIsModelConfigEnabled(enabled);
    });
    return () => { mounted = false; };
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchRecentProjectsFromOps(4);
      setProjects(data.map(p => ({
        id: p.id,
        name: p.name,
        updated_at: p.updated_at,
        thumbnail: p.thumbnail,
      })));
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError(t('errors.load_failed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const loadInspiration = useCallback(async (
    append = false,
    cursor?: { publishedAt: string; id: string },
  ) => {
    try {
      if (append) {
        setIsFetchingMoreInspiration(true);
      } else {
        setIsInspirationLoading(true);
        setInspirationError(false);
      }

      const [publications, categories] = await Promise.all([
        fetchGalleryPublications({
          sortBy: 'latest',
          cursorPublishedAt: cursor?.publishedAt,
          cursorId: cursor?.id,
          limit: HOME_INSPIRATION_PAGE_SIZE,
        }),
        append ? Promise.resolve(null) : fetchCategories(),
      ]);

      const publicationsWithDimensions = await attachPublicationCanvasDimensions(publications);
      const mixedOrientationBatch = buildHomeMixedOrientationFeed(publicationsWithDimensions);

      setInspirationItems((previous) => append ? [...previous, ...mixedOrientationBatch] : mixedOrientationBatch);
      setHasMoreInspiration(publications.length === HOME_INSPIRATION_PAGE_SIZE);

      if (categories) {
        setInspirationCategories(categories.slice(0, 8));
      }
    } catch (err) {
      console.error('Failed to load inspiration feed:', err);
      if (append) {
        setHasMoreInspiration(false);
      } else {
        setInspirationError(true);
        setInspirationItems([]);
        setInspirationCategories([]);
      }
    } finally {
      setIsInspirationLoading(false);
      setIsFetchingMoreInspiration(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadInspiration();
  }, [loadInspiration]);

  const loadMoreInspiration = useCallback(() => {
    if (isFetchingMoreInspiration || !hasMoreInspiration || inspirationItems.length === 0) return;

    const lastPublication = inspirationItems[inspirationItems.length - 1];
    void loadInspiration(true, {
      publishedAt: lastPublication.published_at,
      id: lastPublication.id,
    });
  }, [hasMoreInspiration, inspirationItems, isFetchingMoreInspiration, loadInspiration]);

  useEffect(() => {
    if (isInspirationLoading || !hasMoreInspiration) return;

    const sentinel = inspirationSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreInspiration();
        }
      },
      { rootMargin: '240px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreInspiration, isInspirationLoading, loadMoreInspiration]);

  const shouldShowInspirationPagination = inspirationItems.length > 0 && (hasMoreInspiration || isFetchingMoreInspiration);

  const handlePromptSubmit = useCallback(async (prompt: string) => {
    // Open tab synchronously so the browser trusts the user gesture
    const newTab = window.open('about:blank', '_blank');
    try {
      setIsCreating(true);
      setError(null);
      const { project } = await createProject();
      if (newTab) {
        newTab.location.href = `/app/p/${project.id}?prompt=${encodeURIComponent(prompt)}`;
      }
    } catch (err) {
      console.error('Failed to create project:', err);
      newTab?.close();
      setError(t('errors.create_failed'));
    } finally {
      setIsCreating(false);
    }
  }, [t]);

  const handleNewProject = useCallback(async () => {
    const newTab = window.open('about:blank', '_blank');
    try {
      setIsCreating(true);
      setError(null);
      const { project } = await createProject();
      if (newTab) {
        newTab.location.href = `/app/p/${project.id}`;
      }
    } catch (err) {
      console.error('Failed to create project:', err);
      newTab?.close();
      setError(t('errors.create_failed'));
    } finally {
      setIsCreating(false);
    }
  }, [t]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    try {
      await deleteProject(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (err) {
      console.error('Failed to delete project:', err);
      setError(t('errors.delete_failed'));
    }
  }, [t]);

  const handleTagClick = useCallback((tagId: string) => {
    const promptKey = `quick_tags.prompts.${tagId}` as const;
    const prompt = t.has(promptKey) ? t(promptKey) : t('quick_tags.prompts.default');
    handlePromptSubmit(prompt);
  }, [handlePromptSubmit, t]);

  const handleOpenPublication = useCallback((publicationId: string) => {
    setActivePublicationId(publicationId);
    setIsPublicationDialogOpen(true);
  }, []);

  const handleOpenDiscover = useCallback((categorySlug?: string) => {
    if (!categorySlug) {
      router.push('/app/discover');
      return;
    }

    const params = new URLSearchParams();
    params.set('category', categorySlug);
    router.push(`/app/discover?${params.toString()}`);
  }, [router]);

  // Show fullscreen loading on initial load
  if (isLoading) {
    return <FullscreenLoading />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F0A1F]">
      {/* Top left logo */}
      <div className="fixed top-4 left-4 z-50">
        <Image
          src="/logo.png" 
          alt={tCommon('accessibility.logo_alt')} 
          width={40}
          height={40}
          className="size-10 rounded-xl"
        />
      </div>

      {/* Left floating nav */}
      <div className="fixed left-4 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-3">
        {/* New project button - highlighted */}
        <button
          onClick={handleNewProject}
          disabled={isCreating}
          className={cn(
            "flex size-14 items-center justify-center rounded-full transition-all",
            "bg-[#1A1A1A] dark:bg-white text-white dark:text-black",
            "hover:scale-105 shadow-lg"
          )}
        >
          <Plus className="size-6" />
        </button>

        {/* Nav buttons */}
        <div className="flex flex-col gap-1.5 rounded-[28px] border border-black/5 bg-white p-2 dark:border-white/10 dark:bg-[#1A1028]">
          <button className="flex size-11 items-center justify-center rounded-2xl bg-black/5 text-[#1A1A1A] dark:bg-white/10 dark:text-white">
            <Home className="size-5" />
          </button>
          <button
            onClick={() => router.push('/app/discover')}
            className="flex size-11 items-center justify-center rounded-2xl text-[#666] transition-colors hover:bg-black/5 hover:text-[#1A1A1A] dark:text-[#888] dark:hover:bg-white/5 dark:hover:text-white"
          >
            <Compass className="size-5" />
          </button>
          <button 
            onClick={() => router.push('/app/projects')}
            className="flex size-11 items-center justify-center rounded-2xl text-[#666] transition-colors hover:bg-black/5 hover:text-[#1A1A1A] dark:text-[#888] dark:hover:bg-white/5 dark:hover:text-white"
          >
            <FolderOpen className="size-5" />
          </button>
          <button
            onClick={() => setProfileOpen(true)}
            className="flex size-11 items-center justify-center rounded-2xl text-[#666] transition-colors hover:bg-black/5 hover:text-[#1A1A1A] dark:text-[#888] dark:hover:bg-white/5 dark:hover:text-white"
          >
            <User className="size-5" />
          </button>
          {isModelConfigEnabled && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex size-11 items-center justify-center rounded-2xl text-[#666] transition-colors hover:bg-black/5 hover:text-[#1A1A1A] dark:text-[#888] dark:hover:bg-white/5 dark:hover:text-white"
            >
              <Settings className="size-5" />
            </button>
          )}
          
          {/* Info button with popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex size-11 items-center justify-center rounded-2xl text-[#666] transition-colors hover:bg-black/5 hover:text-[#1A1A1A] dark:text-[#888] dark:hover:bg-white/5 dark:hover:text-white">
                <Info className="size-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="end" className="w-40 p-1.5">
              <div className="space-y-0.5">
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors"
                >
                  <FileText className="size-3.5 text-muted-foreground" />
                  Terms of Service
                </a>
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors"
                >
                  <ShieldCheck className="size-3.5 text-muted-foreground" />
                  Privacy Policy
                </a>
              </div>
              
              {/* Social links */}
              <div className="flex items-center justify-center gap-3 pt-2 mt-1.5 border-t">
                <a
                  href="mailto:522caiji@163.com"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </a>
                <a
                  href="https://x.com/caiji07829559?s=21"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.007-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
                      </svg>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" side="top">
                    <Image
                      src="/contactwechat.png"
                      alt={tCommon('accessibility.wechat_qr')}
                      width={192}
                      height={192}
                      className="w-48 h-48 object-contain"
                    />
                    <p className="text-xs text-center text-muted-foreground mt-1">{tCommon('social.wechat_group')}</p>
                  </PopoverContent>
                </Popover>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Top right controls */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <PointsBalanceIndicator />
        <LanguageSwitcher />
        <ThemeToggle />
        <UserPopover />
      </div>
      
      {/* Main content */}
      <main className="ml-16 px-6 py-8">
        <div className="mx-auto max-w-[1280px] space-y-12 pb-16 pt-10">
          <section className="mx-auto flex min-h-[54vh] max-w-[72rem] flex-col justify-center">
            <div className="mb-9 text-center">
              <div className="mb-4 flex items-center justify-center gap-3">
                <Image
                  src="/logo.png"
                  alt={tCommon('accessibility.logo_alt')}
                  width={48}
                  height={48}
                  className="size-12 rounded-2xl"
                />
                <h1 className="text-4xl font-heading font-bold tracking-tight text-[#1A1A1A] dark:text-white sm:text-[3.4rem]">
                  Fluxa
                </h1>
              </div>
              <p className="mx-auto max-w-2xl text-base leading-7 text-[#666] dark:text-[#888] sm:text-lg">
                {t('hero.tagline')}
              </p>
            </div>

            <div className="mb-5 flex justify-center">
              <HomeInput
                onSubmit={handlePromptSubmit}
                isLoading={isCreating}
              />
            </div>

            <div className="mb-6 flex flex-wrap justify-center gap-3">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleTagClick(tag.id)}
                  className={cn(
                    'h-10 rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-[#444] transition-all hover:border-black/20 hover:shadow-sm dark:border-white/10 dark:bg-[#1A1028] dark:text-[#AAA] dark:hover:border-white/20',
                    'flex items-center gap-1.5',
                  )}
                >
                  <tag.icon className="size-4" />
                  {tag.label}
                </button>
              ))}
            </div>

            {error ? (
              <div className="mx-auto mb-2 max-w-md rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm text-red-500 dark:border-red-500/20 dark:bg-red-500/10">
                {error}
              </div>
            ) : null}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#1A1A1A] dark:text-white">
                {t('dashboard.recent_projects')}
              </h2>
              {projects.length > 3 ? (
                <button
                  onClick={() => router.push('/app/projects')}
                  className="flex items-center gap-1 text-sm text-[#666] transition-colors hover:text-[#1A1A1A] dark:text-[#888] dark:hover:text-white"
                >
                  {t('dashboard.see_all')} <span>›</span>
                </button>
              ) : null}
            </div>

            <ProjectGrid
              projects={projects}
              onNewProject={handleNewProject}
              onDeleteProject={handleDeleteProject}
              isLoading={isLoading}
            />
          </section>

          <section className="space-y-5">
            <div className="space-y-4">
              <h2 className="text-[2rem] font-semibold tracking-tight text-[#1E1A16] dark:text-white">
                {tCommon('discover.title')}
              </h2>

              {inspirationCategories.length > 0 ? (
                <div className="overflow-x-auto pb-1">
                  <div className="flex min-w-max items-center gap-5 text-sm">
                    <button
                      type="button"
                      onClick={() => handleOpenDiscover()}
                      className="rounded-xl bg-[#F3F1ED] px-4 py-2 font-medium text-[#1E1A16] transition-colors dark:bg-white/10 dark:text-white"
                    >
                      {tCommon('discover.all_categories')}
                    </button>

                    {inspirationCategories.map((category) => (
                      <button
                        key={category.slug}
                        type="button"
                        onClick={() => handleOpenDiscover(category.slug)}
                        className="whitespace-nowrap py-2 font-medium text-[#6F685E] transition-colors hover:text-[#1E1A16] dark:text-white/60 dark:hover:text-white"
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {isInspirationLoading ? (
              <div className="columns-2 md:columns-3 xl:columns-4 2xl:columns-5 gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="mb-5 break-inside-avoid">
                    <Skeleton
                      className={cn(
                        'w-full rounded-[18px] bg-[#F3F1ED] dark:bg-white/10',
                        HOME_INSPIRATION_SKELETON_HEIGHTS[i % HOME_INSPIRATION_SKELETON_HEIGHTS.length],
                      )}
                    />
                    <div className="flex items-center justify-between gap-3 px-1 py-3">
                      <div className="flex items-center gap-2">
                        <Skeleton className="size-7 rounded-full" />
                        <Skeleton className="h-4 w-20 rounded-full" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-10 rounded-full" />
                        <Skeleton className="h-4 w-8 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : inspirationItems.length > 0 ? (
              <>
                <ResponsiveMasonry
                  items={inspirationItems}
                  getItemKey={(publication) => publication.id}
                  breakpoints={HOME_INSPIRATION_MASONRY_BREAKPOINTS}
                  renderItem={(publication) => (
                    <PublicationCard
                      publication={publication}
                      onOpenDetail={handleOpenPublication}
                      layout="home"
                    />
                  )}
                />

                {shouldShowInspirationPagination ? (
                  <div ref={inspirationSentinelRef} className="flex min-h-[88px] items-center justify-center py-6">
                    <button
                      type="button"
                      onClick={loadMoreInspiration}
                      disabled={isFetchingMoreInspiration}
                      className="inline-flex h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-5 text-sm font-medium text-[#4B463F] shadow-sm transition-colors hover:border-black/20 hover:text-[#1E1A16] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:border-white/20 dark:hover:text-white"
                    >
                      {isFetchingMoreInspiration ? (
                        <Loader2 className="size-4 animate-spin text-[#7B7469] dark:text-white/55" />
                      ) : null}
                      {isFetchingMoreInspiration ? tCommon('actions.loading') : tCommon('discover.load_more')}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-[24px] border border-dashed border-black/10 bg-[#FBFAF7] p-8 text-center dark:border-white/10 dark:bg-white/5">
                <p className="text-sm text-[#666] dark:text-[#888]">
                  {inspirationError ? t('errors.load_failed') : tCommon('discover.empty_description')}
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      <PublicationDetailDialog
        open={isPublicationDialogOpen}
        onOpenChange={setIsPublicationDialogOpen}
        publicationId={activePublicationId}
        onPublicationChange={setActivePublicationId}
      />

      {/* Profile Dialog */}
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />

      {/* Provider Config Settings */}
      {isModelConfigEnabled && (
        <ProviderConfigPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
      )}
    </div>
  );
}

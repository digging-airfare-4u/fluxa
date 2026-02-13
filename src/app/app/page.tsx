'use client';

/**
 * Home Page - Fluxa homepage (Lovart style)
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useT } from '@/lib/i18n/hooks';
import { 
  Plus, Home, FolderOpen, User, Info,
  Image as ImageIcon, Star, PenTool, ShoppingBag, Video,
  FileText, ShieldCheck
} from 'lucide-react';
import { FullscreenLoading } from '@/components/ui/lottie-loading';
import { HomeInput } from '@/components/home/HomeInput';
import { ProjectGrid, type Project } from '@/components/home/ProjectGrid';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { PointsBalanceIndicator, ProfileDialog } from '@/components/points';
import { UserPopover } from '@/components/layout';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  fetchRecentProjectsFromOps,
  createProject, 
  deleteProject 
} from '@/lib/supabase/queries/projects';
import { cn } from '@/lib/utils';

const QUICK_TAGS = [
  { id: 'design', label: 'Design', icon: ImageIcon },
  { id: 'branding', label: 'Branding', icon: Star },
  { id: 'illustration', label: 'Illustration', icon: PenTool },
  { id: 'ecommerce', label: 'E-Commerce', icon: ShoppingBag },
  { id: 'video', label: 'Video', icon: Video },
];

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations('home');
  const tCommon = useT('common');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

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

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handlePromptSubmit = useCallback(async (prompt: string) => {
    try {
      setIsCreating(true);
      setError(null);
      const { project } = await createProject();
      // Pass prompt via URL parameter, will be auto-sent in editor
      router.push(`/app/p/${project.id}?prompt=${encodeURIComponent(prompt)}`);
    } catch (err) {
      console.error('Failed to create project:', err);
      setError(t('errors.create_failed'));
      setIsCreating(false);
    }
  }, [router, t]);

  const handleNewProject = useCallback(async () => {
    try {
      setIsCreating(true);
      setError(null);
      const { project } = await createProject();
      router.push(`/app/p/${project.id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
      setError(t('errors.create_failed'));
      setIsCreating(false);
    }
  }, [router, t]);

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

  // Show fullscreen loading on initial load
  if (isLoading) {
    return <FullscreenLoading />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0F0A1F]">
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
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
        {/* New project button - highlighted */}
        <button
          onClick={handleNewProject}
          disabled={isCreating}
          className={cn(
            "size-11 rounded-full flex items-center justify-center transition-all",
            "bg-[#1A1A1A] dark:bg-white text-white dark:text-black",
            "hover:scale-105 shadow-lg"
          )}
        >
          <Plus className="size-5" />
        </button>

        {/* Nav buttons */}
        <div className="flex flex-col gap-1 p-1.5 rounded-2xl bg-white dark:bg-[#1A1028] shadow-md border border-black/5 dark:border-white/10">
          <button className="size-9 rounded-xl flex items-center justify-center text-[#1A1A1A] dark:text-white bg-black/5 dark:bg-white/10">
            <Home className="size-4" />
          </button>
          <button 
            onClick={() => router.push('/app/projects')}
            className="size-9 rounded-xl flex items-center justify-center text-[#666] dark:text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <FolderOpen className="size-4" />
          </button>
          <button 
            onClick={() => setProfileOpen(true)}
            className="size-9 rounded-xl flex items-center justify-center text-[#666] dark:text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <User className="size-4" />
          </button>
          
          {/* Info button with popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="size-9 rounded-xl flex items-center justify-center text-[#666] dark:text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <Info className="size-4" />
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
                    <p className="text-xs text-center text-muted-foreground mt-1">扫码加入微信群</p>
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
      <main className="px-6 py-8 ml-16">
        <div className="max-w-5xl mx-auto pt-16 pb-8">
          {/* Hero section */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Image
                src="/logo.png" 
                alt={tCommon('accessibility.logo_alt')} 
                width={40}
                height={40}
                className="size-10 rounded-xl"
              />
              <h1 className="text-3xl font-heading font-bold text-[#1A1A1A] dark:text-white">
                Fluxa
              </h1>
            </div>
            <p className="text-[#666] dark:text-[#888]">
              {t('hero.tagline')}
            </p>
          </div>
          
          {/* Input section */}
          <div className="flex justify-center mb-4">
            <HomeInput 
              onSubmit={handlePromptSubmit}
              isLoading={isCreating}
            />
          </div>
          
          {/* Quick tags - flat style with icons */}
          <div className="flex justify-center gap-2 mb-12 flex-wrap">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleTagClick(tag.id)}
                className={cn(
                  "h-8 px-3 rounded-full flex items-center gap-1.5 text-sm transition-all",
                  "bg-white dark:bg-[#1A1028] border border-black/10 dark:border-white/10",
                  "text-[#444] dark:text-[#aaa] hover:border-black/20 dark:hover:border-white/20",
                  "hover:shadow-sm"
                )}
              >
                <tag.icon className="size-3.5" />
                {tag.label}
              </button>
            ))}
          </div>
          
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-xl text-red-500 text-sm text-center max-w-md mx-auto bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
              {error}
            </div>
          )}
          
          {/* Recent projects section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-[#1A1A1A] dark:text-white">
                {t('dashboard.recent_projects')}
              </h2>
              {projects.length > 3 && (
                <button className="text-sm text-[#666] dark:text-[#888] hover:text-[#1A1A1A] dark:hover:text-white transition-colors flex items-center gap-1">
                  {t('dashboard.see_all')} <span>›</span>
                </button>
              )}
            </div>
            
            <ProjectGrid
              projects={projects}
              onNewProject={handleNewProject}
              onDeleteProject={handleDeleteProject}
              isLoading={isLoading}
            />
          </div>
        </div>
      </main>

      {/* Profile Dialog */}
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}

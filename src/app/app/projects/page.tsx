'use client';

/**
 * Projects Page - 项目列表页面
 * Requirements: 13.2 - Translate all alt attributes
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Plus, Home, FolderOpen, User, Info, Settings, LogOut
} from 'lucide-react';
import { ProjectGrid, type Project } from '@/components/home/ProjectGrid';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { PointsBalanceIndicator, ProfileDialog } from '@/components/points';
import { 
  fetchProjects, 
  createProject, 
  deleteProject 
} from '@/lib/supabase/queries/projects';
import { supabase } from '@/lib/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/hooks';

export default function ProjectsPage() {
  const router = useRouter();
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
      const data = await fetchProjects();
      setProjects(data.map(p => ({
        id: p.id,
        name: p.name,
        updated_at: p.updated_at,
        thumbnail: p.thumbnail,
      })));
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('加载项目失败，请刷新重试');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

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
      setError('创建项目失败，请重试');
    } finally {
      setIsCreating(false);
    }
  }, []);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    try {
      await deleteProject(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (err) {
      console.error('Failed to delete project:', err);
      setError('删除项目失败，请重试');
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  }, [router]);

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
        {/* New project button */}
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
          <button 
            onClick={() => router.push('/app')}
            className="size-9 rounded-xl flex items-center justify-center text-[#666] dark:text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Home className="size-4" />
          </button>
          <button className="size-9 rounded-xl flex items-center justify-center text-[#1A1A1A] dark:text-white bg-black/5 dark:bg-white/10">
            <FolderOpen className="size-4" />
          </button>
          <button 
            onClick={() => setProfileOpen(true)}
            className="size-9 rounded-xl flex items-center justify-center text-[#666] dark:text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <User className="size-4" />
          </button>
          <button className="size-9 rounded-xl flex items-center justify-center text-[#666] dark:text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <Info className="size-4" />
          </button>
        </div>
      </div>

      {/* Top right controls */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <PointsBalanceIndicator />
        <LanguageSwitcher />
        <ThemeToggle />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full bg-white dark:bg-[#1A1028] border border-black/5 dark:border-white/10 shadow-sm"
            >
              <User className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <User className="size-4 mr-2" />
              个人中心
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="size-4 mr-2" />
              设置
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-red-500 focus:text-red-500"
            >
              <LogOut className="size-4 mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Main content */}
      <main className="px-6 py-8 ml-16">
        <div className="max-w-5xl mx-auto pt-16 pb-8">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[#1A1A1A] dark:text-white">
              所有项目
            </h1>
            <p className="text-[#666] dark:text-[#888] mt-1">
              共 {projects.length} 个项目
            </p>
          </div>
          
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-xl text-red-500 text-sm text-center max-w-md mx-auto bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
              {error}
            </div>
          )}
          
          {/* Projects grid */}
          <ProjectGrid
            projects={projects}
            onNewProject={handleNewProject}
            onDeleteProject={handleDeleteProject}
            isLoading={isLoading}
          />
        </div>
      </main>

      {/* Profile Dialog */}
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}

'use client';

/**
 * Project Grid Component - Lovart style
 */

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Plus, MoreHorizontal, Trash2 } from 'lucide-react';
import { useTranslations, useFormatter } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export interface Project {
  id: string;
  name: string;
  thumbnail?: string;
  updated_at: string;
}

interface ProjectGridProps {
  projects: Project[];
  onNewProject?: () => void;
  onDeleteProject?: (projectId: string) => void;
  isLoading?: boolean;
}

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete?: () => void;
  onImageLoad?: () => void;
}

function ProjectCard({ project, onClick, onDelete, onImageLoad }: ProjectCardProps) {
  const t = useTranslations('home');
  const format = useFormatter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // 如果没有缩略图，立即通知父组件
  useEffect(() => {
    if (!project.thumbnail) {
      onImageLoad?.();
    }
  }, [project.thumbnail, onImageLoad]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    onImageLoad?.();
  }, [onImageLoad]);

  const handleImageError = useCallback(() => {
    // 图片加载失败也视为"加载完成"
    setImageLoaded(true);
    onImageLoad?.();
  }, [onImageLoad]);

  const handleDelete = () => {
    onDelete?.();
    setShowDeleteDialog(false);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return t('project_card.last_refined', {
      date: format.dateTime(date, { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      })
    });
  };

  return (
    <>
      <div 
        className={cn(
          "group cursor-pointer rounded-2xl overflow-hidden",
          "bg-white dark:bg-[#1A1028]",
          "border-10 border-white dark:border-white/10",
          "shadow-sm hover:shadow-md transition-all duration-200"
        )}
        onClick={onClick}
      >
        {/* Thumbnail */}
        <div className="aspect-[4/3] relative bg-[#F0F0F0] dark:bg-[#0F0A1F]">
          {project.thumbnail ? (
            <Image
              src={project.thumbnail}
              alt={project.name}
              fill
              unoptimized
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              className={cn(
                "object-cover transition-opacity duration-200",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          ) : null}

          {/* Menu button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute top-2 right-2 size-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity",
                  "bg-white/90 dark:bg-black/50 hover:bg-white dark:hover:bg-black/70 backdrop-blur-sm"
                )}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
                className="text-red-500 focus:text-red-500"
              >
                <Trash2 className="size-4 mr-2" />
                {t('project_card.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="font-medium text-sm text-[#1A1A1A] dark:text-white truncate">
            {project.name || t('project_card.unnamed')}
          </p>
          <p className="text-xs text-[#888] dark:text-[#666] mt-0.5">
            {formatDate(project.updated_at)}
          </p>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_dialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('delete_dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#1A1A1A] hover:bg-[#333] text-white"
              onClick={handleDelete}
            >
              {t('delete_dialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface NewProjectCardProps {
  onClick: () => void;
}

function NewProjectCard({ onClick }: NewProjectCardProps) {
  const t = useTranslations('home');
  
  return (
    <div 
      className={cn(
        "group cursor-pointer rounded-2xl overflow-hidden",
        "bg-[#F0F0F0] dark:bg-[#1A1028]",
        "border-10 border-white dark:border-white/10",
        "hover:border-white/80 dark:hover:border-white/20 transition-all duration-200",
        "flex items-center justify-center"
      )}
      onClick={onClick}
    >
      <div className="text-center py-12">
        <Plus className="size-6 mx-auto mb-2 text-[#666] dark:text-[#888]" />
        <p className="text-sm text-[#666] dark:text-[#888]">{t('dashboard.new_project')}</p>
      </div>
    </div>
  );
}

export function ProjectGrid({
  projects,
  onNewProject,
  onDeleteProject,
  isLoading = false,
}: ProjectGridProps) {
  const handleProjectClick = (projectId: string) => {
    window.open(`/app/p/${projectId}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl overflow-hidden bg-white dark:bg-[#1A1028] shadow-sm">
            <Skeleton className="aspect-[4/3]" />
            <div className="p-3">
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {onNewProject && <NewProjectCard onClick={onNewProject} />}

      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onClick={() => handleProjectClick(project.id)}
          onDelete={onDeleteProject ? () => onDeleteProject(project.id) : undefined}
        />
      ))}
    </div>
  );
}

export default ProjectGrid;

'use client';

/**
 * Project Grid Component - Lovart style
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MoreHorizontal, Trash2 } from 'lucide-react';
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return `Last refined on ${date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  })}`;
}

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete?: () => void;
}

function ProjectCard({ project, onClick, onDelete }: ProjectCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = () => {
    onDelete?.();
    setShowDeleteDialog(false);
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
            <img
              src={project.thumbnail}
              alt={project.name}
              className="w-full h-full object-cover"
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
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="font-medium text-sm text-[#1A1A1A] dark:text-white truncate">
            {project.name || '未命名'}
          </p>
          <p className="text-xs text-[#888] dark:text-[#666] mt-0.5">
            {formatDate(project.updated_at)}
          </p>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除这个项目吗？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，项目将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#1A1A1A] hover:bg-[#333] text-white"
              onClick={handleDelete}
            >
              删除
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
        <p className="text-sm text-[#666] dark:text-[#888]">New Project</p>
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
  const router = useRouter();

  const handleProjectClick = (projectId: string) => {
    router.push(`/app/p/${projectId}`);
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

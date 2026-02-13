'use client';

/**
 * Top Toolbar Component - Editor header with project name and controls
 * Requirements: 6.3 - Top toolbar with project name and action buttons
 * Requirements: 13.1, 13.2 - Translate all aria-label and alt attributes
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  ChevronUp,
  Menu,
  Edit3,
  Type,
  Home,
  FolderOpen,
  Plus,
  Trash2,
  ImageIcon,
  Undo,
  Redo,
  Copy,
  Eye,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/lib/i18n/hooks';

interface TopToolbarProps {
  projectName: string;
  onProjectNameChange?: (name: string) => void;
  onEditElement?: () => void;
  onEditText?: () => void;
  onNewProject?: () => void;
  onDeleteProject?: () => void;
  onImportImage?: () => void;
  hasSelection?: boolean;
  hasTextSelection?: boolean;
}

export function TopToolbar({
  projectName,
  onProjectNameChange,
  onEditElement,
  onEditText,
  onNewProject,
  onDeleteProject,
  onImportImage,
  hasSelection = false,
  hasTextSelection = false,
}: TopToolbarProps) {
  const router = useRouter();
  const t = useT('editor');
  const tCommon = useT('common');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(projectName);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    setEditedName(projectName);
  }, [projectName]);

  const handleNameSubmit = useCallback(() => {
    if (editedName.trim()) {
      onProjectNameChange?.(editedName.trim());
    } else {
      setEditedName(projectName);
    }
    setIsEditingName(false);
  }, [editedName, projectName, onProjectNameChange]);

  const handleNameCancel = useCallback(() => {
    setEditedName(projectName);
    setIsEditingName(false);
  }, [projectName]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNameSubmit();
    else if (e.key === 'Escape') handleNameCancel();
  }, [handleNameSubmit, handleNameCancel]);

  const handleBack = useCallback(() => {
    router.push('/app');
  }, [router]);

  return (
    <div className="h-14 w-full fixed top-0 left-0 flex items-center justify-between px-4 z-50">
      {/* Left section */}
      <div className="flex items-center gap-2">
        {/* Logo with dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              onMouseEnter={() => setIsLogoHovered(true)}
              onMouseLeave={() => setIsLogoHovered(false)}
            >
              {isLogoHovered ? (
                <>
                  <Menu className="size-5 text-[#666] dark:text-[#888]" />
                  <ChevronUp className="size-4 text-[#666] dark:text-[#888]" />
                </>
              ) : (
                <Image
                  src="/logo.png" 
                  alt={tCommon('accessibility.logo_alt')} 
                  width={32}
                  height={32}
                  className="size-8 rounded-lg"
                />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={handleBack}>
              <Home className="size-4 mr-2" />
              {t('menu.home')}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <FolderOpen className="size-4 mr-2" />
              {t('menu.projects')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNewProject}>
              <Plus className="size-4 mr-2" />
              {t('menu.new_project')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDeleteProject} className="text-red-500 focus:text-red-500">
              <Trash2 className="size-4 mr-2" />
              {t('menu.delete_project')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onImportImage}>
              <ImageIcon className="size-4 mr-2" />
              {t('menu.import_image')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <Undo className="size-4 mr-2" />
              {t('menu.undo')}
              <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Redo className="size-4 mr-2" />
              {t('menu.redo')}
              <DropdownMenuShortcut>⌘⇧Z</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Copy className="size-4 mr-2" />
              {t('menu.copy_object')}
              <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Eye className="size-4 mr-2" />
              {t('menu.show_all_images')}
              <DropdownMenuShortcut>⇧1</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <ZoomIn className="size-4 mr-2" />
              {t('menu.zoom_in')}
              <DropdownMenuShortcut>⌘+</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <ZoomOut className="size-4 mr-2" />
              {t('menu.zoom_out')}
              <DropdownMenuShortcut>⌘-</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Project name */}
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleNameSubmit}
            className="h-8 px-2 text-sm font-medium bg-transparent border-b border-black/20 dark:border-white/20 outline-none text-[#1A1A1A] dark:text-white"
            style={{ width: Math.max(80, editedName.length * 8 + 16) }}
          />
        ) : (
          <span
            onClick={() => setIsEditingName(true)}
            className="text-sm font-medium text-[#1A1A1A] dark:text-white cursor-pointer hover:opacity-70 transition-opacity"
          >
            {projectName}
          </span>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 mr-[380px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onEditElement} disabled={!hasSelection}>
              <Edit3 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>编辑元素</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onEditText} disabled={!hasTextSelection}>
              <Type className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>编辑文字</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export default TopToolbar;

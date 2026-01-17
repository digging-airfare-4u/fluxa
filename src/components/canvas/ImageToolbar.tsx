'use client';

/**
 * ImageToolbar Component - Floating toolbar for image editing
 * Appears when an image object is selected on the canvas
 * Requirements: 2.1, 2.2, 2.5, 2.6 - Layout, separators, theme, shadow/border
 */

import { useState, useCallback, useMemo, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/hooks';
import type { ImageToolbarProps } from './ImageToolbar.types';
import {
  IMAGE_TOOLBAR_TOOLS,
  MORE_MENU_ITEMS,
  getLockIcon,
  getLockLabel,
  TOOLBAR_OFFSET,
} from './ImageToolbar.config';

export const ImageToolbar = forwardRef<HTMLDivElement, ImageToolbarProps>(function ImageToolbar(
  {
    x,
    y,
    imageWidth,
    positionBelow = false,
    onDownload,
    onCopy,
    onDelete,
    onRemoveBackground,
    onUpscale,
    onErase,
    onExpand,
    onBringToFront,
    onSendToBack,
    onBringForward,
    onSendBackward,
    onToggleLock,
    isLocked,
    loadingStates,
    className,
  },
  ref
) {
  const t = useT('editor');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Map tool IDs to their handlers
  const toolHandlers = useMemo(() => ({
    download: onDownload,
    upscale: onUpscale,
    removeBackground: onRemoveBackground,
    erase: onErase,
    expand: onExpand,
  }), [onDownload, onUpscale, onRemoveBackground, onErase, onExpand]);

  // Map menu item IDs to their handlers
  const menuHandlers = useMemo(() => ({
    copy: onCopy,
    delete: onDelete,
    bringToFront: onBringToFront,
    sendToBack: onSendToBack,
    bringForward: onBringForward,
    sendBackward: onSendBackward,
    toggleLock: onToggleLock,
  }), [onCopy, onDelete, onBringToFront, onSendToBack, onBringForward, onSendBackward, onToggleLock]);

  // Get loading state for a tool
  const getLoadingState = useCallback((toolId: string): boolean => {
    switch (toolId) {
      case 'removeBackground':
        return loadingStates.removeBackground;
      case 'upscale':
        return loadingStates.upscale;
      case 'erase':
        return loadingStates.erase;
      case 'expand':
        return loadingStates.expand;
      default:
        return false;
    }
  }, [loadingStates]);

  // Check if any AI operation is in progress
  const isAnyLoading = useMemo(() => {
    return Object.values(loadingStates).some(Boolean);
  }, [loadingStates]);

  // Handle tool button click
  const handleToolClick = useCallback(async (toolId: string) => {
    const handler = toolHandlers[toolId as keyof typeof toolHandlers];
    if (handler) {
      await handler();
    }
  }, [toolHandlers]);

  // Handle menu item click
  const handleMenuItemClick = useCallback((itemId: string) => {
    const handler = menuHandlers[itemId as keyof typeof menuHandlers];
    if (handler) {
      handler();
    }
    setMoreMenuOpen(false);
  }, [menuHandlers]);

  // Calculate toolbar position
  const toolbarStyle = useMemo(() => {
    const centerX = x + imageWidth / 2;
    const topY = positionBelow
      ? y + TOOLBAR_OFFSET.BOTTOM
      : y - TOOLBAR_OFFSET.TOP;

    return {
      left: centerX,
      top: topY,
      transform: positionBelow
        ? 'translateX(-50%)'
        : 'translateX(-50%) translateY(-100%)',
    };
  }, [x, y, imageWidth, positionBelow]);

  // Group tools by their group property
  const groupedTools = useMemo(() => {
    const aiTools = IMAGE_TOOLBAR_TOOLS.filter(t => t.group === 'ai');
    const primaryTools = IMAGE_TOOLBAR_TOOLS.filter(t => t.group === 'primary');
    return { aiTools, primaryTools };
  }, []);

  // Render a single tool button
  const renderToolButton = useCallback((tool: typeof IMAGE_TOOLBAR_TOOLS[0]) => {
    const isLoading = getLoadingState(tool.id);
    const isDisabled = isAnyLoading && !isLoading;
    const Icon = tool.icon;

    if (tool.id === 'more') {
      return (
        <DropdownMenu key={tool.id} open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label={t(tool.label)}
                  disabled={isAnyLoading}
                >
                  <Icon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t(tool.label)}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            {MORE_MENU_ITEMS.map((item) => {
              if (item.type === 'divider') {
                return <DropdownMenuSeparator key={item.id} />;
              }

              // Handle lock/unlock icon and label dynamically
              const ItemIcon = item.id === 'toggleLock'
                ? getLockIcon(isLocked)
                : item.icon!;
              const itemLabel = item.id === 'toggleLock'
                ? getLockLabel(isLocked)
                : item.label!;

              return (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => handleMenuItemClick(item.id)}
                  className="gap-2 text-sm"
                >
                  <ItemIcon className="size-4" />
                  <span>{t(itemLabel)}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <Tooltip key={tool.id}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 relative"
            onClick={() => handleToolClick(tool.id)}
            disabled={isDisabled}
            aria-label={t(tool.label)}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Icon className="size-4" />
            )}
            {tool.badge && !isLoading && (
              <Badge
                variant="secondary"
                className="absolute -top-1.5 -right-1.5 h-4 px-1 text-[10px] font-medium"
              >
                {tool.badge}
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {t(tool.label)}
        </TooltipContent>
      </Tooltip>
    );
  }, [t, getLoadingState, isAnyLoading, moreMenuOpen, isLocked, handleToolClick, handleMenuItemClick]);

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 flex items-center gap-1 px-2 py-1.5 rounded-lg shadow-lg pointer-events-auto',
        'animate-in fade-in-0 duration-150',
        className
      )}
      style={toolbarStyle}
    >

      <div
        className={cn(
          'flex items-center gap-0.5 px-1.5 py-1 rounded-lg',
          'shadow-lg',
          'bg-background/95 backdrop-blur-sm',
          'dark:bg-background/90'
        )}
      >
        {/* AI Tools Group */}
        {groupedTools.aiTools.map(renderToolButton)}

        {/* Separator between AI and Primary tools */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* Primary Tools Group */}
        {groupedTools.primaryTools.map(renderToolButton)}
      </div>
    </div>
  );
});

export default ImageToolbar;

ImageToolbar.displayName = 'ImageToolbar';

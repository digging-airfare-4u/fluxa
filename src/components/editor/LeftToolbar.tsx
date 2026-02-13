'use client';

/**
 * Left Toolbar Component - Editor vertical tool buttons
 * Requirements: 6.2, 7.6, 14.1 - Left toolbar with vertical icon buttons and i18n tooltips
 */

import { useCallback } from 'react';
import {
  MousePointer2,
  BoxSelect,
  Square,
  Type,
  Image as ImageIcon,
  Sparkles,
  Pencil,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/hooks';

export type ToolType = 'select' | 'boxSelect' | 'rectangle' | 'text' | 'pencil' | 'image' | 'ai';

interface Tool {
  id: ToolType;
  icon: React.ReactNode;
  labelKey: string;
  shortcut?: string;
}

interface LeftToolbarProps {
  activeTool?: ToolType;
  onToolChange?: (tool: ToolType) => void;
  onImageUpload?: () => void;
  onAIClick?: () => void;
  style?: React.CSSProperties;
}

const tools: Tool[] = [
  { id: 'select', icon: <MousePointer2 className="size-5" strokeWidth={1.5} />, labelKey: 'toolbar.select', shortcut: 'V' },
  { id: 'boxSelect', icon: <BoxSelect className="size-5" strokeWidth={1.5} />, labelKey: 'toolbar.box_select', shortcut: 'M' },
  { id: 'rectangle', icon: <Square className="size-5" strokeWidth={1.5} />, labelKey: 'toolbar.rectangle', shortcut: 'R' },
  { id: 'text', icon: <Type className="size-5" strokeWidth={1.5} />, labelKey: 'toolbar.text', shortcut: 'T' },
  { id: 'pencil', icon: <Pencil className="size-5" strokeWidth={1.5} />, labelKey: 'toolbar.pencil', shortcut: 'P' },
  { id: 'image', icon: <ImageIcon className="size-5" strokeWidth={1.5} />, labelKey: 'toolbar.image', shortcut: 'I' },
  { id: 'ai', icon: <Sparkles className="size-5" strokeWidth={1.5} />, labelKey: 'toolbar.ai', shortcut: 'A' },
];

export function LeftToolbar({
  activeTool = 'select',
  onToolChange,
  onImageUpload,
  onAIClick,
  style,
}: LeftToolbarProps) {
  const t = useT('editor');

  const handleToolClick = useCallback((tool: Tool) => {
    if (tool.id === 'image') {
      onImageUpload?.();
      return;
    }
    
    if (tool.id === 'ai') {
      onAIClick?.();
      return;
    }

    onToolChange?.(tool.id);
  }, [onToolChange, onImageUpload, onAIClick]);

  return (
    <div 
      className="editor-toolbar z-40 transition-[left] duration-300 ease-in-out"
      style={style}
      role="toolbar"
      aria-label={t('toolbar.aria_label')}
    >
      {tools.map((tool) => {
        const isActive = activeTool === tool.id && tool.id !== 'image' && tool.id !== 'ai';
        const isActionButton = tool.id === 'image' || tool.id === 'ai';
        const label = t(tool.labelKey);
        
        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              {isActionButton ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleToolClick(tool)}
                  className={cn(
                    "rounded-lg",
                    tool.id === 'ai' && "text-primary hover:text-primary"
                  )}
                  aria-label={label}
                >
                  {tool.icon}
                </Button>
              ) : (
                <Toggle
                  pressed={isActive}
                  onPressedChange={() => handleToolClick(tool)}
                  size="sm"
                  className="rounded-lg"
                  aria-label={label}
                >
                  {tool.icon}
                </Toggle>
              )}
            </TooltipTrigger>
            <TooltipContent side="right">
              {label}{tool.shortcut && ` (${tool.shortcut})`}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export default LeftToolbar;

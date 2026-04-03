'use client';

/**
 * Editor Toolbar Component - Supports vertical (left sidebar) and horizontal (bottom bar) layouts
 * Requirements: 6.2, 7.6, 14.1 - Toolbar with icon buttons and i18n tooltips
 */

import { Fragment, useCallback } from 'react';
import {
  MousePointer2,
  BoxSelect,
  Square,
  Type,
  Image as ImageIcon,
  Sparkles,
  Pencil,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/hooks';

export type ToolType = 'select' | 'boxSelect' | 'rectangle' | 'text' | 'pencil' | 'image' | 'ai';

interface Tool {
  id: ToolType;
  icon: React.ReactNode;
  labelKey: string;
  group: 'core' | 'actions';
  shortcut?: string;
}

type ToolbarDirection = 'vertical' | 'horizontal';

interface LeftToolbarProps {
  activeTool?: ToolType;
  onToolChange?: (tool: ToolType) => void;
  onImageUpload?: () => void;
  onAIClick?: () => void;
  style?: React.CSSProperties;
  direction?: ToolbarDirection;
  className?: string;
}

const tools: Tool[] = [
  { id: 'select', icon: <MousePointer2 className="size-5" strokeWidth={1.5} />, labelKey: 'toolbar.select', group: 'core', shortcut: 'V' },
  { id: 'boxSelect', icon: <BoxSelect className="size-5" strokeWidth={1.5} />, labelKey: 'toolbar.box_select', group: 'core', shortcut: 'M' },
  { id: 'rectangle', icon: <Square className="size-5" strokeWidth={1.5} />, labelKey: 'toolbar.rectangle', group: 'core', shortcut: 'R' },
  { id: 'text', icon: <Type className="size-5" strokeWidth={1.5} />, labelKey: 'toolbar.text', group: 'core', shortcut: 'T' },
  { id: 'pencil', icon: <Pencil className="size-5" strokeWidth={1.5} />, labelKey: 'toolbar.pencil', group: 'core', shortcut: 'P' },
  { id: 'image', icon: <ImageIcon className="size-5" strokeWidth={1.5} />, labelKey: 'toolbar.image', group: 'actions', shortcut: 'I' },
  { id: 'ai', icon: <Sparkles className="size-5" strokeWidth={1.5} />, labelKey: 'toolbar.ai', group: 'actions', shortcut: 'A' },
];

const toolGroups = [
  {
    id: 'core',
    tools: tools.filter((tool) => tool.group === 'core'),
  },
  {
    id: 'actions',
    tools: tools.filter((tool) => tool.group === 'actions'),
  },
];

export function LeftToolbar({
  activeTool = 'select',
  onToolChange,
  onImageUpload,
  onAIClick,
  style,
  direction = 'vertical',
  className,
}: LeftToolbarProps) {
  const t = useT('editor');
  const isHorizontal = direction === 'horizontal';
  const tooltipSide = isHorizontal ? 'top' : 'right';

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
      className={cn(
        "editor-toolbar z-40",
        isHorizontal ? "editor-toolbar--horizontal" : "editor-toolbar--vertical",
        className,
      )}
      style={style}
      role="toolbar"
      aria-label={t('toolbar.aria_label')}
    >
      {toolGroups.map((group, index) => (
        <Fragment key={group.id}>
          {index > 0 && <div className="editor-toolbar__divider" aria-hidden="true" />}
          <div className="editor-toolbar__group">
            {group.tools.map((tool) => {
              const isActionButton = tool.group === 'actions';
              const isActive = activeTool === tool.id && !isActionButton;
              const label = t(tool.labelKey);

              return (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleToolClick(tool)}
                      className={cn(
                        'editor-toolbar__button',
                        isActive && 'editor-toolbar__button--active',
                        isActionButton && 'editor-toolbar__button--action',
                      )}
                      aria-label={label}
                      aria-pressed={isActionButton ? undefined : isActive}
                    >
                      {tool.icon}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side={tooltipSide}>
                    {label}{tool.shortcut && ` (${tool.shortcut})`}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export default LeftToolbar;

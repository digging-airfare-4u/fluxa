'use client';

/**
 * Left Toolbar Component - Editor vertical tool buttons
 * Requirements: 6.2 - Left toolbar with vertical icon buttons
 */

import { useState, useCallback } from 'react';
import {
  MousePointer2,
  BoxSelect,
  Square,
  Type,
  Image,
  Sparkles,
  Pencil,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ToolType = 'select' | 'boxSelect' | 'rectangle' | 'text' | 'pencil' | 'image' | 'ai';

interface Tool {
  id: ToolType;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}

interface LeftToolbarProps {
  activeTool?: ToolType;
  onToolChange?: (tool: ToolType) => void;
  onImageUpload?: () => void;
  onAIClick?: () => void;
}

const tools: Tool[] = [
  { id: 'select', icon: <MousePointer2 className="size-5" strokeWidth={1.5} />, label: '选择工具', shortcut: 'V' },
  { id: 'boxSelect', icon: <BoxSelect className="size-5" strokeWidth={1.5} />, label: '框选工具', shortcut: 'M' },
  { id: 'rectangle', icon: <Square className="size-5" strokeWidth={1.5} />, label: '矩形工具', shortcut: 'R' },
  { id: 'text', icon: <Type className="size-5" strokeWidth={1.5} />, label: '文字工具', shortcut: 'T' },
  { id: 'pencil', icon: <Pencil className="size-5" strokeWidth={1.5} />, label: '画笔工具', shortcut: 'P' },
  { id: 'image', icon: <Image className="size-5" strokeWidth={1.5} />, label: '图片上传', shortcut: 'I' },
  { id: 'ai', icon: <Sparkles className="size-5" strokeWidth={1.5} />, label: 'AI 功能', shortcut: 'A' },
];

export function LeftToolbar({
  activeTool = 'select',
  onToolChange,
  onImageUpload,
  onAIClick,
}: LeftToolbarProps) {
  const [currentTool, setCurrentTool] = useState<ToolType>(activeTool);

  const handleToolClick = useCallback((tool: Tool) => {
    if (tool.id === 'image') {
      onImageUpload?.();
      return;
    }
    
    if (tool.id === 'ai') {
      onAIClick?.();
      return;
    }

    setCurrentTool(tool.id);
    onToolChange?.(tool.id);
  }, [onToolChange, onImageUpload, onAIClick]);

  return (
    <div 
      className="editor-toolbar z-40"
      role="toolbar"
      aria-label="Canvas tools"
    >
      {tools.map((tool) => {
        const isActive = currentTool === tool.id && tool.id !== 'image' && tool.id !== 'ai';
        const isActionButton = tool.id === 'image' || tool.id === 'ai';
        
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
                  aria-label={tool.label}
                >
                  {tool.icon}
                </Button>
              ) : (
                <Toggle
                  pressed={isActive}
                  onPressedChange={() => handleToolClick(tool)}
                  size="sm"
                  className="rounded-lg"
                  aria-label={tool.label}
                >
                  {tool.icon}
                </Toggle>
              )}
            </TooltipTrigger>
            <TooltipContent side="right">
              {tool.label}{tool.shortcut && ` (${tool.shortcut})`}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export default LeftToolbar;

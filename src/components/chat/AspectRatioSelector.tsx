/**
 * AspectRatioSelector Component
 * Allows users to select image aspect ratio
 * Requirements: 4.3, 4.4
 */

'use client';

import { useState } from 'react';
import { Check, RectangleHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:3' | '3:2' | '4:5' | '5:4' | '21:9';

interface AspectRatioOption {
  value: AspectRatio;
  label: string;
  description: string;
  category: 'square' | 'landscape' | 'portrait';
}

const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  // Square
  { value: '1:1', label: '1:1', description: '正方形', category: 'square' },
  // Landscape
  { value: '16:9', label: '16:9', description: '视频/YouTube', category: 'landscape' },
  { value: '4:3', label: '4:3', description: '传统屏幕', category: 'landscape' },
  { value: '3:2', label: '3:2', description: '相机照片', category: 'landscape' },
  { value: '5:4', label: '5:4', description: '打印照片', category: 'landscape' },
  { value: '21:9', label: '21:9', description: '超宽屏', category: 'landscape' },
  // Portrait
  { value: '9:16', label: '9:16', description: '手机/抖音', category: 'portrait' },
  { value: '3:4', label: '3:4', description: '竖版屏幕', category: 'portrait' },
  { value: '2:3', label: '2:3', description: '竖版照片', category: 'portrait' },
  { value: '4:5', label: '4:5', description: 'Instagram', category: 'portrait' },
];

interface AspectRatioSelectorProps {
  selectedRatio: AspectRatio;
  onRatioChange: (ratio: AspectRatio) => void;
  disabled?: boolean;
}

/**
 * Get visual representation of aspect ratio
 */
function AspectRatioIcon({ ratio, className }: { ratio: AspectRatio; className?: string }) {
  const [w, h] = ratio.split(':').map(Number);
  const maxSize = 14;
  
  let width: number;
  let height: number;
  
  if (w >= h) {
    width = maxSize;
    height = Math.round((maxSize * h) / w);
  } else {
    height = maxSize;
    width = Math.round((maxSize * w) / h);
  }
  
  return (
    <div 
      className={cn("border border-current rounded-[2px]", className)}
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
}

export function AspectRatioSelector({
  selectedRatio,
  onRatioChange,
  disabled = false,
}: AspectRatioSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentOption = ASPECT_RATIO_OPTIONS.find(o => o.value === selectedRatio) || ASPECT_RATIO_OPTIONS[0];
  
  const squareOptions = ASPECT_RATIO_OPTIONS.filter(o => o.category === 'square');
  const landscapeOptions = ASPECT_RATIO_OPTIONS.filter(o => o.category === 'landscape');
  const portraitOptions = ASPECT_RATIO_OPTIONS.filter(o => o.category === 'portrait');

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="size-6 rounded-full text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 border border-black/10 dark:border-white/10"
            >
              <AspectRatioIcon ratio={selectedRatio} className="text-current" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          宽高比: {currentOption.label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-44">
        {/* Square */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">正方形</DropdownMenuLabel>
        {squareOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onRatioChange(option.value)}
            className="flex items-center justify-between gap-2 py-2 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <AspectRatioIcon ratio={option.value} className="text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </div>
            {selectedRatio === option.value && (
              <Check className="size-3.5 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        {/* Landscape */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">横向</DropdownMenuLabel>
        {landscapeOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onRatioChange(option.value)}
            className="flex items-center justify-between gap-2 py-2 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <AspectRatioIcon ratio={option.value} className="text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </div>
            {selectedRatio === option.value && (
              <Check className="size-3.5 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        {/* Portrait */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">竖向</DropdownMenuLabel>
        {portraitOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onRatioChange(option.value)}
            className="flex items-center justify-between gap-2 py-2 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <AspectRatioIcon ratio={option.value} className="text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </div>
            {selectedRatio === option.value && (
              <Check className="size-3.5 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default AspectRatioSelector;

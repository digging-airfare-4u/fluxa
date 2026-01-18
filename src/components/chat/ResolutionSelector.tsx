/**
 * ResolutionSelector Component
 * Allows users to select image resolution based on membership level
 * Requirements: 3.6, 3.7, 3.8
 */

'use client';

import { useState, useEffect } from 'react';
import { Check, Lock, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type Resolution = '1K' | '2K' | '4K';

interface ResolutionOption {
  value: Resolution;
  label: string;
  pixels: string;
  membershipRequired: 'free' | 'pro' | 'team';
}

const RESOLUTION_OPTIONS: ResolutionOption[] = [
  { value: '1K', label: '1K', pixels: '1024px', membershipRequired: 'free' },
  { value: '2K', label: '2K', pixels: '2048px', membershipRequired: 'pro' },
  { value: '4K', label: '4K', pixels: '4096px', membershipRequired: 'team' },
];

// Resolution limits by membership level
const MEMBERSHIP_MAX_RESOLUTION: Record<string, Resolution> = {
  'free': '1K',
  'pro': '2K',
  'team': '4K',
};

// Model max resolution limits
const MODEL_MAX_RESOLUTION: Record<string, Resolution> = {
  'gemini-2.5-flash-image': '2K',
  'gemini-3-pro-image-preview': '4K',
  'doubao-seedream-4-5-251128': '2K',
};

interface ResolutionSelectorProps {
  selectedResolution: Resolution;
  onResolutionChange: (resolution: Resolution) => void;
  membershipLevel?: 'free' | 'pro' | 'team';
  modelName?: string;
  disabled?: boolean;
}

/**
 * Check if resolution is allowed for user's membership level
 */
function isResolutionAllowed(
  resolution: Resolution,
  membershipLevel: string,
  modelName?: string
): { allowed: boolean; reason?: string } {
  const membershipMax = MEMBERSHIP_MAX_RESOLUTION[membershipLevel] || '1K';
  const modelMax = modelName ? MODEL_MAX_RESOLUTION[modelName] : '4K';
  
  const resolutionOrder: Resolution[] = ['1K', '2K', '4K'];
  const resolutionIndex = resolutionOrder.indexOf(resolution);
  const membershipMaxIndex = resolutionOrder.indexOf(membershipMax);
  const modelMaxIndex = resolutionOrder.indexOf(modelMax || '4K');
  
  if (resolutionIndex > membershipMaxIndex) {
    return { allowed: false, reason: '需要升级会员' };
  }
  
  if (resolutionIndex > modelMaxIndex) {
    return { allowed: false, reason: '模型不支持' };
  }
  
  return { allowed: true };
}

export function ResolutionSelector({
  selectedResolution,
  onResolutionChange,
  membershipLevel = 'free',
  modelName,
  disabled = false,
}: ResolutionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentOption = RESOLUTION_OPTIONS.find(o => o.value === selectedResolution) || RESOLUTION_OPTIONS[0];

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
              <Maximize className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          分辨率: {currentOption.label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-40 max-h-[240px] overflow-y-auto">
        {RESOLUTION_OPTIONS.map((option) => {
          const { allowed, reason } = isResolutionAllowed(option.value, membershipLevel, modelName);
          
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => allowed && onResolutionChange(option.value)}
              disabled={!allowed}
              className={cn(
                "flex items-center justify-between gap-2 py-2 cursor-pointer",
                !allowed && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.pixels}</span>
              </div>
              <div className="flex items-center gap-1">
                {!allowed && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Lock className="size-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>{reason}</TooltipContent>
                  </Tooltip>
                )}
                {selectedResolution === option.value && allowed && (
                  <Check className="size-3.5 text-primary" />
                )}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ResolutionSelector;

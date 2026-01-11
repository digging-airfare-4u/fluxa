'use client';

/**
 * PointsBalanceIndicator Component
 * Requirements: 3.3 - Display points balance in top toolbar
 * 
 * Shows lightning icon + balance, clickable to open profile dialog.
 */

import { useCallback } from 'react';
import { Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { usePointsStore } from '@/lib/store/usePointsStore';
import { ProfileDialog } from './ProfileDialog';
import { useState } from 'react';

interface PointsBalanceIndicatorProps {
  /** Optional className for styling */
  className?: string;
}

/**
 * Displays the lightning icon and points balance.
 * Clicking opens the profile dialog.
 */
export function PointsBalanceIndicator({ className }: PointsBalanceIndicatorProps) {
  const { points, isLoading, isInitialized } = usePointsStore();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleClick = useCallback(() => {
    setProfileOpen(true);
  }, []);

  // Show skeleton while loading
  if (isLoading || !isInitialized) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Skeleton className="h-6 w-16" />
      </div>
    );
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className={`
              flex items-center gap-1
              hover:opacity-80 transition-opacity cursor-pointer
              ${className}
            `}
          >
            {/* Lightning icon + Points */}
            <Zap className="size-4 text-[#1A1A1A] dark:text-white fill-current" />
            <span className="text-sm font-semibold text-[#1A1A1A] dark:text-white">
              {points.toLocaleString()}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>点数余额 · 点击查看详情</p>
        </TooltipContent>
      </Tooltip>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

export default PointsBalanceIndicator;

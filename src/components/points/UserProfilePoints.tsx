'use client';

/**
 * UserProfilePoints Component
 * Requirements: 5.1, 5.2 - Display points balance, membership badge, and transaction history
 * 
 * Shows a balance card with large balance display + level badge,
 * and a transaction history list.
 */

import { useEffect, useState, useCallback } from 'react';
import { Zap, Crown, Users, TrendingDown, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePointsStore } from '@/lib/store/usePointsStore';
import { TransactionHistory } from './TransactionHistory';
import type { MembershipLevel } from '@/lib/supabase/types/points';

interface UserProfilePointsProps {
  /** User ID for fetching data */
  userId?: string;
  /** Optional className for styling */
  className?: string;
}

/**
 * Get membership level display info
 */
function getMembershipInfo(level: MembershipLevel): {
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
} {
  const info: Record<MembershipLevel, { name: string; icon: React.ReactNode; color: string; bgColor: string }> = {
    free: {
      name: '免费版',
      icon: <Zap className="size-3.5" />,
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-800',
    },
    pro: {
      name: '专业版',
      icon: <Crown className="size-3.5" />,
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    },
    team: {
      name: '团队版',
      icon: <Users className="size-3.5" />,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
  };
  return info[level] || info.free;
}

/**
 * User profile points display component
 * Shows balance card and transaction history
 */
export function UserProfilePoints({ userId, className }: UserProfilePointsProps) {
  const { points, membershipLevel, todaySpent, isLoading, fetchPoints, isInitialized } = usePointsStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch points on mount if not initialized
  useEffect(() => {
    if (!isInitialized) {
      fetchPoints();
    }
  }, [isInitialized, fetchPoints]);

  const handleRefresh = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsRefreshing(true);
    await fetchPoints();
    setIsRefreshing(false);
  }, [fetchPoints]);

  const membershipInfo = getMembershipInfo(membershipLevel);

  if (isLoading && !isInitialized) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-8 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Balance Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Zap className="size-5 text-[#1A1A1A] dark:text-white" />
                点数余额
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Large balance display */}
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-bold text-[#1A1A1A] dark:text-white">
                {points.toLocaleString()}
              </span>
              <span className="text-lg text-muted-foreground">点</span>
            </div>

            {/* Membership level */}
            <div className={`inline-flex items-center gap-1.5 text-sm ${membershipInfo.color}`}>
              {membershipInfo.icon}
              <span>{membershipInfo.name}</span>
            </div>

            {/* Today's stats */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingDown className="size-4 text-muted-foreground" />
                  <span>今日消耗</span>
                </div>
                <span className="font-medium text-[#1A1A1A] dark:text-white">
                  -{todaySpent.toLocaleString()} 点
                </span>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">交易记录</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <TransactionHistory userId={userId} />
        </CardContent>
      </Card>
    </div>
  );
}

export default UserProfilePoints;

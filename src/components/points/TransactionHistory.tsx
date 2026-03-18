'use client';

/**
 * TransactionHistory Component
 * Requirements: 5.2, 5.3, 5.4 - Transaction history with pagination and filtering
 * 
 * Shows transaction list with type icons, source descriptions, amounts, and timestamps.
 * Supports pagination (20 items per page) and filtering by type.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Gift,
  Sparkles,
  ImageIcon,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase/client';
import type {
  PointTransaction,
  TransactionType,
  TransactionSource,
} from '@/lib/supabase/types/points';

interface TransactionHistoryProps {
  /** User ID for fetching transactions */
  userId?: string;
  /** Items per page (default: 20) */
  pageSize?: number;
  /** Optional className for styling */
  className?: string;
}

type FilterType = TransactionType | 'all';

function getTransactionModelDisplayName(modelName?: string | null): string | null {
  if (!modelName) {
    return null;
  }

  if (modelName === 'fluxa-agent' || modelName === 'gemini-2.5-flash-agent') {
    return 'Fluxa Agent';
  }

  return modelName;
}

/**
 * Get icon for transaction source
 */
function getSourceIcon(source: TransactionSource): React.ReactNode {
  const icons: Record<TransactionSource, React.ReactNode> = {
    registration: <Gift className="size-4" />,
    generate_ops: <Sparkles className="size-4" />,
    generate_image: <ImageIcon className="size-4" />,
    export: <Download className="size-4" />,
    admin: <Settings className="size-4" />,
  };
  return icons[source] || <Sparkles className="size-4" />;
}

/**
 * Transaction history list with pagination and filtering
 */
export function TransactionHistory({
  userId,
  pageSize = 20,
  className,
}: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('points');

  const totalPages = Math.ceil(total / pageSize);
  const hasMore = page < totalPages;
  const hasPrev = page > 1;

  /**
   * Get display name for transaction source
   */
  const getSourceName = useCallback((source: TransactionSource, modelName?: string | null): string => {
    const displayModelName = getTransactionModelDisplayName(modelName);

    if (displayModelName) {
      if (source === 'generate_ops') {
        return t('transaction.source.generate_ops_with_model', { modelName: displayModelName });
      }
      if (source === 'generate_image') {
        return t('transaction.source.generate_image_with_model', { modelName: displayModelName });
      }
    }
    return t(`transaction.source.${source}`);
  }, [t]);

  /**
   * Format timestamp to relative or absolute time
   */
  const formatTime = useCallback((timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('transaction.time.just_now');
    if (diffMins < 60) return t('transaction.time.minutes_ago', { count: diffMins });
    if (diffHours < 24) return t('transaction.time.hours_ago', { count: diffHours });
    if (diffDays < 7) return t('transaction.time.days_ago', { count: diffDays });

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [t]);

  /**
   * Fetch transactions from database
   */
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build query
      let query = supabase
        .from('point_transactions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Apply filter
      if (filter !== 'all') {
        query = query.eq('type', filter);
      }

      // Apply user filter if provided
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error: queryError, count } = await query;

      if (queryError) {
        throw new Error(queryError.message);
      }

      setTransactions(data || []);
      setTotal(count || 0);
    } catch (err) {
      console.error('[TransactionHistory] Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  }, [userId, filter, page, pageSize]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  const handleFilterChange = useCallback((value: string) => {
    if (value) {
      setFilter(value as FilterType);
    }
  }, []);

  const handlePrevPage = useCallback(() => {
    if (hasPrev) {
      setPage((p) => p - 1);
    }
  }, [hasPrev]);

  const handleNextPage = useCallback(() => {
    if (hasMore) {
      setPage((p) => p + 1);
    }
  }, [hasMore]);

  return (
    <div className={className}>
      {/* Filter tabs */}
      <div className="mb-4">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={handleFilterChange}
          className="justify-start"
        >
          <ToggleGroupItem value="all" size="sm">
            {t('transaction.filter.all')}
          </ToggleGroupItem>
          <ToggleGroupItem value="earn" size="sm">
            {t('transaction.filter.earn')}
          </ToggleGroupItem>
          <ToggleGroupItem value="spend" size="sm">
            {t('transaction.filter.spend')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Transaction list */}
      <div className="space-y-2">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))
        ) : error ? (
          // Error state
          <div className="text-center py-8 text-muted-foreground">
            <p>{t('transaction.error')}</p>
            <Button variant="ghost" size="sm" onClick={fetchTransactions} className="mt-2">
              {t('transaction.retry')}
            </Button>
          </div>
        ) : transactions.length === 0 ? (
          // Empty state
          <div className="text-center py-8 text-muted-foreground">
            <p>{t('transaction.empty')}</p>
          </div>
        ) : (
          // Transaction items
          transactions.map((tx) => (
            <TransactionItem 
              key={tx.id} 
              transaction={tx} 
              getSourceName={getSourceName}
              formatTime={formatTime}
              t={t}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {!isLoading && transactions.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <span className="text-sm text-muted-foreground">
            {t('transaction.pagination.page_info', { current: page, total: totalPages, count: total })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={!hasPrev}
            >
              <ChevronLeft className="size-4" />
              {t('transaction.pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!hasMore}
            >
              {t('transaction.pagination.next')}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Single transaction item
 */
function TransactionItem({ 
  transaction, 
  getSourceName, 
  formatTime,
  t 
}: { 
  transaction: PointTransaction;
  getSourceName: (source: TransactionSource, modelName?: string | null) => string;
  formatTime: (timestamp: string) => string;
  t: ReturnType<typeof useTranslations<'points'>>;
}) {
  const isEarn = transaction.type === 'earn';
  const isAdjust = transaction.type === 'adjust';

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      {/* Icon */}
      <div
        className={`
          flex items-center justify-center size-8 rounded-full
          ${isEarn ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : ''}
          ${!isEarn && !isAdjust ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : ''}
          ${isAdjust ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''}
        `}
      >
        {getSourceIcon(transaction.source)}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {getSourceName(transaction.source, transaction.model_name)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatTime(transaction.created_at)}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right">
        <p
          className={`text-sm font-semibold ${
            isEarn
              ? 'text-green-600 dark:text-green-400'
              : isAdjust
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {isEarn ? '+' : ''}{transaction.amount.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('transaction.balance_after', { balance: transaction.balance_after.toLocaleString() })}
        </p>
      </div>
    </div>
  );
}

export default TransactionHistory;

/**
 * i18n Custom Hooks
 * Provides typed hooks for accessing translations and formatting utilities.
 * Requirements: 1.6, 4.4, 4.5
 */

'use client';

import { useTranslations, useFormatter, useLocale } from 'next-intl';
import type { Namespace } from './config';

/**
 * Hook for accessing translations with namespace typing.
 * @param namespace - The translation namespace to use
 * @returns Translation function for the specified namespace
 */
export function useT(namespace: Namespace) {
  return useTranslations(namespace);
}

/**
 * Convenience hook for accessing common namespace translations.
 * @returns Translation function for the 'common' namespace
 */
export function useCommonT() {
  return useTranslations('common');
}

/**
 * Hook for locale-aware formatting utilities.
 * Provides date, number, relative time, and points formatting.
 * @returns Object with formatting functions and current locale
 */
export function useI18nFormatter() {
  const format = useFormatter();
  const locale = useLocale();

  return {
    /**
     * Format a date according to the current locale.
     * Uses predefined format styles for consistency.
     */
    formatDate: (date: Date | number, style: 'short' | 'medium' | 'long' = 'medium') => {
      const options = {
        short: { dateStyle: 'short' as const },
        medium: { dateStyle: 'medium' as const },
        long: { dateStyle: 'long' as const },
      };
      return format.dateTime(date, options[style]);
    },

    /**
     * Format a date with time according to the current locale.
     */
    formatDateTime: (date: Date | number) =>
      format.dateTime(date, { dateStyle: 'medium', timeStyle: 'short' }),

    /**
     * Format a number according to the current locale.
     */
    formatNumber: (value: number) => format.number(value),

    /**
     * Format a date as relative time (e.g., "2 hours ago").
     */
    formatRelativeTime: (date: Date | number) => format.relativeTime(date),

    /**
     * Format points balance with locale-appropriate number formatting.
     */
    formatPoints: (points: number) => format.number(points),

    /**
     * Current locale code.
     */
    locale,
  };
}

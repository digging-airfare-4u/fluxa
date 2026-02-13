'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Hook to detect media query matches
 * @param query - CSS media query string
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const media = window.matchMedia(query);
    const listener = () => onStoreChange();
    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, [query]);

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

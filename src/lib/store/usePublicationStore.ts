'use client';
import { create } from 'zustand';

export interface GalleryFilters { categorySlug: string | null; searchQuery: string; sortBy: 'latest' | 'popular'; }

interface PublicationState {
  filters: GalleryFilters; cursorPublishedAt: string | null; cursorId: string | null;
  hasMore: boolean; isLoading: boolean; isLoadingMore: boolean;
  setFilters: (filters: Partial<GalleryFilters>) => void;
  setCursor: (publishedAt: string | null, id: string | null) => void;
  setHasMore: (hasMore: boolean) => void; setIsLoading: (isLoading: boolean) => void;
  setIsLoadingMore: (isLoadingMore: boolean) => void; resetPagination: () => void;
}

export const usePublicationStore = create<PublicationState>((set) => ({
  filters: { categorySlug: null, searchQuery: '', sortBy: 'latest' },
  cursorPublishedAt: null, cursorId: null, hasMore: true, isLoading: true, isLoadingMore: false,
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters }, cursorPublishedAt: null, cursorId: null, hasMore: true })),
  setCursor: (publishedAt, id) => set({ cursorPublishedAt: publishedAt, cursorId: id }),
  setHasMore: (hasMore) => set({ hasMore }), setIsLoading: (isLoading) => set({ isLoading }),
  setIsLoadingMore: (isLoadingMore) => set({ isLoadingMore }),
  resetPagination: () => set({ cursorPublishedAt: null, cursorId: null, hasMore: true }),
}));

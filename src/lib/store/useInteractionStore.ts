'use client';
import { create } from 'zustand';

interface InteractionState {
  likedIds: Set<string>; bookmarkedIds: Set<string>;
  setLikedIds: (ids: Set<string>) => void; setBookmarkedIds: (ids: Set<string>) => void;
  toggleLiked: (id: string) => void; toggleBookmarked: (id: string) => void;
  isLiked: (id: string) => boolean; isBookmarked: (id: string) => boolean;
}

export const useInteractionStore = create<InteractionState>((set, get) => ({
  likedIds: new Set(), bookmarkedIds: new Set(),
  setLikedIds: (ids) => set({ likedIds: ids }), setBookmarkedIds: (ids) => set({ bookmarkedIds: ids }),
  toggleLiked: (id) => set((state) => { const s = new Set(state.likedIds); if (s.has(id)) s.delete(id); else s.add(id); return { likedIds: s }; }),
  toggleBookmarked: (id) => set((state) => { const s = new Set(state.bookmarkedIds); if (s.has(id)) s.delete(id); else s.add(id); return { bookmarkedIds: s }; }),
  isLiked: (id) => get().likedIds.has(id), isBookmarked: (id) => get().bookmarkedIds.has(id),
}));

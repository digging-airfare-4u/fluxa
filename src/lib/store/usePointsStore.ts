/**
 * Points Store (Zustand)
 * Requirements: 3.3 - Frontend state management for points balance
 * 
 * Manages user points state with real-time updates via Supabase Realtime.
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { MembershipLevel, UserProfile, GetPointsResponse } from '@/lib/supabase/types/points';

/**
 * Points store state interface
 */
interface PointsState {
  /** Current points balance */
  points: number;
  /** User's membership level */
  membershipLevel: MembershipLevel;
  /** Loading state for async operations */
  isLoading: boolean;
  /** Error message if any operation fails */
  error: string | null;
  /** Today's spent points */
  todaySpent: number;
  /** Whether the store has been initialized */
  isInitialized: boolean;
}

/**
 * Points store actions interface
 */
interface PointsActions {
  /** Fetch current user's points from the server */
  fetchPoints: () => Promise<void>;
  /** Subscribe to real-time points changes */
  subscribeToChanges: (userId: string) => () => void;
  /** Update points locally (used by realtime subscription) */
  setPoints: (points: number) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Reset store to initial state */
  reset: () => void;
}

/**
 * Combined store type
 */
type PointsStore = PointsState & PointsActions;

/**
 * Initial state values
 */
const initialState: PointsState = {
  points: 0,
  membershipLevel: 'free',
  isLoading: false,
  error: null,
  todaySpent: 0,
  isInitialized: false,
};

/**
 * Active realtime channel reference
 * Stored outside the store to prevent serialization issues
 */
let activeChannel: RealtimeChannel | null = null;

/**
 * Points store for managing user points state
 * 
 * Usage:
 * ```tsx
 * const { points, membershipLevel, fetchPoints, subscribeToChanges } = usePointsStore();
 * 
 * useEffect(() => {
 *   fetchPoints();
 *   const unsubscribe = subscribeToChanges(userId);
 *   return unsubscribe;
 * }, [userId]);
 * ```
 */
export const usePointsStore = create<PointsStore>((set, get) => ({
  ...initialState,

  /**
   * Fetch current user's points from the get-points Edge Function
   * Requirements: 3.1, 3.4
   */
  fetchPoints: async () => {
    set({ isLoading: true, error: null });

    try {
      // Get current session for auth header
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Not authenticated');
      }

      // Call get-points Edge Function
      const { data, error } = await supabase.functions.invoke<GetPointsResponse>('get-points', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch points');
      }

      if (!data) {
        throw new Error('No data returned from get-points');
      }

      set({
        points: data.points,
        membershipLevel: data.membership_level,
        todaySpent: data.today_spent,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch points';
      console.error('[PointsStore] Error fetching points:', message);
      set({
        isLoading: false,
        error: message,
      });
    }
  },

  /**
   * Subscribe to real-time points changes via Supabase Realtime
   * Requirements: 3.2, 3.3
   * 
   * @param userId - The user ID to subscribe to
   * @returns Unsubscribe function
   */
  subscribeToChanges: (userId: string) => {
    // Clean up existing subscription if any
    if (activeChannel) {
      console.log('[PointsStore] Removing existing channel');
      supabase.removeChannel(activeChannel);
      activeChannel = null;
    }

    const channelName = `user_profiles:id=eq.${userId}`;
    console.log(`[PointsStore] Subscribing to channel: ${channelName}`);

    activeChannel = supabase
      .channel(channelName)
      .on<UserProfile>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<UserProfile>) => {
          const newProfile = payload.new as UserProfile;
          
          if (newProfile && typeof newProfile.points === 'number') {
            console.log(`[PointsStore] Points updated via realtime: ${newProfile.points}`);
            set({
              points: newProfile.points,
              membershipLevel: newProfile.membership_level,
            });
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[PointsStore] Subscribed to channel: ${channelName}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`[PointsStore] Subscription error:`, err);
          set({ error: 'Failed to subscribe to points updates' });
        }
      });

    // Return unsubscribe function
    return () => {
      console.log(`[PointsStore] Unsubscribing from channel: ${channelName}`);
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
      }
    };
  },

  /**
   * Update points locally
   * Used when points are deducted during API calls
   */
  setPoints: (points: number) => {
    set({ points });
  },

  /**
   * Set error state
   */
  setError: (error: string | null) => {
    set({ error });
  },

  /**
   * Reset store to initial state
   * Called on logout or when user changes
   */
  reset: () => {
    // Clean up subscription
    if (activeChannel) {
      supabase.removeChannel(activeChannel);
      activeChannel = null;
    }
    set(initialState);
  },
}));

/**
 * Selector hooks for common use cases
 */
export const usePoints = () => usePointsStore((state) => state.points);
export const useMembershipLevel = () => usePointsStore((state) => state.membershipLevel);
export const usePointsLoading = () => usePointsStore((state) => state.isLoading);
export const usePointsError = () => usePointsStore((state) => state.error);

export default usePointsStore;

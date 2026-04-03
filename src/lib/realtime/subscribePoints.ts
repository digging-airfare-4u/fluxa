/**
 * Points Realtime Subscription
 * Requirements: 3.2, 3.3
 * 
 * Subscribes to user_profiles table for real-time points balance updates.
 * When points balance changes, notifies subscribers immediately.
 */

import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import type { UserProfile, MembershipLevel } from '../supabase/types/points';

/**
 * Points change event data
 */
export interface PointsChangeEvent {
  points: number;
  membershipLevel: MembershipLevel;
  previousPoints?: number;
  previousMembershipLevel?: MembershipLevel;
}

/**
 * Callback types for points changes
 */
export interface PointsSubscriptionCallbacks {
  /** Called when points balance changes */
  onPointsChange?: (event: PointsChangeEvent) => void;
  /** Called on subscription error */
  onError?: (error: Error) => void;
}

/**
 * Subscription result with cleanup function
 */
export interface PointsSubscription {
  channel: RealtimeChannel;
  unsubscribe: () => Promise<void>;
}

/**
 * Subscribe to points balance changes for a specific user
 * 
 * Requirements:
 * - 3.2: When user's points balance changes, broadcast via Supabase Realtime
 * - 3.3: Frontend subscribes to points balance changes and updates UI in real-time
 * 
 * @param userId - The user ID to subscribe to
 * @param callbacks - Callback functions for points events
 * @returns Subscription object with unsubscribe function
 */
export function subscribeToPoints(
  userId: string,
  callbacks: PointsSubscriptionCallbacks
): PointsSubscription {
  const channelName = `user_profiles:id=eq.${userId}`;
  
  // Remove any existing channel with the same name first
  const existingChannel = supabase.getChannels().find(
    ch => ch.topic === `realtime:${channelName}`
  );
  if (existingChannel) {
    console.log(`[Points] Removing existing channel: ${channelName}`);
    supabase.removeChannel(existingChannel);
  }

  // Track previous values for change detection
  let previousPoints: number | undefined;
  let previousMembershipLevel: MembershipLevel | undefined;

  const channel = supabase
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
        handlePointsChange(payload, callbacks, previousPoints, previousMembershipLevel);
        
        // Update previous values
        const newProfile = payload.new as UserProfile;
        if (newProfile) {
          previousPoints = newProfile.points;
          previousMembershipLevel = newProfile.membership_level;
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Points] Subscribed to channel: ${channelName}`);
      } else if (status === 'TIMED_OUT') {
        console.warn('[Points] Subscription timed out for channel:', channelName);
        callbacks.onError?.(new Error('Subscription timed out'));
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[Points] Subscription error:`, err);
        callbacks.onError?.(err ?? new Error(`Subscription failed: ${status}`));
      }
    });

  const unsubscribe = async () => {
    console.log(`[Points] Unsubscribing from channel: ${channelName}`);
    await supabase.removeChannel(channel);
  };

  return { channel, unsubscribe };
}

/**
 * Handle points change events
 */
function handlePointsChange(
  payload: RealtimePostgresChangesPayload<UserProfile>,
  callbacks: PointsSubscriptionCallbacks,
  previousPoints?: number,
  previousMembershipLevel?: MembershipLevel
): void {
  const newProfile = payload.new as UserProfile;
  const oldProfile = payload.old as Partial<UserProfile> | undefined;
  
  if (!newProfile || typeof newProfile.points !== 'number') {
    console.warn('[Points] Received invalid profile payload:', payload);
    return;
  }

  console.log(`[Points] Points changed: ${oldProfile?.points ?? previousPoints} → ${newProfile.points}`);

  const event: PointsChangeEvent = {
    points: newProfile.points,
    membershipLevel: newProfile.membership_level,
    previousPoints: oldProfile?.points ?? previousPoints,
    previousMembershipLevel: oldProfile?.membership_level ?? previousMembershipLevel,
  };

  callbacks.onPointsChange?.(event);
}

/**
 * Fetch current user profile
 * Useful for getting initial state or refreshing after reconnection
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Points] Error fetching user profile:', error);
    return null;
  }

  return data as UserProfile;
}

/**
 * Create a points subscription manager that handles reconnection
 * and provides a simpler interface for components
 */
export function createPointsSubscriptionManager(
  userId: string,
  onPointsChange: (points: number, membershipLevel: MembershipLevel) => void
): {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isConnected: () => boolean;
} {
  let subscription: PointsSubscription | null = null;
  let connected = false;

  const start = async () => {
    // Fetch initial profile
    const profile = await fetchUserProfile(userId);
    if (profile) {
      onPointsChange(profile.points, profile.membership_level);
    }
    
    subscription = subscribeToPoints(userId, {
      onPointsChange: (event) => {
        onPointsChange(event.points, event.membershipLevel);
      },
      onError: (error) => {
        console.error('[Points] Subscription error:', error);
        connected = false;
        // Attempt reconnection after delay
        setTimeout(() => {
          if (!connected) {
            console.log('[Points] Attempting reconnection...');
            start();
          }
        }, 5000);
      },
    });
    
    connected = true;
  };

  const stop = async () => {
    if (subscription) {
      await subscription.unsubscribe();
      subscription = null;
    }
    connected = false;
  };

  const isConnected = () => connected;

  return { start, stop, isConnected };
}

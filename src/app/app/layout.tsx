'use client';

/**
 * App Layout - Handles authentication check and points initialization
 * Requirements: 3.3 - Initialize points state on app load
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { usePointsStore } from '@/lib/store/usePointsStore';
import { FullscreenLoading } from '@/components/ui/lottie-loading';
import {
  clearLocalReferralCode,
  clearPendingReferralCode,
  getLocalReferralCode,
  shouldClearPendingReferralCode,
} from '@/lib/supabase/queries/referral-codes';

/**
 * Points Initializer Component
 * Handles fetching points and subscribing to realtime updates
 */
function PointsInitializer({ userId }: { userId: string }) {
  const { fetchPoints, subscribeToChanges } = usePointsStore();
  const fetchedPointsUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (fetchedPointsUserIdRef.current === userId) return;

    fetchedPointsUserIdRef.current = userId;
    void fetchPoints();
  }, [userId, fetchPoints]);

  useEffect(() => {
    const unsubscribe = subscribeToChanges(userId);

    return () => {
      unsubscribe();
    };
  }, [userId, subscribeToChanges]);

  return null;
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const resetPointsStore = usePointsStore((state) => state.reset);
  const autoRedeemReferralAttemptedUserIdRef = useRef<string | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setIsAuthenticated(true);
        setUserId(session.user.id);
      } else {
        // No session - redirect to auth page
        router.push('/auth');
        return;
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      router.push('/auth');
      return;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true);
        setUserId(session.user.id);
      } else {
        setIsAuthenticated(false);
        setUserId(null);
        autoRedeemReferralAttemptedUserIdRef.current = null;
        // Reset points store on logout
        resetPointsStore();
        router.push('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [checkAuth, router, resetPointsStore]);

  // Auto-redeem pending referral code (from metadata or localStorage)
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (autoRedeemReferralAttemptedUserIdRef.current === userId) return;

    autoRedeemReferralAttemptedUserIdRef.current = userId;

    const tryAutoRedeemReferral = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        // Check metadata first, then localStorage (OAuth flow)
        const metaCode = String(session.user?.user_metadata?.pending_referral_code ?? '').trim();
        const localCode = getLocalReferralCode()?.trim() ?? '';
        const referralCode = metaCode || localCode;
        if (!referralCode) return;

        const response = await fetch('/api/referral/redeem', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ referral_code: referralCode }),
        });

        const payload = await response.json();
        if (shouldClearPendingReferralCode(payload)) {
          if (metaCode) await clearPendingReferralCode();
          clearLocalReferralCode();
        }
      } catch (err) {
        console.error('[app/layout] auto referral redeem failed:', err);
      }
    };

    void tryAutoRedeemReferral();
  }, [isAuthenticated, userId]);

  // Loading state
  if (isLoading) {
    return <FullscreenLoading />;
  }

  // Not authenticated - will redirect
  if (!isAuthenticated) {
    return <FullscreenLoading />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Initialize points store when authenticated */}
      {userId && <PointsInitializer userId={userId} />}
      {children}
    </div>
  );
}

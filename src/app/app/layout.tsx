'use client';

/**
 * App Layout - Handles authentication check and points initialization
 * Requirements: 3.3 - Initialize points state on app load
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { usePointsStore } from '@/lib/store/usePointsStore';
import { FullscreenLoading } from '@/components/ui/lottie-loading';

/**
 * Points Initializer Component
 * Handles fetching points and subscribing to realtime updates
 */
function PointsInitializer({ userId }: { userId: string }) {
  const { fetchPoints, subscribeToChanges, isInitialized } = usePointsStore();

  useEffect(() => {
    // Fetch points on mount if not initialized
    if (!isInitialized) {
      fetchPoints();
    }

    // Subscribe to realtime changes
    const unsubscribe = subscribeToChanges(userId);

    return () => {
      unsubscribe();
    };
  }, [userId, fetchPoints, subscribeToChanges, isInitialized]);

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
        // Reset points store on logout
        resetPointsStore();
        router.push('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [checkAuth, router, resetPointsStore]);

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

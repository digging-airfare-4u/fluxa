'use client';

/**
 * App Layout - Handles authentication check and points initialization
 * Requirements: 3.3 - Initialize points state on app load
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { usePointsStore } from '@/lib/store/usePointsStore';
import { Loader2 } from 'lucide-react';

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
  }, [router, resetPointsStore]);

  async function checkAuth() {
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
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - will redirect
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          <p className="text-text-secondary">跳转到登录页面...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Initialize points store when authenticated */}
      {userId && <PointsInitializer userId={userId} />}
      {children}
    </div>
  );
}

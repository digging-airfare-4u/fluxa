'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * OAuth Callback Page
 * Handles the redirect from OAuth providers (e.g. Google).
 * Supabase client's detectSessionInUrl picks up the tokens automatically.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.replace('/app');
      }
    });

    // If session is already established by detectSessionInUrl, redirect immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/app');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="aurora-bg" />
      <div className="flex flex-col items-center gap-4 relative z-10">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-muted-foreground">正在登录...</p>
      </div>
    </div>
  );
}

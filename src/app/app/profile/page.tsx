'use client';

/**
 * User Profile Page
 * Requirements: 5.1 - Display user profile with points information
 * 
 * Shows user profile with points balance, membership level, and transaction history.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserProfilePoints } from '@/components/points';
import { supabase } from '@/lib/supabase/client';

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    }
    getUser();
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0D0915]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0D0915]/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex items-center gap-2">
            <User className="size-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">个人中心</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        <UserProfilePoints userId={userId} />
      </main>
    </div>
  );
}

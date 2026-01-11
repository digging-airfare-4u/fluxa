'use client';

/**
 * ProfileDialog Component
 * Requirements: 5.1 - Display user profile in a dialog instead of a separate page
 * 
 * Shows user profile with points balance, membership level, and transaction history
 * in a modal dialog for better UX (no page reload).
 */

import { useEffect, useState } from 'react';
import { User, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserProfilePoints } from './UserProfilePoints';
import { supabase } from '@/lib/supabase/client';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      async function getUser() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }
      }
      getUser();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 bg-white dark:bg-[#1A1028] px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <User className="size-5 text-muted-foreground" />
              个人中心
            </DialogTitle>
          </div>
        </DialogHeader>
        <div className="px-6 py-4">
          <UserProfilePoints userId={userId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProfileDialog;

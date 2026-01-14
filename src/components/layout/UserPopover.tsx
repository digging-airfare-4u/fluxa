'use client';

/**
 * UserPopover Component
 * Hover popover showing user info and menu options
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, ChevronRight, UserCircle, HelpCircle, Mail, LogOut, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/lib/supabase/client';
import { usePointsStore } from '@/lib/store/usePointsStore';

interface UserInfo {
  email: string;
  name?: string;
  avatar?: string;
}

export function UserPopover() {
  const router = useRouter();
  const { points } = usePointsStore();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser({
          email: user.email || '',
          name: user.user_metadata?.name || user.email?.split('@')[0],
          avatar: user.user_metadata?.avatar_url,
        });
      }
    }
    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const menuItems = [
    { icon: UserCircle, label: 'Account', href: '/app/profile' },
    { icon: HelpCircle, label: 'Help', href: '#' },
    { icon: Mail, label: 'Contact', href: 'mailto:support@fluxa.app' },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onMouseEnter={() => setOpen(true)}
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="size-8 rounded-full" />
          ) : (
            <User className="size-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="end"
        onMouseLeave={() => setOpen(false)}
      >
        {/* User info header */}
        <div className="p-4 text-center">
          <div className="flex justify-center mb-3">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="size-14 rounded-full" />
            ) : (
              <div className="size-14 rounded-full bg-muted flex items-center justify-center">
                <User className="size-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-left">
              <p className="text-sm font-medium">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Link href="/pricing">
              <Button size="sm" variant="outline" className="h-6 text-xs px-2">
                Upgrade
              </Button>
            </Link>
          </div>
        </div>

        {/* Points row */}
        <Link
          href="/app/profile"
          className="flex items-center justify-between px-4 py-2 hover:bg-muted/30 transition-colors"
        >
          <span className="text-sm">Points</span>
          <div className="flex items-center gap-1 text-sm">
            <Zap className="size-3.5 text-amber-500" />
            <span className="font-medium">{points}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </Link>

        {/* Menu items */}
        <div className="py-1">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/30 transition-colors"
            >
              <item.icon className="size-4 text-muted-foreground" />
              {item.label}
            </Link>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-2 text-sm w-full hover:bg-muted/30 transition-colors text-left"
        >
          <LogOut className="size-4 text-muted-foreground" />
          Sign out
        </button>
      </PopoverContent>
    </Popover>
  );
}

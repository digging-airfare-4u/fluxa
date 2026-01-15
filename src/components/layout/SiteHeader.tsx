'use client';

/**
 * SiteHeader Component
 * Common header with logo, navigation, and user controls
 * Requirements: 13.2 - Translate all alt attributes
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PointsBalanceIndicator } from '@/components/points';
import { UserPopover } from './UserPopover';
import { AuthDialog } from '@/components/auth';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/hooks';

const NAV_ITEMS = [
  { href: '/app', label: '首页' },
  { href: '/pricing', label: '价格' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const tCommon = useT('common');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  useEffect(() => {
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    setIsLoading(false);
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 flex h-14 items-center">
          {/* Left: Logo */}
          <div className="flex-1">
            <Link href="/" className="flex items-center gap-2 w-fit">
              <img src="/logo.png" alt={tCommon('accessibility.logo_alt')} className="size-8 rounded-lg" />
              <span className="font-semibold text-lg">Fluxa</span>
            </Link>
          </div>

          {/* Center: Nav */}
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  pathname === item.href
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right: User controls */}
          <div className="flex-1 flex items-center justify-end gap-3">
            <ThemeToggle />
            
            {isLoading ? (
              <div className="w-20 h-8 bg-muted animate-pulse rounded-md" />
            ) : isAuthenticated ? (
              <>
                <PointsBalanceIndicator />
                <UserPopover />
              </>
            ) : (
              <Button size="sm" onClick={() => setShowAuthDialog(true)}>
                登录 / 注册
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Auth Dialog */}
      <AuthDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog} 
      />
    </>
  );
}

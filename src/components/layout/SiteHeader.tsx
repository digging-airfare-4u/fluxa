'use client';

/**
 * SiteHeader Component
 * Common header with logo, navigation, and user controls
 * Requirements: 13.2 - Translate all alt attributes
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';
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

export function SiteHeader() {
  const pathname = usePathname();
  const tCommon = useT('common');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const navItems = [
    { href: '/app', label: tCommon('navigation.home') },
    { href: '/pricing', label: tCommon('navigation.pricing') },
  ];

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        setIsAuthenticated(!!session);
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (isMounted) {
        setIsAuthenticated(!!session);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 flex h-14 items-center">
          {/* Left: Logo */}
          <div className="flex-1">
            <Link href="/" className="flex items-center gap-2 w-fit">
              <Image
                src="/logo.png"
                alt={tCommon('accessibility.logo_alt')}
                width={32}
                height={32}
                className="size-8 rounded-lg"
              />
              <span className="font-semibold text-lg">Fluxa</span>
            </Link>
          </div>

          {/* Center: Nav */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
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
                {tCommon('navigation.login_register')}
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

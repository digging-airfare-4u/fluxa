'use client';

/**
 * Left Sidebar Navigation Component
 * Requirements: 5.7 - Left navigation bar with icons
 */

import { usePathname, useRouter } from 'next/navigation';
import { Plus, Home, FolderOpen, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
}

interface LeftSidebarProps {
  onNewProject?: () => void;
}

export function LeftSidebar({ onNewProject }: LeftSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  const navItems: NavItem[] = [
    { icon: <Plus className="size-5" />, label: '新建项目', onClick: onNewProject },
    { icon: <Home className="size-5" />, label: '首页', href: '/app', isActive: pathname === '/app' },
    { icon: <FolderOpen className="size-5" />, label: '项目列表', href: '/app/projects', isActive: pathname === '/app/projects' },
  ];

  const bottomNavItems: NavItem[] = [
    { icon: <User className="size-5" />, label: '账户', href: '/app/account', isActive: pathname === '/app/account' },
    { icon: <Settings className="size-5" />, label: '设置', href: '/app/settings', isActive: pathname === '/app/settings' },
  ];

  const renderNavItem = (item: NavItem, index: number) => {
    const isActive = item.isActive;

    return (
      <Tooltip key={index}>
        <TooltipTrigger asChild>
          <Button
            variant={isActive ? 'secondary' : 'ghost'}
            size="icon"
            onClick={item.onClick || (() => item.href && handleNavigation(item.href))}
            className={cn(
              "rounded-xl",
              isActive && "bg-primary/15 text-primary hover:bg-primary/20"
            )}
            aria-label={item.label}
          >
            {item.icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside className="left-sidebar" role="navigation" aria-label="Main navigation">
      <div className="flex flex-col items-center gap-2">
        {navItems.map(renderNavItem)}
      </div>

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-2">
        {bottomNavItems.map(renderNavItem)}
      </div>
    </aside>
  );
}

export default LeftSidebar;

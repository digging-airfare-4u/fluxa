'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className={className}
          aria-label={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
        >
          {theme === 'light' ? (
            <Moon className="size-5" />
          ) : (
            <Sun className="size-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
      </TooltipContent>
    </Tooltip>
  );
}

export default ThemeToggle;

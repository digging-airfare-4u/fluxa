'use client';

import { cn } from '@/lib/utils';

interface LoadingDotsProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-1 h-1',
  md: 'w-1.5 h-1.5',
  lg: 'w-2 h-2',
} as const;

const gapClasses = {
  sm: 'gap-0.5',
  md: 'gap-1',
  lg: 'gap-1.5',
} as const;

/**
 * LoadingDots - Three-dot loading animation component
 * 
 * Uses the dotPulse keyframe animation with staggered delays
 * to create a smooth, calm loading indicator.
 * 
 * Respects prefers-reduced-motion via CSS.
 */
function LoadingDots({ className, size = 'md' }: LoadingDotsProps) {
  return (
    <div
      className={cn('inline-flex items-center', gapClasses[size], className)}
      role="status"
      aria-label="Loading"
    >
      <span
        className={cn(
          'rounded-full bg-current animate-dot-pulse',
          sizeClasses[size]
        )}
      />
      <span
        className={cn(
          'rounded-full bg-current animate-dot-pulse-delay-1',
          sizeClasses[size]
        )}
      />
      <span
        className={cn(
          'rounded-full bg-current animate-dot-pulse-delay-2',
          sizeClasses[size]
        )}
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export { LoadingDots };
export type { LoadingDotsProps };

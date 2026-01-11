'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, X, RotateCcw } from 'lucide-react';

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  autoDismiss?: boolean;
  autoDismissDelay?: number;
  className?: string;
}

/**
 * InlineError - Inline error display component
 * 
 * Displays error messages inline below inputs (not as alert/modal).
 * Uses orange-tinted styling for a less alarming appearance.
 * Includes retry button when onRetry is provided.
 * Supports auto-dismiss with configurable delay.
 * 
 * Respects prefers-reduced-motion via CSS for fade-in animation.
 * 
 * @see Requirements 7.2, 7.3
 */
function InlineError({
  message,
  onRetry,
  onDismiss,
  autoDismiss = false,
  autoDismissDelay = 8000,
  className,
}: InlineErrorProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsAnimatingOut(true);
    // Wait for fade-out animation before calling onDismiss
    setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, 200);
  }, [onDismiss]);

  // Auto-dismiss effect
  useEffect(() => {
    if (!autoDismiss || autoDismissDelay <= 0) return;

    const timer = setTimeout(() => {
      handleDismiss();
    }, autoDismissDelay);

    return () => clearTimeout(timer);
  }, [autoDismiss, autoDismissDelay, handleDismiss]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        // Base styles
        'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
        // Orange-tinted background (not pure red)
        'bg-orange-50 dark:bg-orange-950/30',
        // Orange-tinted border
        'border border-orange-200 dark:border-orange-800/50',
        // Orange-tinted text
        'text-orange-700 dark:text-orange-300',
        // Fade-in animation on mount
        'animate-fade-in',
        // Fade-out animation when dismissing
        isAnimatingOut && 'animate-fade-out',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className="w-4 h-4 shrink-0 text-orange-500 dark:text-orange-400" />
      
      <span className="flex-1 min-w-0 truncate">{message}</span>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium',
            'bg-orange-100 dark:bg-orange-900/40',
            'hover:bg-orange-200 dark:hover:bg-orange-800/50',
            'text-orange-700 dark:text-orange-300',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-orange-400/50'
          )}
          aria-label="Retry"
        >
          <RotateCcw className="w-3 h-3" />
          Retry
        </button>
      )}

      {onDismiss && (
        <button
          type="button"
          onClick={handleDismiss}
          className={cn(
            'p-0.5 rounded-md',
            'hover:bg-orange-200 dark:hover:bg-orange-800/50',
            'text-orange-500 dark:text-orange-400',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-orange-400/50'
          )}
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export { InlineError };
export type { InlineErrorProps };

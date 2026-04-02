'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface GeneratingPlaceholderProps {
  className?: string;
}

/**
 * Chat placeholder for image generation loading state
 * Shows "生成中" with breathing animation and timer
 */
export function GeneratingPlaceholder({ className }: GeneratingPlaceholderProps) {
  const t = useTranslations('chat');
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-2xl border border-slate-200/80',
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,247,250,0.98))]',
        'px-3.5 py-2.5 text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        'dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="relative flex size-2.5 items-center justify-center">
          <span className="size-2 rounded-full bg-cyan-500" />
          <span className="absolute size-2 rounded-full bg-cyan-400/35 animate-ping" />
        </span>
        <span className="text-sm font-medium text-slate-700 dark:text-white/85">{t('status.generating')}</span>
      </div>
      <span className="text-xs tabular-nums text-slate-400 dark:text-white/45">{formatTime(elapsed)}</span>
    </div>
  );
}

/**
 * Simple shimmer placeholder box for image generation
 * Gray box with wave shimmer animation
 */
export function GeneratingPlaceholderBox({ className }: GeneratingPlaceholderProps) {
  return (
    <div className={cn('w-48 h-48 rounded-lg overflow-hidden', className)}>
      {/* Gray placeholder with wave shimmer effect */}
      <div className="relative w-full h-full bg-[#E8E8E8] dark:bg-[#3A3A3A] overflow-hidden">
        {/* Wave shimmer overlay */}
        <div className="absolute inset-0 -translate-x-full animate-wave-shimmer bg-gradient-to-r from-transparent via-white/60 dark:via-white/20 to-transparent" />
        {/* Second wave for more fluid effect */}
        <div className="absolute inset-0 -translate-x-full animate-wave-shimmer-delayed bg-gradient-to-r from-transparent via-white/30 dark:via-white/10 to-transparent" />
      </div>
    </div>
  );
}

/**
 * Canvas overlay placeholder for image generation
 * Shows on the canvas while image is being generated
 */
export function CanvasGeneratingOverlay({
  className,
  modelName,
  width = 400,
  height = 400,
}: {
  className?: string;
  modelName?: string;
  width?: number;
  height?: number;
}) {
  return (
    <div
      className={cn('pointer-events-none', className)}
      style={{ width, height }}
    >
      <div className="relative w-full h-full rounded-lg bg-[#C4C4C4] dark:bg-[#3A3A3A] overflow-hidden shadow-lg">
        {/* Floating dots animation */}
        <div className="absolute inset-0">
          <div
            className="absolute w-3 h-3 bg-white/80 rounded-full animate-float-dot"
            style={{ left: '15%', top: '25%', animationDelay: '0s' }}
          />
          <div
            className="absolute w-3 h-3 bg-white/80 rounded-full animate-float-dot"
            style={{ left: '45%', top: '15%', animationDelay: '0.3s' }}
          />
          <div
            className="absolute w-3 h-3 bg-white/80 rounded-full animate-float-dot"
            style={{ left: '75%', top: '20%', animationDelay: '0.6s' }}
          />
          <div
            className="absolute w-3 h-3 bg-white/80 rounded-full animate-float-dot"
            style={{ left: '10%', top: '50%', animationDelay: '0.9s' }}
          />
          <div
            className="absolute w-3 h-3 bg-white/80 rounded-full animate-float-dot"
            style={{ left: '50%', top: '45%', animationDelay: '1.2s' }}
          />
          <div
            className="absolute w-3 h-3 bg-white/80 rounded-full animate-float-dot"
            style={{ left: '80%', top: '55%', animationDelay: '1.5s' }}
          />
          <div
            className="absolute w-3 h-3 bg-white/80 rounded-full animate-float-dot"
            style={{ left: '20%', top: '75%', animationDelay: '1.8s' }}
          />
          <div
            className="absolute w-3 h-3 bg-white/80 rounded-full animate-float-dot"
            style={{ left: '55%', top: '80%', animationDelay: '2.1s' }}
          />
        </div>

        {/* Bottom label */}
        {modelName && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A]/80 rounded-full text-white text-sm">
              <span>使用 {modelName} 生成图片</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

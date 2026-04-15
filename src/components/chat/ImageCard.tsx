/**
 * ImageCard Component
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5 - Image card with appearance animation and hover overlay
 * Requirements: 13.1, 13.3 - Translate all aria-label and title attributes
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Download, Copy, PlusSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/hooks';

interface ImageCardProps {
  src: string;
  displaySrc?: string;
  alt?: string;
  prompt?: string;
  onDownload?: () => void;
  onCopyPrompt?: () => void;
  onAddToCanvas?: () => void;
  className?: string;
}

export function ImageCard({
  src,
  displaySrc,
  alt,
  prompt,
  onDownload,
  onCopyPrompt,
  onAddToCanvas,
  className,
}: ImageCardProps) {
  const t = useT('chat');
  const [isHovered, setIsHovered] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle drag start - set image URL as drag data
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', src);
    e.dataTransfer.setData('application/x-fluxa-image', JSON.stringify({ src, prompt }));
    e.dataTransfer.effectAllowed = 'copy';
  }, [src, prompt]);

  // Handle mouse enter with 80ms delay for overlay appearance
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    
    // Clear any pending leave timeout
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    
    // Delay overlay appearance by 80ms to prevent flicker on quick mouse passes
    hoverTimeoutRef.current = setTimeout(() => {
      setShowOverlay(true);
    }, 80);
  }, []);

  // Handle mouse leave with fade out
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    
    // Clear any pending hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    // Fade out overlay over 100ms
    leaveTimeoutRef.current = setTimeout(() => {
      setShowOverlay(false);
    }, 100);
  }, []);

  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDownload?.();
  }, [onDownload]);

  const handleCopyPrompt = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (prompt) {
      navigator.clipboard.writeText(prompt);
    }
    onCopyPrompt?.();
  }, [prompt, onCopyPrompt]);

  const handleAddToCanvas = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCanvas?.();
  }, [onAddToCanvas]);

  return (
    <div
      className={cn(
        // Base styles - no rounded corners
        'relative overflow-hidden cursor-pointer',
        // Appearance animation (fadeScaleIn)
        'animate-fade-scale-in',
        // Hover transition for scale and shadow
        'transition-all duration-200',
        // Hover effects: scale 1.01 and enhanced shadow
        isHovered && 'scale-[1.01] shadow-[var(--shadow-hover)]',
        className
      )}
      draggable
      onDragStart={handleDragStart}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Image */}
      <div className="relative w-full aspect-[4/3]">
        <Image
          src={displaySrc || src}
          alt={alt || t('assets.generated_image')}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

      {/* Hover overlay with operation buttons */}
      {showOverlay && (
        <div
          className={cn(
            // Positioning
            'absolute top-2 right-2',
            // Overlay container styling
            'flex gap-1',
            // Animation: opacity 0→1, translateY 4px→0 (120-150ms)
            'animate-[overlayIn_120ms_var(--animation-easing)_forwards]',
            // Fade out when not hovered
            !isHovered && 'animate-[overlayOut_100ms_var(--animation-easing)_forwards]'
          )}
        >
          {/* Download button */}
          {onDownload && (
            <button
              onClick={handleDownload}
              className={cn(
                'p-2 rounded-lg',
                'bg-black/60 hover:bg-black/80',
                'text-white',
                'transition-colors duration-150',
                'backdrop-blur-sm'
              )}
              title={t('actions.download')}
            >
              <Download className="size-4" />
            </button>
          )}

          {/* Copy prompt button */}
          {(onCopyPrompt || prompt) && (
            <button
              onClick={handleCopyPrompt}
              className={cn(
                'p-2 rounded-lg',
                'bg-black/60 hover:bg-black/80',
                'text-white',
                'transition-colors duration-150',
                'backdrop-blur-sm'
              )}
              title={t('actions.copy_prompt')}
            >
              <Copy className="size-4" />
            </button>
          )}

          {/* Add to canvas button */}
          {onAddToCanvas && (
            <button
              onClick={handleAddToCanvas}
              className={cn(
                'p-2 rounded-lg',
                'bg-black/60 hover:bg-black/80',
                'text-white',
                'transition-colors duration-150',
                'backdrop-blur-sm'
              )}
              title={t('actions.add_to_canvas')}
            >
              <PlusSquare className="size-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ImageCard;

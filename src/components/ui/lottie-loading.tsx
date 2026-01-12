'use client';

import Lottie from 'lottie-react';
import loadingAnimation from '../../../public/Loading #13.json';

interface LottieLoadingProps {
  size?: number;
  className?: string;
}

/**
 * Lottie loading animation component using the Lego animation
 */
export function LottieLoading({ size = 120, className }: LottieLoadingProps) {
  return (
    <div className={className}>
      <Lottie
        animationData={loadingAnimation}
        loop
        autoplay
        style={{ width: size, height: size }}
      />
    </div>
  );
}

interface FullscreenLoadingProps {
  size?: number;
  text?: string;
}

/**
 * Fullscreen loading overlay with Lottie animation
 */
export function FullscreenLoading({ size = 150, text }: FullscreenLoadingProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
      <LottieLoading size={size} />
      {text && (
        <p className="mt-4 text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );
}

'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Heart, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GalleryPublication } from '@/lib/supabase/queries/publications';

interface PublicationCardProps {
  publication: GalleryPublication;
  footerActions?: ReactNode;
  onOpenDetail?: (publicationId: string) => void;
  onRemix?: () => void | Promise<void>;
  isRemixing?: boolean;
  isRemixActive?: boolean;
  /** Compact mode for home page — fixed aspect ratio, uniform grid */
  compact?: boolean;
}

export function PublicationCard({ publication, footerActions, onOpenDetail, onRemix, isRemixing, isRemixActive, compact }: PublicationCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const t = useTranslations('common');

  return (
    <div className={cn('group block', compact ? '' : 'mb-4 break-inside-avoid')}>
      <div className={cn(
        'overflow-hidden bg-white dark:bg-[#1A1028] shadow-sm hover:shadow-md transition-all duration-200',
        compact
          ? 'rounded-2xl border-10 border-white dark:border-white/10'
          : 'rounded-xl border border-black/5 dark:border-white/5'
      )}>
        <button
          type="button"
          onClick={() => onOpenDetail?.(publication.id)}
          className="block w-full text-left cursor-pointer"
        >
          {compact ? (
            <div className="aspect-[4/3] relative bg-[#F0F0F0] dark:bg-[#0F0A1F] overflow-hidden">
              <Image
                src={publication.cover_image_url}
                alt={publication.title}
                fill
                unoptimized
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                className={cn(
                  'object-cover transition-all duration-300 group-hover:scale-[1.02]',
                  !imageLoaded && 'opacity-0'
                )}
                onLoad={() => setImageLoaded(true)}
              />
            </div>
          ) : (
            <div className="relative w-full overflow-hidden">
              <Image
                src={publication.cover_image_url}
                alt={publication.title}
                width={400}
                height={300}
                unoptimized
                className={cn(
                  'w-full h-auto object-cover transition-all duration-300 group-hover:scale-[1.02]',
                  !imageLoaded && 'opacity-0'
                )}
                onLoad={() => setImageLoaded(true)}
              />
              {!imageLoaded && <div className="absolute inset-0 bg-muted animate-pulse" style={{ aspectRatio: '4/3' }} />}

              {/* Remix hover overlay */}
              {onRemix && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-end p-2.5">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isRemixing) return;
                      void onRemix();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        if (isRemixing) return;
                        void onRemix();
                      }
                    }}
                    className={cn(
                      'h-7 px-2.5 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-sm text-xs font-medium inline-flex items-center gap-1 transition-colors',
                      'hover:bg-white dark:hover:bg-black/80',
                      isRemixing && 'opacity-60 pointer-events-none'
                    )}
                  >
                    {isRemixActive ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                    {isRemixActive ? t('actions.loading') : t('discover.remix_cta')}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="p-2.5">
            <h3 className="text-sm font-medium text-foreground line-clamp-2">{publication.title}</h3>

            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {publication.avatar_url ? (
                  <Image src={publication.avatar_url} alt="" width={16} height={16} className="size-4 rounded-full object-cover" unoptimized />
                ) : (
                  <div className="size-4 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-medium text-primary">
                    {(publication.display_name || 'U')[0]}
                  </div>
                )}
                <span className="text-xs text-muted-foreground truncate">{publication.display_name || 'User'}</span>
              </div>

              <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                <Heart className="size-3" />
                {publication.like_count}
              </span>
            </div>
          </div>
        </button>

        {footerActions && !compact ? <div className="px-2.5 pb-2.5">{footerActions}</div> : null}
      </div>
    </div>
  );
}

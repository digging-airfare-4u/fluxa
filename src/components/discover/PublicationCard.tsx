'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Eye, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GalleryPublication } from '@/lib/supabase/queries/publications';
import { LikeButton, BookmarkButton } from '@/components/social';

interface PublicationCardProps {
  publication: GalleryPublication;
  footerActions?: ReactNode;
  onOpenDetail?: (publicationId: string) => void;
  onRemix?: () => void | Promise<void>;
  isRemixing?: boolean;
  isRemixActive?: boolean;
  /** Compact mode for home page — fixed aspect ratio, no social buttons */
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
            </div>
          )}

          <div className="p-3 space-y-2">
            <h3 className="text-sm font-medium text-foreground line-clamp-1">{publication.title}</h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                {publication.avatar_url ? (
                  <Image src={publication.avatar_url} alt="" width={20} height={20} className="size-5 rounded-full object-cover" unoptimized />
                ) : (
                  <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary">
                    {(publication.display_name || 'U')[0]}
                  </div>
                )}
                <span className="text-xs text-muted-foreground truncate">{publication.display_name || 'User'}</span>
              </div>

              <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                <Eye className="size-3" />
                {publication.view_count}
              </span>
            </div>
          </div>
        </button>

        {!compact && (
          <div className="px-3 pb-3 space-y-1">
            <div className="flex items-center gap-1">
              <LikeButton publicationId={publication.id} initialCount={publication.like_count} size="sm" />
              <BookmarkButton publicationId={publication.id} initialCount={publication.bookmark_count} size="sm" />
              {onRemix ? (
                <button
                  type="button"
                  onClick={() => {
                    if (isRemixing) return;
                    void onRemix();
                  }}
                  className="h-8 px-2 rounded-md border text-xs inline-flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={!!isRemixing}
                >
                  {isRemixActive ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                  {isRemixActive ? t('actions.loading') : t('discover.remix_cta')}
                </button>
              ) : null}
            </div>

            {footerActions ? <div className="pt-1">{footerActions}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}

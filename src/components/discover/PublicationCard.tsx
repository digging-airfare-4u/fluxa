'use client';

/**
 * Discover publication card variants for gallery previews, compact home cards,
 * and the main content-first inspiration feed.
 */

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Eye, Heart, Loader2, Sparkles } from 'lucide-react';
import { getDiscoverCoverImageUrl } from '@/lib/utils/image-url';
import { cn } from '@/lib/utils';
import type { GalleryPublication } from '@/lib/supabase/queries/publications';

type PublicationCardLayout = 'default' | 'compact' | 'discover' | 'home';

interface PublicationCardProps {
  publication: GalleryPublication;
  footerActions?: ReactNode;
  onOpenDetail?: (publicationId: string) => void;
  onRemix?: () => void | Promise<void>;
  isRemixing?: boolean;
  isRemixActive?: boolean;
  compact?: boolean;
  layout?: 'default' | 'compact' | 'discover' | 'home';
}

function formatCompactStat(value: number): string {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: value >= 10000 ? 0 : 1,
  }).format(value);
}

export function PublicationCard({
  publication,
  footerActions,
  onOpenDetail,
  onRemix,
  isRemixing,
  isRemixActive,
  compact,
  layout,
}: PublicationCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const t = useTranslations('common');

  const resolvedLayout: PublicationCardLayout = layout ?? (compact ? 'compact' : 'default');
  const isCompact = resolvedLayout === 'compact';
  const isDiscover = resolvedLayout === 'discover';
  const isHome = resolvedLayout === 'home';
  const isEditorial = isDiscover || isHome;
  const displayName = publication.display_name || t('discover.anonymous');
  const coverImageSrc = getDiscoverCoverImageUrl(publication.cover_image_url, resolvedLayout);
  const coverAspectRatio =
    publication.canvas_width && publication.canvas_height
      ? `${publication.canvas_width} / ${publication.canvas_height}`
      : '4 / 3';
  const editorialImageSizes = isHome
    ? '(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1535px) 25vw, 20vw'
    : '(max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw';

  return (
    <article className={cn('group', isCompact ? '' : 'mb-6 break-inside-avoid')}>
      <div className={cn(
        'relative',
        isEditorial
          ? ''
          : 'overflow-hidden bg-white shadow-sm transition-all duration-200 hover:shadow-md dark:bg-[#1A1028]',
        isCompact
          ? 'rounded-2xl border-10 border-white dark:border-white/10'
          : !isEditorial && 'rounded-xl border border-black/5 dark:border-white/5',
      )}>
        <button
          type="button"
          onClick={() => onOpenDetail?.(publication.id)}
          className="block w-full cursor-pointer text-left"
          title={publication.title}
        >
          {isCompact ? (
            <>
              <div className="relative aspect-[4/3] overflow-hidden bg-[#F0F0F0] dark:bg-[#0F0A1F]">
                <Image
                  src={coverImageSrc}
                  alt={publication.title}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  className={cn(
                    'object-cover transition-all duration-300 group-hover:scale-[1.02]',
                    !imageLoaded && 'opacity-0',
                  )}
                  onLoad={() => setImageLoaded(true)}
                />
                {!imageLoaded && <div className="absolute inset-0 bg-muted animate-pulse" />}
              </div>

              <div className="p-2.5">
                <h3 className="text-sm font-medium text-foreground line-clamp-2">{publication.title}</h3>

                <div className="mt-1.5 flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {publication.avatar_url ? (
                      <Image
                        src={publication.avatar_url}
                        alt=""
                        width={16}
                        height={16}
                        className="size-4 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-[8px] font-medium text-primary">
                        {displayName[0]}
                      </div>
                    )}
                    <span className="truncate text-xs text-muted-foreground">{displayName}</span>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                    <Heart className="size-3" />
                    {formatCompactStat(publication.like_count)}
                  </span>
                </div>
              </div>
            </>
          ) : isEditorial ? (
            <>
              <span className="sr-only">{publication.title}</span>

              <div
                className={cn(
                  'overflow-hidden bg-white dark:bg-[#1A1028]',
                  isHome
                    ? 'rounded-[20px] border border-black/5 shadow-[0_18px_40px_-30px_rgba(17,24,39,0.28)] dark:border-white/10 dark:bg-[#181124]'
                    : 'rounded-[22px] shadow-[0_28px_60px_-36px_rgba(17,24,39,0.38)]',
                )}
              >
                <div
                  className={cn(
                    'relative w-full overflow-hidden bg-[#EDE7DD] dark:bg-[#171023]',
                    isHome && 'min-h-[12rem] max-h-[22rem]',
                  )}
                  style={{ aspectRatio: coverAspectRatio }}
                >
                  <Image
                    src={coverImageSrc}
                    alt={publication.title}
                    fill
                    unoptimized
                    sizes={editorialImageSizes}
                    className={cn(
                      'object-cover transition-transform',
                      isHome
                        ? 'duration-300 group-hover:scale-[1.015]'
                        : 'duration-500 group-hover:scale-[1.02]',
                      !imageLoaded && 'opacity-0',
                    )}
                    onLoad={() => setImageLoaded(true)}
                  />
                  {!imageLoaded && <div className="absolute inset-0 bg-muted animate-pulse" />}
                  <div
                    className={cn(
                      'absolute inset-0 bg-gradient-to-t via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100',
                      isHome ? 'from-black/10' : 'from-black/15',
                    )}
                  />
                </div>
              </div>

              <div className={cn('mt-3 flex items-center justify-between gap-3', isHome ? 'px-0.5' : 'px-1')}>
                <div className={cn('flex min-w-0 items-center', isHome ? 'gap-2' : 'gap-2.5')}>
                  {publication.avatar_url ? (
                    <Image
                      src={publication.avatar_url}
                      alt=""
                      width={isHome ? 24 : 28}
                      height={isHome ? 24 : 28}
                      className={cn(
                        'rounded-full object-cover ring-1 ring-black/5 dark:ring-white/10',
                        isHome ? 'size-6' : 'size-7',
                      )}
                      unoptimized
                    />
                  ) : (
                    <div
                      className={cn(
                        'flex items-center justify-center rounded-full bg-[#7AA95C] font-semibold text-white',
                        isHome ? 'size-6 text-[10px]' : 'size-7 text-xs',
                      )}
                    >
                      {displayName[0]}
                    </div>
                  )}

                  <span className={cn(
                    'truncate font-medium text-[#2E2A26] dark:text-white',
                    isHome ? 'text-sm' : 'text-[1.0625rem]',
                  )}>
                    {displayName}
                  </span>
                </div>

                <div className={cn(
                  'flex shrink-0 items-center text-[#9A9388] dark:text-white/55',
                  isHome ? 'gap-2 text-[11px]' : 'gap-3 text-xs',
                )}>
                  <span className="inline-flex items-center gap-1" aria-label={`${publication.view_count} ${t('discover.views')}`}>
                    <Eye className={cn(isHome ? 'size-3' : 'size-3.5')} />
                    {formatCompactStat(publication.view_count)}
                  </span>
                  <span className="inline-flex items-center gap-1" aria-label={`${publication.like_count} ${t('discover.likes')}`}>
                    <Heart className={cn(isHome ? 'size-3' : 'size-3.5')} />
                    {formatCompactStat(publication.like_count)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="relative overflow-hidden">
                <Image
                  src={coverImageSrc}
                  alt={publication.title}
                  width={400}
                  height={300}
                  unoptimized
                  className={cn(
                    'h-auto w-full object-cover transition-all duration-300 group-hover:scale-[1.02]',
                    !imageLoaded && 'opacity-0',
                  )}
                  onLoad={() => setImageLoaded(true)}
                />
                {!imageLoaded && <div className="absolute inset-0 bg-muted animate-pulse" style={{ aspectRatio: '4/3' }} />}
              </div>

              <div className="p-3">
                <h3 className="text-sm font-medium text-foreground line-clamp-2">{publication.title}</h3>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {publication.avatar_url ? (
                      <Image
                        src={publication.avatar_url}
                        alt=""
                        width={18}
                        height={18}
                        className="size-[18px] rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex size-[18px] items-center justify-center rounded-full bg-primary/10 text-[9px] font-medium text-primary">
                        {displayName[0]}
                      </div>
                    )}
                    <span className="truncate text-xs text-muted-foreground">{displayName}</span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3.5" />
                      {formatCompactStat(publication.view_count)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Heart className="size-3.5" />
                      {formatCompactStat(publication.like_count)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </button>

        {!isCompact && onRemix ? (
          <div
            className={cn(
              'pointer-events-none absolute opacity-0 transition-opacity duration-200 group-hover:opacity-100',
              isEditorial
                ? 'right-4 top-4'
                : 'inset-x-0 bottom-0 flex items-end justify-end p-2.5',
            )}
          >
            <button
              type="button"
              disabled={Boolean(isRemixing)}
              onClick={(event) => {
                event.stopPropagation();
                if (isRemixing) return;
                void onRemix();
              }}
              className={cn(
                'pointer-events-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                'bg-white/92 text-[#1F1F1F] shadow-lg backdrop-blur-sm hover:bg-white dark:bg-black/65 dark:text-white dark:hover:bg-black/80',
                Boolean(isRemixing) && 'cursor-not-allowed opacity-60',
              )}
            >
              {isRemixActive ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              {isRemixActive ? t('actions.loading') : t('discover.remix_cta')}
            </button>
          </div>
        ) : null}

        {footerActions && !isCompact && !isEditorial ? (
          <div className="px-3 pb-3">
            {footerActions}
          </div>
        ) : null}
      </div>

      {footerActions && !isCompact && isEditorial ? (
        <div className="mt-3 px-1">
          {footerActions}
        </div>
      ) : null}
    </article>
  );
}

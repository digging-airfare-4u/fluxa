'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GalleryPublication } from '@/lib/supabase/queries/publications';

const IMAGE_RATIO_CLASSES = ['aspect-[3/4]', 'aspect-[4/5]', 'aspect-square'] as const;

function getImageRatioClass(publicationId: string) {
  const hash = publicationId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return IMAGE_RATIO_CLASSES[hash % IMAGE_RATIO_CLASSES.length];
}

interface PublicationCardProps {
  publication: GalleryPublication;
  footerActions?: ReactNode;
}

export function PublicationCard({ publication, footerActions }: PublicationCardProps) {
  return (
    <article className="mb-3 break-inside-avoid space-y-3 sm:mb-4">
      <Link href={`/app/discover/${publication.id}`} className="group block">
        <div className="space-y-3">
          <div className={cn('relative overflow-hidden rounded-2xl bg-muted', getImageRatioClass(publication.id))}>
            <Image
              src={publication.cover_image_url}
              alt={publication.title}
              fill
              unoptimized
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>

          <div className="space-y-2 px-1">
            <h3 className="line-clamp-2 text-sm font-medium text-foreground">{publication.title}</h3>

            <div className="flex items-center gap-2 min-w-0">
              {publication.avatar_url ? (
                <Image src={publication.avatar_url} alt="" width={24} height={24} className="size-6 rounded-full object-cover" unoptimized />
              ) : (
                <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                  {(publication.display_name || 'U')[0]}
                </div>
              )}
              <span className="truncate text-xs text-muted-foreground">{publication.display_name || 'User'}</span>
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="size-3.5" />
              <span>{publication.like_count}</span>
            </div>
          </div>
        </div>
      </Link>

      {footerActions ? <div className="px-1">{footerActions}</div> : null}
    </article>
  );
}

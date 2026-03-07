'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GalleryPublication } from '@/lib/supabase/queries/publications';
import { LikeButton, BookmarkButton } from '@/components/social';

interface PublicationCardProps {
  publication: GalleryPublication;
  footerActions?: ReactNode;
}

export function PublicationCard({ publication, footerActions }: PublicationCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <Link href={`/app/discover/${publication.id}`} className="group block mb-4 break-inside-avoid">
      <div className="rounded-xl overflow-hidden bg-white dark:bg-[#1A1028] border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
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

          <div className="flex items-center gap-1">
            <LikeButton publicationId={publication.id} initialCount={publication.like_count} size="sm" />
            <BookmarkButton publicationId={publication.id} initialCount={publication.bookmark_count} size="sm" />
          </div>

          {footerActions ? <div className="pt-1">{footerActions}</div> : null}
        </div>
      </div>
    </Link>
  );
}

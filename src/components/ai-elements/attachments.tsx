/**
 * Attachments — AI Elements (Fluxa adaptation)
 *
 * Vendored from https://elements.ai-sdk.dev/components/attachments and adapted
 * to Fluxa's data model. Upstream depends on `FileUIPart`/`SourceDocumentUIPart`
 * from the `ai` package; Fluxa is not on the Vercel AI SDK, so this version uses
 * a local `AttachmentData` shape compatible with `ReferencedImage`
 * (`{ id, url, filename }`).
 *
 * Variants:
 *  - "grid"   thumbnails (good for message bubbles)
 *  - "inline" compact badges with hover preview (good for input areas)
 *  - "list"   rows with filename + media type
 */

'use client';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { FileIcon, FileTextIcon, ImageIcon, XIcon } from 'lucide-react';
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
} from 'react';

export type AttachmentMediaCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'unknown';

export type AttachmentData = {
  id: string;
  /** Source URL for image/video/audio previews. */
  url?: string;
  /** Display filename. */
  filename?: string;
  /** MIME type, e.g. "image/png". Optional — inferred from url/filename. */
  mediaType?: string;
};

export function getMediaCategory(data: AttachmentData): AttachmentMediaCategory {
  const mediaType = data.mediaType ?? '';
  if (mediaType.startsWith('image/')) return 'image';
  if (mediaType.startsWith('video/')) return 'video';
  if (mediaType.startsWith('audio/')) return 'audio';
  if (mediaType) return 'document';

  // Fall back to extension sniffing when no explicit media type.
  const source = data.url || data.filename || '';
  if (/\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?|$)/i.test(source)) return 'image';
  if (/\.(mp4|webm|mov|mkv)(\?|$)/i.test(source)) return 'video';
  if (/\.(mp3|wav|ogg|flac|m4a)(\?|$)/i.test(source)) return 'audio';
  if (/\.(pdf|docx?|txt|md|csv|xlsx?)(\?|$)/i.test(source)) return 'document';

  // Image hosts (e.g. signed COS URLs) often have no extension; assume image.
  if (data.url) return 'image';
  return 'unknown';
}

export function getAttachmentLabel(data: AttachmentData): string {
  if (data.filename) return data.filename;
  const category = getMediaCategory(data);
  if (category === 'image') return 'Image';
  return 'Attachment';
}

type AttachmentsVariant = 'grid' | 'inline' | 'list';

const VariantContext = createContext<AttachmentsVariant>('grid');
const AttachmentContext = createContext<{
  data: AttachmentData;
  onRemove?: () => void;
} | null>(null);

function useAttachment() {
  const ctx = useContext(AttachmentContext);
  if (!ctx) {
    throw new Error('Attachment subcomponents must be used within <Attachment>');
  }
  return ctx;
}

export type AttachmentsProps = ComponentProps<'div'> & {
  variant?: AttachmentsVariant;
};

export function Attachments({
  variant = 'grid',
  className,
  children,
  ...props
}: AttachmentsProps) {
  return (
    <VariantContext.Provider value={variant}>
      <div
        className={cn(
          'flex flex-wrap items-start gap-2',
          variant === 'list' && 'flex-col items-stretch',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </VariantContext.Provider>
  );
}

export type AttachmentProps = Omit<ComponentProps<'div'>, 'children'> & {
  data: AttachmentData;
  onRemove?: () => void;
  children?: ReactNode;
};

export function Attachment({
  data,
  onRemove,
  className,
  children,
  ...props
}: AttachmentProps) {
  const variant = useContext(VariantContext);

  return (
    <AttachmentContext.Provider value={{ data, onRemove }}>
      <div
        className={cn(
          'group relative',
          variant === 'grid' &&
            'size-16 overflow-hidden rounded-xl border border-slate-200 bg-white/85 dark:border-white/10 dark:bg-white/[0.04]',
          variant === 'inline' &&
            'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/85 px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-white/[0.06]',
          variant === 'list' &&
            'flex items-center gap-3 rounded-xl border border-slate-200 bg-white/85 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </AttachmentContext.Provider>
  );
}

function MediaThumb({
  data,
  className,
  fallbackIcon,
}: {
  data: AttachmentData;
  className?: string;
  fallbackIcon?: ReactNode;
}) {
  const category = getMediaCategory(data);

  if (category === 'image' && data.url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={getAttachmentLabel(data)}
        className={cn('size-full object-cover', className)}
        src={data.url}
      />
    );
  }

  const Icon =
    category === 'document'
      ? FileTextIcon
      : category === 'image'
        ? ImageIcon
        : FileIcon;

  return (
    <div
      className={cn(
        'flex size-full items-center justify-center bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-white/55',
        className
      )}
    >
      {fallbackIcon ?? <Icon className="size-4" />}
    </div>
  );
}

export type AttachmentPreviewProps = ComponentProps<'div'> & {
  fallbackIcon?: ReactNode;
};

export function AttachmentPreview({
  fallbackIcon,
  className,
  ...props
}: AttachmentPreviewProps) {
  const { data } = useAttachment();
  const variant = useContext(VariantContext);

  const sizeClass =
    variant === 'grid'
      ? 'size-full'
      : variant === 'inline'
        ? 'size-5 overflow-hidden rounded'
        : 'size-9 overflow-hidden rounded-lg';

  const preview = (
    <div className={cn('relative shrink-0', sizeClass, className)} {...props}>
      <MediaThumb data={data} fallbackIcon={fallbackIcon} />
    </div>
  );

  // Image attachments show a larger hover preview (inline + grid variants).
  if (variant !== 'list' && getMediaCategory(data) === 'image' && data.url) {
    return (
      <HoverCard openDelay={120} closeDelay={80}>
        <HoverCardTrigger asChild>{preview}</HoverCardTrigger>
        <HoverCardContent className="w-auto p-1" align="start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={getAttachmentLabel(data)}
            className="max-h-[220px] max-w-[220px] rounded object-contain"
            src={data.url}
          />
        </HoverCardContent>
      </HoverCard>
    );
  }

  return preview;
}

export type AttachmentInfoProps = ComponentProps<'div'> & {
  showMediaType?: boolean;
};

export function AttachmentInfo({
  showMediaType = false,
  className,
  ...props
}: AttachmentInfoProps) {
  const { data } = useAttachment();
  const variant = useContext(VariantContext);

  return (
    <div className={cn('flex min-w-0 flex-col', className)} {...props}>
      <span
        className={cn(
          'truncate text-xs font-medium text-slate-600 dark:text-white/70',
          variant === 'inline' && 'max-w-[120px]'
        )}
      >
        {getAttachmentLabel(data)}
      </span>
      {showMediaType && data.mediaType && (
        <span className="truncate text-[10px] text-slate-400 dark:text-white/45">
          {data.mediaType}
        </span>
      )}
    </div>
  );
}

export type AttachmentRemoveProps = ComponentProps<'button'> & {
  label?: string;
};

export function AttachmentRemove({
  label = 'Remove',
  className,
  ...props
}: AttachmentRemoveProps) {
  const { onRemove } = useAttachment();
  const variant = useContext(VariantContext);

  if (!onRemove) return null;

  // Grid variant overlays the remove button; others render it inline.
  if (variant === 'grid') {
    return (
      <button
        aria-label={label}
        className={cn(
          'absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/75 group-hover:opacity-100',
          className
        )}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        type="button"
        {...props}
      >
        <XIcon className="size-3" />
        <span className="sr-only">{label}</span>
      </button>
    );
  }

  return (
    <button
      aria-label={label}
      className={cn(
        'shrink-0 text-slate-400 transition-colors hover:text-slate-600 dark:text-white/40 dark:hover:text-white/70',
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      type="button"
      {...props}
    >
      <XIcon className="size-3" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export type AttachmentEmptyProps = ComponentProps<'div'>;

export function AttachmentEmpty({
  className,
  children,
  ...props
}: AttachmentEmptyProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400 dark:border-white/10 dark:text-white/45',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

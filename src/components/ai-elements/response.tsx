/**
 * Response — AI Elements (Fluxa adaptation)
 *
 * AI Elements ships `Response` as a thin wrapper around Streamdown. Streamdown
 * v2 pulls in mermaid + shiki + katex, which is far heavier than what a design
 * chat panel needs, and it would replace Fluxa's already-tuned streaming
 * markdown pipeline (stable-prefix splitting in `streaming-markdown.ts`).
 *
 * To keep the AI Elements component surface without the bundle cost, this
 * `Response` delegates to Fluxa's `ChatMarkdown` renderer. Swap the internals
 * for `streamdown` later if real Streamdown features (math/mermaid) are needed.
 */

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { ChatMarkdown } from '@/components/chat/ChatMarkdown';

export type ResponseProps = {
  children: string;
  className?: string;
  /** When true, uses the streaming-aware stable/tail rendering path. */
  streaming?: boolean;
};

export const Response = memo(
  ({ children, className, streaming = false }: ResponseProps) => (
    <div
      className={cn(
        'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className
      )}
    >
      <ChatMarkdown content={children} streaming={streaming} />
    </div>
  ),
  (prev, next) =>
    prev.children === next.children && prev.streaming === next.streaming
);

Response.displayName = 'Response';

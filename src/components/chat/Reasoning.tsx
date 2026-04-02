/**
 * Reasoning Component
 * Lightweight collapsible container for thinking and process details.
 */

'use client';

import { BrainIcon, ChevronDownIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { createContext, memo, useContext, useMemo, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface ReasoningContextValue {
  isOpen: boolean;
  isStreaming: boolean;
  durationSeconds?: number;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

function useReasoningContext(): ReasoningContextValue {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error('Reasoning components must be used within Reasoning');
  }
  return context;
}

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  durationMs?: number;
};

export const Reasoning = memo(function Reasoning({
  className,
  isStreaming = false,
  open,
  defaultOpen = true,
  onOpenChange,
  durationMs,
  children,
  ...props
}: ReasoningProps) {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = isControlled ? open : internalOpen;

  const contextValue = useMemo<ReasoningContextValue>(() => ({
    isOpen,
    isStreaming,
    durationSeconds: durationMs !== undefined
      ? Math.max(0, Math.ceil(durationMs / 1000))
      : undefined,
  }), [durationMs, isOpen, isStreaming]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <ReasoningContext.Provider value={contextValue}>
      <Collapsible
        className={cn('not-prose mb-4', className)}
        onOpenChange={handleOpenChange}
        open={isOpen}
        {...props}
      >
        {children}
      </Collapsible>
    </ReasoningContext.Provider>
  );
});

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  children?: ReactNode;
};

export const ReasoningTrigger = memo(function ReasoningTrigger({
  className,
  children,
  ...props
}: ReasoningTriggerProps) {
  const { isOpen, isStreaming, durationSeconds } = useReasoningContext();

  const defaultLabel = (() => {
    if (isStreaming) {
      return <span className="text-sm text-slate-500 dark:text-white/60 animate-pulse">Thinking...</span>;
    }
    if (durationSeconds === undefined) {
      return <span className="text-sm text-slate-500 dark:text-white/60">Thought for a few seconds</span>;
    }
    return <span className="text-sm text-slate-500 dark:text-white/60">Thought for {durationSeconds} seconds</span>;
  })();

  return (
    <CollapsibleTrigger
      className={cn(
        'group flex w-full items-center justify-between gap-3 py-1.5 text-left transition-colors',
        'text-slate-500 hover:text-slate-700 dark:text-white/60 dark:hover:text-white/82',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2">
        {children ?? (
          <>
            <BrainIcon className="size-4 shrink-0" />
            {defaultLabel}
          </>
        )}
      </div>
      <ChevronDownIcon
        className={cn(
          'size-4 shrink-0 text-slate-400 transition-transform dark:text-white/35',
          isOpen ? 'rotate-180' : 'rotate-0',
        )}
      />
    </CollapsibleTrigger>
  );
});

export type ReasoningContentProps = ComponentProps<typeof CollapsibleContent> & {
  children: ReactNode;
};

export const ReasoningContent = memo(function ReasoningContent({
  className,
  children,
  ...props
}: ReasoningContentProps) {
  return (
    <CollapsibleContent
      className={cn(
        'mt-3 border-l border-slate-200/80 pl-5 text-sm text-slate-600',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2',
        'data-[state=open]:animate-in data-[state=open]:slide-in-from-top-2',
        'dark:border-white/10 dark:text-white/65',
        className,
      )}
      {...props}
    >
      {children}
    </CollapsibleContent>
  );
});

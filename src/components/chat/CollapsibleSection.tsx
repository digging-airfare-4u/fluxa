/**
 * CollapsibleSection Component
 * Requirements: 3.1, 3.2, 3.3, 3.4 - Collapsible information sections in chat
 * 
 * A wrapper around shadcn Collapsible that provides:
 * - Title with expand/collapse indicator
 * - Smooth animation for content reveal
 * - Consistent styling for chat context
 */

'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  /** Section title displayed in the trigger */
  title: string;
  /** Whether the section is open by default */
  defaultOpen?: boolean;
  /** Content to display when expanded */
  children: React.ReactNode;
  /** Additional class names for the container */
  className?: string;
  /** Icon to display before the title (optional) */
  icon?: React.ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className,
  icon,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('w-full', className)}
    >
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2',
          'text-sm font-medium text-foreground/80',
          'bg-muted/50 hover:bg-muted/80',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        )}
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground',
            'transition-transform duration-200 ease-out',
            isOpen && 'rotate-180'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          'overflow-hidden',
          'data-[state=open]:animate-collapsible-down',
          'data-[state=closed]:animate-collapsible-up'
        )}
      >
        <div className="px-3 py-2 text-sm">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default CollapsibleSection;

'use client';

/**
 * LayerPanelToggle Component - Toggle button for layer panel
 * Requirements: 3.6, 3.7, 3.8, 14.3
 * 
 * Positioned at the bottom-left corner of the canvas area.
 * Displays a Layers icon and toggles the panel visibility on click.
 */

import { useCallback } from 'react';
import { Layers } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/hooks';
import { useIsPanelVisible, useLayerStore } from '@/lib/store/useLayerStore';

export interface LayerPanelToggleProps {
  /** Additional class names */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

export function LayerPanelToggle({ className, style }: LayerPanelToggleProps) {
  const t = useT('editor');
  const isPanelVisible = useIsPanelVisible();
  const togglePanel = useLayerStore((state) => state.togglePanel);

  const handleToggle = useCallback(() => {
    togglePanel();
  }, [togglePanel]);

  const toggleLabel = isPanelVisible 
    ? t('layer_panel.collapse') 
    : t('layer_panel.expand');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            'p-1 rounded-md',
            'text-muted-foreground hover:text-foreground',
            'hover:bg-accent/50',
            'transition-colors',
            isPanelVisible && 'text-foreground bg-accent/50',
            className
          )}
          style={style}
          onClick={handleToggle}
          aria-label={toggleLabel}
          aria-expanded={isPanelVisible}
        >
          <Layers className="size-4" strokeWidth={1.5} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {toggleLabel}
      </TooltipContent>
    </Tooltip>
  );
}

export default LayerPanelToggle;

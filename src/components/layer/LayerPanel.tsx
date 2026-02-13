'use client';

/**
 * LayerPanel Component - Layer list panel
 * Requirements: 3.1, 3.4, 3.5, 14.3
 * 
 * Displays all layers in a vertical list with:
 * - Layer items with visibility/lock toggles
 * - Selection highlighting
 * - Slide in/out animation from left
 * - Auto-updates when Layer Store changes
 */

import { useCallback } from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LayerItem } from './LayerItem';
import { useT } from '@/lib/i18n/hooks';
import {
  useLayersArray,
  useSelectedLayerId,
  useIsPanelVisible,
  useLayerStore,
} from '@/lib/store/useLayerStore';

/** Width of the layer panel in pixels */
export const LAYER_PANEL_WIDTH = 240;

export interface LayerPanelProps {
  /** Additional class names */
  className?: string;
}

export function LayerPanel({ className }: LayerPanelProps) {
  const t = useT('editor');
  const layers = useLayersArray();
  const selectedLayerId = useSelectedLayerId();
  const isPanelVisible = useIsPanelVisible();
  
  // Get store actions
  const {
    setSelectedLayer,
    toggleVisibility,
    toggleLock,
    renameLayer,
  } = useLayerStore();

  // Handle layer selection
  const handleLayerSelect = useCallback((layerId: string) => {
    setSelectedLayer(layerId);
  }, [setSelectedLayer]);

  // Handle visibility toggle
  const handleVisibilityToggle = useCallback((layerId: string) => {
    toggleVisibility(layerId);
  }, [toggleVisibility]);

  // Handle lock toggle
  const handleLockToggle = useCallback((layerId: string) => {
    toggleLock(layerId);
  }, [toggleLock]);

  // Handle rename
  const handleRename = useCallback((layerId: string, name: string) => {
    renameLayer(layerId, name);
  }, [renameLayer]);

  return (
    <div
      className={cn(
        'fixed left-3 top-3 bottom-3 z-50',
        'flex flex-col',
        'rounded-2xl overflow-hidden',
        'bg-popover/95 backdrop-blur-xl',
        'border border-border shadow-2xl',
        isPanelVisible
          ? 'animate-slide-in-left pointer-events-auto opacity-100'
          : 'animate-slide-out-left pointer-events-none opacity-0 -translate-x-4',
        className
      )}
      style={{ width: LAYER_PANEL_WIDTH }}
      role="region"
      aria-label={t('layer_panel.panel_aria')}
      aria-hidden={!isPanelVisible}
    >
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border shrink-0">
        <Layers className="size-4 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-sm font-medium">{t('layer_panel.title')}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {layers.length}
        </span>
      </div>

      {/* Layer list */}
      <div className="flex-1 p-2 overflow-y-auto space-y-0.5">
        {layers.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            {t('layer_panel.no_layers')}
          </div>
        ) : (
          // Render layers in reverse order (top layer first)
          [...layers].reverse().map((layer) => (
            <LayerItem
              key={layer.id}
              layer={layer}
              isSelected={selectedLayerId === layer.id}
              onSelect={() => handleLayerSelect(layer.id)}
              onVisibilityToggle={() => handleVisibilityToggle(layer.id)}
              onLockToggle={() => handleLockToggle(layer.id)}
              onRename={(name) => handleRename(layer.id, name)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default LayerPanel;

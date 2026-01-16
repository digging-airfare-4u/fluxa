/**
 * useLayerModification Hook
 * Handles debounced layer modification persistence
 * Requirements: 8.4 - Layer modification persistence
 */

import { useRef, useCallback, useEffect } from 'react';
import { saveOp, createUpdateLayerOp } from '@/lib/supabase/queries/ops';
import type { CanvasStageRef, LayerModifiedEvent } from '@/components/canvas';

export interface UseLayerModificationOptions {
  documentId: string;
  canvasRef: React.RefObject<CanvasStageRef | null>;
  debounceMs?: number;
}

export interface UseLayerModificationReturn {
  handleLayerModified: (event: LayerModifiedEvent) => void;
}

/**
 * Hook for handling layer modification with debounced persistence
 * Batches rapid modifications and saves them after a delay
 */
export function useLayerModification({
  documentId,
  canvasRef,
  debounceMs = 500,
}: UseLayerModificationOptions): UseLayerModificationReturn {
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingModificationsRef = useRef<Map<string, LayerModifiedEvent['properties']>>(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  /**
   * Handle layer modification with debounce
   * Batches modifications and saves after debounceMs
   */
  const handleLayerModified = useCallback((event: LayerModifiedEvent) => {
    pendingModificationsRef.current.set(event.layerId, event.properties);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      const modifications = pendingModificationsRef.current;
      pendingModificationsRef.current = new Map();

      // Use OpsPersistenceManager to update and persist
      const persistenceManager = canvasRef.current?.getPersistenceManager();
      
      for (const [layerId, properties] of modifications) {
        try {
          if (persistenceManager) {
            await persistenceManager.updateLayer(layerId, {
              left: properties.left,
              top: properties.top,
              scaleX: properties.scaleX,
              scaleY: properties.scaleY,
              angle: properties.angle,
            });
            console.log('[useLayerModification] Layer modification saved via persistence manager:', layerId);
          } else {
            // Fallback to direct saveOp if persistence manager not available
            const op = createUpdateLayerOp(layerId, {
              left: properties.left,
              top: properties.top,
              scaleX: properties.scaleX,
              scaleY: properties.scaleY,
              angle: properties.angle,
            });
            await saveOp({ documentId, op });
            console.log('[useLayerModification] Layer modification saved (fallback):', layerId);
          }
        } catch (error) {
          console.error('[useLayerModification] Failed to save layer modification:', error);
        }
      }
    }, debounceMs);
  }, [documentId, canvasRef, debounceMs]);

  return {
    handleLayerModified,
  };
}

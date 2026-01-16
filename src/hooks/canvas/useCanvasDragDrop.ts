/**
 * useCanvasDragDrop - Manages drag and drop for Fabric.js canvas
 * Requirements: Drag images from chat to canvas
 */

import { useCallback } from 'react';
import type * as fabric from 'fabric';
import type { OpsPersistenceManager } from '@/lib/canvas/opsPersistenceManager';

export interface UseCanvasDragDropOptions {
  canvas: fabric.Canvas | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  persistenceManager: OpsPersistenceManager | null;
}

export interface UseCanvasDragDropReturn {
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => Promise<void>;
}

export function useCanvasDragDrop({
  canvas,
  containerRef,
  persistenceManager,
}: UseCanvasDragDropOptions): UseCanvasDragDropReturn {
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const container = containerRef.current;
    
    if (!canvas || !container || !persistenceManager) return;

    // Try to get Fluxa image data first
    const fluxaData = e.dataTransfer.getData('application/x-fluxa-image');
    let imageUrl: string | null = null;

    if (fluxaData) {
      try {
        const data = JSON.parse(fluxaData);
        imageUrl = data.src;
      } catch {
        // Fall back to plain text
      }
    }

    // Fall back to plain text URL
    if (!imageUrl) {
      imageUrl = e.dataTransfer.getData('text/plain');
    }

    if (!imageUrl) return;

    // Calculate drop position in canvas coordinates
    const rect = container.getBoundingClientRect();
    const vpt = canvas.viewportTransform;
    if (!vpt) return;

    // Convert screen coordinates to canvas coordinates
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasX = (screenX - vpt[4]) / vpt[0];
    const canvasY = (screenY - vpt[5]) / vpt[3];

    try {
      const layerId = await persistenceManager.addImage({
        src: imageUrl,
        x: canvasX,
        y: canvasY,
      });

      // Select the newly added image
      const objects = canvas.getObjects();
      const newImage = objects.find(
        (obj) => (obj as fabric.FabricObject & { id?: string }).id === layerId
      );
      if (newImage) {
        canvas.setActiveObject(newImage);
        canvas.requestRenderAll();
      }
    } catch (error) {
      console.error('[useCanvasDragDrop] Failed to add dropped image:', error);
    }
  }, [canvas, containerRef, persistenceManager]);

  return {
    handleDragOver,
    handleDrop,
  };
}

/**
 * useCanvasSelection - Manages selection state and info for Fabric.js canvas
 * Requirements: Selection tracking and info display
 */

import { useState, useCallback, useRef, RefObject } from 'react';
import type * as fabric from 'fabric';
import type { TextProperties } from '@/components/canvas/TextToolbar';
import type { OpsPersistenceManager } from '@/lib/canvas/opsPersistenceManager';

export interface SelectionInfo {
  type: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface TextToolbarInfo {
  x: number;
  y: number;
  properties: TextProperties;
}

export interface UseCanvasSelectionOptions {
  canvas: fabric.Canvas | null;
  containerRef: RefObject<HTMLDivElement | null>;
  persistenceManager: OpsPersistenceManager | null;
}

export interface UseCanvasSelectionReturn {
  selectionInfo: SelectionInfo | null;
  textToolbarInfo: TextToolbarInfo | null;
  updateSelectionInfo: (obj: fabric.FabricObject) => void;
  clearSelection: () => void;
  handleTextPropertyChange: (property: keyof TextProperties, value: string | number | boolean) => void;
}

export function useCanvasSelection({
  canvas,
  containerRef,
  persistenceManager,
}: UseCanvasSelectionOptions): UseCanvasSelectionReturn {
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
  const [textToolbarInfo, setTextToolbarInfo] = useState<TextToolbarInfo | null>(null);
  const selectedTextRef = useRef<fabric.IText | null>(null);

  const updateSelectionInfo = useCallback((obj: fabric.FabricObject) => {
    if (!containerRef.current || !canvas) return;

    const boundingRect = obj.getBoundingRect();
    const vpt = canvas.viewportTransform;
    
    if (!vpt) return;

    // Transform canvas coordinates to screen coordinates
    const screenX = boundingRect.left * vpt[0] + vpt[4];
    const screenY = boundingRect.top * vpt[3] + vpt[5];

    setSelectionInfo({
      type: obj.type || 'object',
      width: boundingRect.width,
      height: boundingRect.height,
      x: screenX + boundingRect.width * vpt[0] / 2,
      y: screenY,
    });

    // Update text toolbar if text object is selected
    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
      const textObj = obj as fabric.IText;
      selectedTextRef.current = textObj;
      setTextToolbarInfo({
        x: screenX + boundingRect.width * vpt[0] / 2,
        y: screenY,
        properties: {
          fontFamily: textObj.fontFamily || 'Inter',
          fontSize: textObj.fontSize || 24,
          fontWeight: textObj.fontWeight as string || 'normal',
          fontStyle: textObj.fontStyle || 'normal',
          fill: (textObj.fill as string) || '#000000',
          textAlign: textObj.textAlign || 'left',
          underline: textObj.underline || false,
          linethrough: textObj.linethrough || false,
        },
      });
    } else {
      selectedTextRef.current = null;
      setTextToolbarInfo(null);
    }
  }, [canvas, containerRef]);

  const clearSelection = useCallback(() => {
    setSelectionInfo(null);
    setTextToolbarInfo(null);
    selectedTextRef.current = null;
  }, []);

  const handleTextPropertyChange = useCallback((property: keyof TextProperties, value: string | number | boolean) => {
    const textObj = selectedTextRef.current;
    if (!textObj || !canvas) return;

    // Update the text object
    textObj.set(property as keyof fabric.IText, value);
    textObj.setCoords();
    canvas.requestRenderAll();

    // Update toolbar state
    setTextToolbarInfo(prev => {
      if (!prev) return null;
      return {
        ...prev,
        properties: {
          ...prev.properties,
          [property]: value,
        },
      };
    });

    // Persist the change
    const layerId = (textObj as fabric.IText & { id?: string }).id;
    if (layerId && persistenceManager) {
      persistenceManager.updateLayer(layerId, {
        [property]: value,
      } as Record<string, unknown>).catch((error) => {
        console.error('[useCanvasSelection] Failed to persist text property change:', error);
      });
    }
  }, [canvas, persistenceManager]);

  return {
    selectionInfo,
    textToolbarInfo,
    updateSelectionInfo,
    clearSelection,
    handleTextPropertyChange,
  };
}

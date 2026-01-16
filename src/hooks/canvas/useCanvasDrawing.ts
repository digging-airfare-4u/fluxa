/**
 * useCanvasDrawing - Manages rectangle and text drawing for Fabric.js canvas
 * Requirements: Rectangle and text tool drawing
 */

import { useEffect, useRef, useCallback } from 'react';
import * as fabric from 'fabric';
import type { ToolType } from '@/components/canvas/types';
import type { OpsPersistenceManager } from '@/lib/canvas/opsPersistenceManager';

export interface UseCanvasDrawingOptions {
  canvas: fabric.Canvas | null;
  activeTool: ToolType;
  spacePressed: boolean;
  persistenceManager: OpsPersistenceManager | null;
  onToolReset?: () => void;
}

export interface UseCanvasDrawingReturn {
  generateLayerId: () => string;
}

export function useCanvasDrawing({
  canvas,
  activeTool,
  spacePressed,
  persistenceManager,
  onToolReset,
}: UseCanvasDrawingOptions): UseCanvasDrawingReturn {
  const isDrawingRef = useRef(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const currentShapeRef = useRef<fabric.FabricObject | null>(null);

  const generateLayerId = useCallback(() => {
    return `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Rectangle and Text tool drawing
  useEffect(() => {
    if (!canvas) return;
    if (activeTool !== 'rectangle' && activeTool !== 'text') return;

    const handleMouseDown = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (spacePressed) return; // Don't draw while panning
      
      const pointer = canvas.getScenePoint(opt.e);
      drawStartRef.current = { x: pointer.x, y: pointer.y };
      isDrawingRef.current = true;

      if (activeTool === 'rectangle') {
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: 'transparent',
          stroke: '#000000',
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });
        canvas.add(rect);
        currentShapeRef.current = rect;
      }
    };

    const handleMouseMove = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (!isDrawingRef.current || !drawStartRef.current) return;
      if (activeTool !== 'rectangle') return;

      const pointer = canvas.getScenePoint(opt.e);
      const rect = currentShapeRef.current as fabric.Rect;
      if (!rect) return;

      const left = Math.min(drawStartRef.current.x, pointer.x);
      const top = Math.min(drawStartRef.current.y, pointer.y);
      const width = Math.abs(pointer.x - drawStartRef.current.x);
      const height = Math.abs(pointer.y - drawStartRef.current.y);

      rect.set({ left, top, width, height });
      canvas.requestRenderAll();
    };

    const handleMouseUp = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (!isDrawingRef.current || !drawStartRef.current) return;

      const pointer = canvas.getScenePoint(opt.e);

      if (activeTool === 'rectangle' && currentShapeRef.current) {
        const rect = currentShapeRef.current as fabric.Rect;
        // Only keep if it has some size
        if ((rect.width ?? 0) > 5 && (rect.height ?? 0) > 5) {
          // Remove the temporary preview rect
          canvas.remove(rect);
          
          // Use OpsPersistenceManager to create and persist the rect
          if (persistenceManager) {
            persistenceManager.addRect({
              x: rect.left ?? 0,
              y: rect.top ?? 0,
              width: rect.width ?? 0,
              height: rect.height ?? 0,
              fill: (rect.fill as string) ?? 'transparent',
              stroke: (rect.stroke as string) ?? '#000000',
              strokeWidth: rect.strokeWidth ?? 2,
            }).then((layerId) => {
              // Select the newly created rect
              const objects = canvas.getObjects();
              const newRect = objects.find(
                (obj) => (obj as fabric.FabricObject & { id?: string }).id === layerId
              );
              if (newRect) {
                canvas.setActiveObject(newRect);
                canvas.requestRenderAll();
              }
            }).catch((error) => {
              console.error('[useCanvasDrawing] Failed to create rect:', error);
            });
          }
        } else {
          canvas.remove(rect);
        }
      } else if (activeTool === 'text') {
        // Use OpsPersistenceManager to create and persist the text
        if (persistenceManager) {
          const defaultText = '双击编辑文字';
          persistenceManager.addText({
            text: defaultText,
            x: pointer.x,
            y: pointer.y,
            fontSize: 24,
            fontFamily: 'Inter, sans-serif',
            fill: '#000000',
          }).then((layerId) => {
            // Select the newly created text and enter editing mode
            const objects = canvas.getObjects();
            const newText = objects.find(
              (obj) => (obj as fabric.FabricObject & { id?: string }).id === layerId
            ) as fabric.IText | undefined;
            if (newText) {
              canvas.setActiveObject(newText);
              newText.enterEditing();
              newText.selectAll();
              canvas.requestRenderAll();
            }
          }).catch((error) => {
            console.error('[useCanvasDrawing] Failed to create text:', error);
          });
        }
      }

      isDrawingRef.current = false;
      drawStartRef.current = null;
      currentShapeRef.current = null;
      
      // Reset to select tool after drawing
      onToolReset?.();
      canvas.requestRenderAll();
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [canvas, activeTool, spacePressed, persistenceManager, onToolReset]);

  // Pencil tool - handle path created
  useEffect(() => {
    if (!canvas) return;
    if (activeTool !== 'pencil') return;

    const handlePathCreated = (opt: { path: fabric.Path }) => {
      const path = opt.path;
      (path as fabric.Path & { id?: string }).id = generateLayerId();
    };

    canvas.on('path:created', handlePathCreated);

    return () => {
      canvas.off('path:created', handlePathCreated);
    };
  }, [canvas, activeTool, generateLayerId]);

  return {
    generateLayerId,
  };
}

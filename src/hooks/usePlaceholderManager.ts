/**
 * usePlaceholderManager Hook
 * Manages placeholder rectangles for image generation preview
 * Requirements: 4.1, 4.2 - Three-phase generation feedback
 */

import { useRef, useCallback } from 'react';
import * as fabric from 'fabric';
import type { CanvasStageRef } from '@/components/canvas';

export interface PlaceholderPosition {
  x: number;
  y: number;
}

export interface UsePlaceholderManagerOptions {
  canvasRef: React.RefObject<CanvasStageRef | null>;
}

export interface UsePlaceholderManagerReturn {
  addPlaceholder: (id: string, x: number, y: number, width: number, height: number) => void;
  removePlaceholder: (id: string) => void;
  getPlaceholderPosition: (id: string) => PlaceholderPosition | null;
}

// Extended fabric object with placeholder properties
interface PlaceholderObject extends fabric.FabricObject {
  placeholderId?: string;
  stopAnimation?: () => void;
}

/**
 * Hook for managing placeholder rectangles during image generation
 * Placeholders are draggable and have shimmer animation
 */
export function usePlaceholderManager({
  canvasRef,
}: UsePlaceholderManagerOptions): UsePlaceholderManagerReturn {
  const placeholdersRef = useRef<Map<string, fabric.FabricObject>>(new Map());

  /**
   * Add a placeholder rectangle to the canvas
   * The placeholder is selectable and draggable with shimmer animation
   */
  const addPlaceholder = useCallback((
    id: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;

    // Create a placeholder rectangle - selectable and draggable
    // Using darker metallic colors for canvas placeholder
    const placeholder = new fabric.Rect({
      left: x,
      top: y,
      width,
      height,
      fill: '#9CA3AF', // Darker metallic gray
      rx: 8,
      ry: 8,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      stroke: '#6B7280', // Darker border for metallic effect
      strokeWidth: 1,
      shadow: new fabric.Shadow({
        color: 'rgba(0, 0, 0, 0.15)',
        blur: 12,
        offsetX: 0,
        offsetY: 4,
      }),
    }) as PlaceholderObject;

    // Store custom id for tracking
    placeholder.placeholderId = id;

    canvas.add(placeholder);
    placeholdersRef.current.set(id, placeholder);
    canvas.requestRenderAll();

    // Add shimmer animation effect using opacity
    // Darker metallic shimmer effect
    let animating = true;
    const animateShimmer = () => {
      if (!animating || !placeholdersRef.current.has(id)) return;
      
      placeholder.animate({ opacity: 0.5 }, {
        duration: 1000,
        easing: fabric.util.ease.easeInOutSine,
        onChange: () => canvas.requestRenderAll(),
        onComplete: () => {
          if (!animating || !placeholdersRef.current.has(id)) return;
          placeholder.animate({ opacity: 0.85 }, {
            duration: 1000,
            easing: fabric.util.ease.easeInOutSine,
            onChange: () => canvas.requestRenderAll(),
            onComplete: animateShimmer,
          });
        },
      });
    };
    animateShimmer();

    // Store cleanup function
    placeholder.stopAnimation = () => {
      animating = false;
    };
  }, [canvasRef]);

  /**
   * Get placeholder's current position (after user may have dragged it)
   */
  const getPlaceholderPosition = useCallback((id: string): PlaceholderPosition | null => {
    const placeholder = placeholdersRef.current.get(id);
    if (!placeholder) return null;
    return {
      x: placeholder.left ?? 0,
      y: placeholder.top ?? 0,
    };
  }, []);

  /**
   * Remove a placeholder from the canvas
   */
  const removePlaceholder = useCallback((id: string) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;

    const placeholder = placeholdersRef.current.get(id) as PlaceholderObject | undefined;
    if (placeholder) {
      // Stop animation
      placeholder.stopAnimation?.();
      canvas.remove(placeholder);
      placeholdersRef.current.delete(id);
      canvas.requestRenderAll();
    }
  }, [canvasRef]);

  return {
    addPlaceholder,
    removePlaceholder,
    getPlaceholderPosition,
  };
}

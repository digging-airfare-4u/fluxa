/**
 * useCanvasZoom - Manages zoom functionality for Fabric.js canvas
 * Requirements: Canvas zoom with scroll and button controls
 */

import { useState, useCallback, useEffect, RefObject } from 'react';
import * as fabric from 'fabric';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
export const ZOOM_FACTOR = 1.15; // 15% per scroll step
export const ZOOM_STEP = 0.5; // Step for button clicks
const PAN_SENSITIVITY = 1;

export interface UseCanvasZoomOptions {
  canvas: fabric.Canvas | null;
  containerRef: RefObject<HTMLDivElement | null>;
}

export interface UseCanvasZoomReturn {
  zoom: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  resetView: () => void;
}

export function useCanvasZoom({ canvas, containerRef }: UseCanvasZoomOptions): UseCanvasZoomReturn {
  const [zoom, setZoomState] = useState(1);

  const setZoom = useCallback((newZoom: number) => {
    if (!canvas || !containerRef.current) return;

    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    
    // Zoom to center of viewport
    const container = containerRef.current;
    const center = new fabric.Point(container.clientWidth / 2, container.clientHeight / 2);
    canvas.zoomToPoint(center, clampedZoom);
    setZoomState(clampedZoom);
  }, [canvas, containerRef]);

  const zoomIn = useCallback(() => {
    setZoom(zoom + ZOOM_STEP);
  }, [zoom, setZoom]);

  const zoomOut = useCallback(() => {
    setZoom(zoom - ZOOM_STEP);
  }, [zoom, setZoom]);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, [setZoom]);

  const resetView = useCallback(() => {
    if (!canvas || !containerRef.current) return;
    
    const container = containerRef.current;
    
    // Reset to 100% zoom and center at origin
    canvas.setZoom(1);
    setZoomState(1);
    
    const vpt = canvas.viewportTransform;
    if (vpt) {
      vpt[4] = container.clientWidth / 2;
      vpt[5] = container.clientHeight / 2;
      canvas.setViewportTransform(vpt);
    }
  }, [canvas, containerRef]);

  // Handle zoom with mouse wheel
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Ctrl/Cmd + wheel = zoom
      if (e.ctrlKey || e.metaKey) {
        const direction = e.deltaY > 0 ? -1 : 1;
        let newZoom = canvas.getZoom() * Math.pow(ZOOM_FACTOR, direction);
        
        newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

        // Zoom to mouse position
        const rect = container.getBoundingClientRect();
        const point = new fabric.Point(e.clientX - rect.left, e.clientY - rect.top);
        canvas.zoomToPoint(point, newZoom);
        setZoomState(newZoom);
      } else {
        // Plain wheel = pan (scroll)
        const vpt = canvas.viewportTransform;
        if (vpt) {
          if (e.shiftKey) {
            vpt[4] -= e.deltaY * PAN_SENSITIVITY;
          } else {
            vpt[4] -= e.deltaX * PAN_SENSITIVITY;
            vpt[5] -= e.deltaY * PAN_SENSITIVITY;
          }
          canvas.setViewportTransform(vpt);
          canvas.requestRenderAll();
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [canvas, containerRef]);

  return {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    resetView,
  };
}

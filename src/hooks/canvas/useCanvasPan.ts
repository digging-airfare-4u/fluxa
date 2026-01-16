/**
 * useCanvasPan - Manages panning functionality for Fabric.js canvas
 * Requirements: Space+drag and middle mouse panning
 */

import { useState, useCallback, useEffect, useRef, RefObject } from 'react';
import type * as fabric from 'fabric';
import type { ToolType } from '@/components/canvas/types';

export interface UseCanvasPanOptions {
  canvas: fabric.Canvas | null;
  containerRef: RefObject<HTMLDivElement | null>;
  activeTool: ToolType;
}

export interface UseCanvasPanReturn {
  isPanning: boolean;
  spacePressed: boolean;
}

export function useCanvasPan({ canvas, containerRef, activeTool }: UseCanvasPanOptions): UseCanvasPanReturn {
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Space key for panning mode
  useEffect(() => {
    const isInputElement = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return (
        tagName === 'input' ||
        tagName === 'textarea' ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputElement(e.target)) return;
      
      if (e.code === 'Space' && !spacePressed) {
        setSpacePressed(true);
        if (containerRef.current) {
          containerRef.current.style.cursor = 'grab';
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isInputElement(e.target)) return;
      
      if (e.code === 'Space') {
        setSpacePressed(false);
        setIsPanning(false);
        if (containerRef.current) {
          containerRef.current.style.cursor = 'default';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [spacePressed, containerRef]);

  // Panning with space+drag or middle mouse
  useEffect(() => {
    if (!canvas) return;

    const handleMouseDown = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      const evt = opt.e as MouseEvent;
      if (evt.button === 1 || (evt.button === 0 && spacePressed)) {
        setIsPanning(true);
        canvas.selection = false;
        lastPosRef.current = { x: evt.clientX, y: evt.clientY };
        if (containerRef.current) {
          containerRef.current.style.cursor = 'grabbing';
        }
      }
    };

    const handleMouseMove = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (!isPanning || !lastPosRef.current) return;

      const evt = opt.e as MouseEvent;
      const vpt = canvas.viewportTransform;
      if (vpt) {
        vpt[4] += evt.clientX - lastPosRef.current.x;
        vpt[5] += evt.clientY - lastPosRef.current.y;
        canvas.requestRenderAll();
        lastPosRef.current = { x: evt.clientX, y: evt.clientY };
      }
    };

    const handleMouseUp = () => {
      if (!isPanning) return;
      setIsPanning(false);
      // Only restore selection for select/boxSelect tools
      if (activeTool === 'select' || activeTool === 'boxSelect') {
        canvas.selection = true;
      }
      lastPosRef.current = null;
      if (containerRef.current) {
        containerRef.current.style.cursor = spacePressed ? 'grab' : 'default';
      }
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [canvas, isPanning, spacePressed, activeTool, containerRef]);

  return {
    isPanning,
    spacePressed,
  };
}

/**
 * useCanvasHistory - Manages undo/redo history for Fabric.js canvas
 * Requirements: Canvas history management
 */

import { useRef, useCallback } from 'react';
import type * as fabric from 'fabric';

const MAX_HISTORY_SIZE = 50;

export interface UseCanvasHistoryOptions {
  canvas: fabric.Canvas | null;
}

export interface UseCanvasHistoryReturn {
  saveHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useCanvasHistory({ canvas }: UseCanvasHistoryOptions): UseCanvasHistoryReturn {
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);

  const saveHistory = useCallback(() => {
    if (isUndoRedoRef.current || !canvas) return;

    const json = JSON.stringify(canvas.toJSON());
    
    // Remove any redo states
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(json);
    historyIndexRef.current = historyRef.current.length - 1;

    // Limit history size
    if (historyRef.current.length > MAX_HISTORY_SIZE) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }
  }, [canvas]);

  const undo = useCallback(() => {
    if (!canvas || historyIndexRef.current <= 0) return;

    isUndoRedoRef.current = true;
    historyIndexRef.current--;
    const state = historyRef.current[historyIndexRef.current];

    canvas.loadFromJSON(JSON.parse(state)).then(() => {
      canvas.requestRenderAll();
      isUndoRedoRef.current = false;
    });
  }, [canvas]);

  const redo = useCallback(() => {
    if (!canvas || historyIndexRef.current >= historyRef.current.length - 1) return;

    isUndoRedoRef.current = true;
    historyIndexRef.current++;
    const state = historyRef.current[historyIndexRef.current];

    canvas.loadFromJSON(JSON.parse(state)).then(() => {
      canvas.requestRenderAll();
      isUndoRedoRef.current = false;
    });
  }, [canvas]);

  return {
    saveHistory,
    undo,
    redo,
    canUndo: historyIndexRef.current > 0,
    canRedo: historyIndexRef.current < historyRef.current.length - 1,
  };
}

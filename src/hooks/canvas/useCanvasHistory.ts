/**
 * useCanvasHistory - Manages undo/redo history for Fabric.js canvas
 * Requirements: Canvas history management
 */

import { useRef, useCallback, useState } from 'react';
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
  const [availability, setAvailability] = useState({ canUndo: false, canRedo: false });

  const syncAvailability = useCallback(() => {
    const next = {
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current >= 0 && historyIndexRef.current < historyRef.current.length - 1,
    };

    setAvailability((prev) =>
      prev.canUndo === next.canUndo && prev.canRedo === next.canRedo ? prev : next
    );
  }, []);

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

    syncAvailability();
  }, [canvas, syncAvailability]);

  const undo = useCallback(() => {
    if (!canvas || historyIndexRef.current <= 0) return;

    isUndoRedoRef.current = true;
    historyIndexRef.current--;
    const state = historyRef.current[historyIndexRef.current];
    syncAvailability();

    canvas.loadFromJSON(JSON.parse(state)).then(() => {
      canvas.requestRenderAll();
      isUndoRedoRef.current = false;
    });
  }, [canvas, syncAvailability]);

  const redo = useCallback(() => {
    if (!canvas || historyIndexRef.current >= historyRef.current.length - 1) return;

    isUndoRedoRef.current = true;
    historyIndexRef.current++;
    const state = historyRef.current[historyIndexRef.current];
    syncAvailability();

    canvas.loadFromJSON(JSON.parse(state)).then(() => {
      canvas.requestRenderAll();
      isUndoRedoRef.current = false;
    });
  }, [canvas, syncAvailability]);

  return {
    saveHistory,
    undo,
    redo,
    canUndo: availability.canUndo,
    canRedo: availability.canRedo,
  };
}

/**
 * useCanvasContextMenu - Manages context menu state and actions for Fabric.js canvas
 * Requirements: Right-click context menu with copy, paste, layer ordering
 */

import { useState, useCallback, useRef } from 'react';
import type * as fabric from 'fabric';

export interface ContextMenuState {
  x: number;
  y: number;
}

export interface UseCanvasContextMenuOptions {
  canvas: fabric.Canvas | null;
}

export interface UseCanvasContextMenuReturn {
  contextMenu: ContextMenuState | null;
  canPaste: boolean;
  openContextMenu: (e: React.MouseEvent) => void;
  closeContextMenu: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
  handleBringForward: () => void;
  handleSendBackward: () => void;
  handleBringToFront: () => void;
  handleSendToBack: () => void;
}

export function useCanvasContextMenu({ canvas }: UseCanvasContextMenuOptions): UseCanvasContextMenuReturn {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const clipboardRef = useRef<fabric.FabricObject | null>(null);

  const openContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  }, [canvas]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCopy = useCallback(() => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      activeObject.clone().then((cloned: fabric.FabricObject) => {
        clipboardRef.current = cloned;
      });
    }
  }, [canvas]);

  const handlePaste = useCallback(() => {
    if (!canvas || !clipboardRef.current) return;
    
    clipboardRef.current.clone().then((cloned: fabric.FabricObject) => {
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
    });
  }, [canvas]);

  const handleBringForward = useCallback(() => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.bringObjectForward(activeObject);
      canvas.requestRenderAll();
    }
  }, [canvas]);

  const handleSendBackward = useCallback(() => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.sendObjectBackwards(activeObject);
      canvas.requestRenderAll();
    }
  }, [canvas]);

  const handleBringToFront = useCallback(() => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.bringObjectToFront(activeObject);
      canvas.requestRenderAll();
    }
  }, [canvas]);

  const handleSendToBack = useCallback(() => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.sendObjectToBack(activeObject);
      canvas.requestRenderAll();
    }
  }, [canvas]);

  return {
    contextMenu,
    canPaste: clipboardRef.current !== null,
    openContextMenu,
    closeContextMenu,
    handleCopy,
    handlePaste,
    handleBringForward,
    handleSendBackward,
    handleBringToFront,
    handleSendToBack,
  };
}

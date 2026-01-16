/**
 * useCanvasKeyboard - Manages keyboard shortcuts for Fabric.js canvas
 * Requirements: Keyboard shortcuts for delete, undo, redo, reset view
 */

import { useEffect } from 'react';

export interface UseCanvasKeyboardOptions {
  deleteSelected: () => void;
  undo: () => void;
  redo: () => void;
  resetView: () => void;
  enabled?: boolean;
}

export function useCanvasKeyboard({
  deleteSelected,
  undo,
  redo,
  resetView,
  enabled = true,
}: UseCanvasKeyboardOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input field
      const activeElement = document.activeElement;
      const isTyping = activeElement?.tagName === 'INPUT' || 
                       activeElement?.tagName === 'TEXTAREA' ||
                       (activeElement as HTMLElement)?.isContentEditable;

      // Delete selected object
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isTyping) {
          e.preventDefault();
          deleteSelected();
        }
      }

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (!isTyping) {
          e.preventDefault();
          undo();
        }
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        if (!isTyping) {
          e.preventDefault();
          redo();
        }
      }

      // Reset view: Ctrl+0
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        resetView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, undo, redo, resetView, enabled]);
}

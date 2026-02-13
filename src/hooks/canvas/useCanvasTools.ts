/**
 * useCanvasTools - Manages tool mode and cursor for Fabric.js canvas
 * Requirements: Tool switching and cursor management
 */

import { useEffect } from 'react';
import * as fabric from 'fabric';
import type { ToolType } from '@/components/canvas/types';

// Custom cursor SVG for select tool (black arrow like Figma)
const SELECT_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M4 4L10.5 20L13 13L20 10.5L4 4Z" fill="black" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;

export const SELECT_CURSOR_URL = `url('data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa(SELECT_CURSOR_SVG) : ''}') 4 4, default`;

export interface UseCanvasToolsOptions {
  canvas: fabric.Canvas | null;
  activeTool: ToolType;
}

function applyToolToCanvas(canvas: fabric.Canvas, activeTool: ToolType): void {
  // Reset drawing mode
  canvas.isDrawingMode = false;
  canvas.selection = true;

  // Set cursor based on tool
  switch (activeTool) {
    case 'rectangle':
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
      canvas.selection = false;
      break;
    case 'text':
      canvas.defaultCursor = 'text';
      canvas.hoverCursor = 'text';
      canvas.selection = false;
      break;
    case 'pencil':
      canvas.isDrawingMode = true;
      canvas.selection = false;
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = '#000000';
      canvas.freeDrawingBrush.width = 2;
      break;
    case 'boxSelect':
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
      canvas.selection = true;
      break;
    default:
      // Select tool - restore default cursor
      canvas.defaultCursor = SELECT_CURSOR_URL;
      canvas.hoverCursor = SELECT_CURSOR_URL;
      break;
  }

  canvas.requestRenderAll();
}

export function useCanvasTools({ canvas, activeTool }: UseCanvasToolsOptions): void {
  useEffect(() => {
    if (!canvas) return;
    applyToolToCanvas(canvas, activeTool);
  }, [canvas, activeTool]);
}

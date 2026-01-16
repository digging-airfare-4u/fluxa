/**
 * Canvas Types - Shared type definitions for canvas components and hooks
 * Requirements: 2.1, 2.2, 2.3
 */

import type * as fabric from 'fabric';

export type ToolType = 'select' | 'boxSelect' | 'rectangle' | 'text' | 'pencil' | 'image' | 'ai';

export interface LayerInfo {
  id: string;
  type: 'text' | 'image' | 'rect' | 'background';
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface CanvasState {
  objects: fabric.FabricObject[];
  backgroundColor: string | fabric.TFiller | null;
}

export interface LayerModifiedEvent {
  layerId: string;
  properties: {
    left: number;
    top: number;
    scaleX: number;
    scaleY: number;
    angle: number;
  };
}

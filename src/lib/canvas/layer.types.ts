/**
 * Layer System Type Definitions
 * Requirements: 1.1, 1.2, 1.3
 * 
 * Defines the core Layer data model and store interfaces for the Fluxa layer system.
 * Layers provide business-level abstraction over Fabric.js canvas objects.
 */

/**
 * Layer type enumeration
 * Currently supports rect, text, and image, extensible for future types
 * Requirements: 1.1
 */
export type LayerType = 'rect' | 'text' | 'image';

/**
 * Core Layer interface
 * Represents a single canvas element's business semantics
 * Requirements: 1.1, 1.2, 1.3
 */
export interface Layer {
  /** Stable unique identifier, persists across sessions */
  id: string;
  
  /** Display name, auto-generated based on type and order */
  name: string;
  
  /** Layer type, determines icon and behavior */
  type: LayerType;
  
  /** Visibility state - hidden layers are invisible and unselectable */
  visible: boolean;
  
  /** Lock state - locked layers cannot be selected or modified */
  locked: boolean;
  
  /** Reference to corresponding Fabric.js object ID */
  canvasObjectId: string;
}

/**
 * Layer store state interface
 * Requirements: 1.4, 1.5
 */
export interface LayerState {
  /** All layers, keyed by layer ID */
  layers: Map<string, Layer>;
  
  /** Currently selected layer ID, null if none */
  selectedLayerId: string | null;
  
  /** Layer panel visibility state */
  isPanelVisible: boolean;
  
  /** Counter for auto-naming (per type) */
  nameCounters: Record<LayerType, number>;
}

/**
 * Layer store actions interface
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.1
 */
export interface LayerActions {
  /** Create a new layer for a canvas object */
  createLayer: (type: LayerType, canvasObjectId: string) => Layer;
  
  /** Remove a layer by ID */
  removeLayer: (layerId: string) => void;
  
  /** Toggle layer visibility */
  toggleVisibility: (layerId: string) => void;
  
  /** Toggle layer lock state */
  toggleLock: (layerId: string) => void;
  
  /** Rename a layer */
  renameLayer: (layerId: string, name: string) => void;
  
  /** Set selected layer (from panel or canvas) */
  setSelectedLayer: (layerId: string | null) => void;
  
  /** Toggle panel visibility */
  togglePanel: () => void;
  
  /** Get layer by canvas object ID */
  getLayerByCanvasObjectId: (canvasObjectId: string) => Layer | undefined;
  
  /** Get all layers as ordered array */
  getLayersArray: () => Layer[];
}

/**
 * Combined Layer store type
 */
export type LayerStore = LayerState & LayerActions;

/**
 * Type names for auto-generated layer names (Chinese)
 */
export const LAYER_TYPE_NAMES: Record<LayerType, string> = {
  rect: '矩形',
  text: '文字',
  image: '图片',
};

/**
 * Generate a unique layer ID
 */
export function generateLayerId(): string {
  return `layer-${crypto.randomUUID()}`;
}

/**
 * Generate a default layer name based on type and counter
 * Requirements: 1.4
 */
export function generateLayerName(type: LayerType, counter: number): string {
  return `${LAYER_TYPE_NAMES[type]} ${counter}`;
}

/**
 * Type guard to check if a value is a valid LayerType
 */
export function isLayerType(value: unknown): value is LayerType {
  return value === 'rect' || value === 'text' || value === 'image';
}

/**
 * Type guard to check if an object is a valid Layer
 */
export function isLayer(obj: unknown): obj is Layer {
  if (!obj || typeof obj !== 'object') return false;
  
  const layer = obj as Record<string, unknown>;
  
  return (
    typeof layer.id === 'string' &&
    typeof layer.name === 'string' &&
    isLayerType(layer.type) &&
    typeof layer.visible === 'boolean' &&
    typeof layer.locked === 'boolean' &&
    typeof layer.canvasObjectId === 'string'
  );
}

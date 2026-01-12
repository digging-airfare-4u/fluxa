/**
 * Canvas Synchronizer
 * Requirements: 7.1, 7.3, 4.2, 4.3, 4.5, 5.2, 5.3, 5.5, 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.3
 *
 * Responsible for bidirectional state synchronization between Layer Store and Fabric.js Canvas.
 * Key principle: Layer Store is the source of truth, Canvas is the rendering implementation.
 *
 * Data flow:
 * - Layer → Canvas: visibility, lock state, selection changes
 * - Canvas → Layer: object creation, deletion, selection events
 */

import * as fabric from 'fabric';
import type { Layer, LayerType } from './layer.types';
import { isLayerType } from './layer.types';

/**
 * Extended Fabric object with custom properties
 */
export interface FabricObjectWithId extends fabric.FabricObject {
  id?: string;
  name?: string;
  layerType?: string;
}

/**
 * Fabric.js event types for object events
 */
interface ObjectEvent {
  target: fabric.FabricObject;
}

/**
 * Fabric.js event types for selection events
 */
interface SelectionEvent {
  selected?: fabric.FabricObject[];
  deselected?: fabric.FabricObject[];
}

/**
 * Configuration for Canvas Synchronizer
 */
export interface CanvasSynchronizerConfig {
  /** Fabric.js canvas instance */
  canvas: fabric.Canvas;

  /** Callbacks for Layer Store operations */
  onLayerCreate: (type: LayerType, canvasObjectId: string) => Layer;
  onLayerRemove: (layerId: string) => void;
  onSelectionChange: (layerId: string | null) => void;

  /** Get layer by canvas object ID */
  getLayerByCanvasObjectId: (canvasObjectId: string) => Layer | undefined;

  /** Get all layers */
  getLayersArray: () => Layer[];
}

/**
 * Canvas Synchronizer class
 * Manages bidirectional synchronization between Layer Store and Fabric.js Canvas
 */
export class CanvasSynchronizer {
  private canvas: fabric.Canvas;
  private onLayerCreate: CanvasSynchronizerConfig['onLayerCreate'];
  private onLayerRemove: CanvasSynchronizerConfig['onLayerRemove'];
  private onSelectionChange: CanvasSynchronizerConfig['onSelectionChange'];
  private getLayerByCanvasObjectId: CanvasSynchronizerConfig['getLayerByCanvasObjectId'];
  private getLayersArray: CanvasSynchronizerConfig['getLayersArray'];

  /** Flag to prevent circular updates */
  private isUpdating: boolean = false;

  /**
   * Set the updating flag to prevent circular updates
   * Call this before batch operations like ops replay
   */
  setUpdating(value: boolean): void {
    this.isUpdating = value;
  }

  /**
   * Check if currently updating
   */
  getIsUpdating(): boolean {
    return this.isUpdating;
  }

  /** Bound event handlers for cleanup */
  private boundHandlers: {
    objectAdded: (e: ObjectEvent) => void;
    objectRemoved: (e: ObjectEvent) => void;
    selectionCreated: (e: SelectionEvent) => void;
    selectionUpdated: (e: SelectionEvent) => void;
    selectionCleared: () => void;
  };

  constructor(config: CanvasSynchronizerConfig) {
    this.canvas = config.canvas;
    this.onLayerCreate = config.onLayerCreate;
    this.onLayerRemove = config.onLayerRemove;
    this.onSelectionChange = config.onSelectionChange;
    this.getLayerByCanvasObjectId = config.getLayerByCanvasObjectId;
    this.getLayersArray = config.getLayersArray;

    // Bind event handlers
    this.boundHandlers = {
      objectAdded: this.handleObjectAdded.bind(this),
      objectRemoved: this.handleObjectRemoved.bind(this),
      selectionCreated: this.handleSelectionCreated.bind(this),
      selectionUpdated: this.handleSelectionUpdated.bind(this),
      selectionCleared: this.handleSelectionCleared.bind(this),
    };
  }

  /**
   * Initialize the synchronizer
   * Binds Canvas event listeners
   * Requirements: 7.1, 7.3
   */
  initialize(): void {
    // Canvas → Layer sync events
    this.canvas.on('object:added', this.boundHandlers.objectAdded);
    this.canvas.on('object:removed', this.boundHandlers.objectRemoved);
    this.canvas.on('selection:created', this.boundHandlers.selectionCreated);
    this.canvas.on('selection:updated', this.boundHandlers.selectionUpdated);
    this.canvas.on('selection:cleared', this.boundHandlers.selectionCleared);
  }

  /**
   * Dispose the synchronizer
   * Removes all event listeners
   */
  dispose(): void {
    this.canvas.off('object:added', this.boundHandlers.objectAdded);
    this.canvas.off('object:removed', this.boundHandlers.objectRemoved);
    this.canvas.off('selection:created', this.boundHandlers.selectionCreated);
    this.canvas.off('selection:updated', this.boundHandlers.selectionUpdated);
    this.canvas.off('selection:cleared', this.boundHandlers.selectionCleared);
  }


  // ============================================
  // Layer → Canvas Synchronization Methods
  // ============================================

  /**
   * Sync layer visibility to Canvas object
   * Requirements: 4.2, 4.3, 4.5
   *
   * When visible=false:
   * - Set object.visible = false (invisible on canvas)
   * - Set object.selectable = false (cannot be selected)
   *
   * When visible=true:
   * - Set object.visible = true
   * - Set object.selectable = true (unless locked)
   */
  syncVisibility(layerId: string): void {
    const layer = this.findLayerById(layerId);
    if (!layer) return;

    const obj = this.findCanvasObject(layer.canvasObjectId);
    if (!obj) return;

    this.isUpdating = true;
    try {
      obj.set('visible', layer.visible);

      // If hidden, also make unselectable
      // If visible, selectable depends on lock state
      if (!layer.visible) {
        obj.set('selectable', false);
        obj.set('evented', false);
      } else if (!layer.locked) {
        obj.set('selectable', true);
        obj.set('evented', true);
      }

      this.canvas.requestRenderAll();
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Sync layer lock state to Canvas object
   * Requirements: 5.2, 5.3, 5.5
   *
   * When locked=true:
   * - Set object.selectable = false (cannot be selected)
   * - Set object.evented = false (no drag/resize/edit)
   *
   * When locked=false:
   * - Set object.selectable = true (unless hidden)
   * - Set object.evented = true
   */
  syncLockState(layerId: string): void {
    const layer = this.findLayerById(layerId);
    if (!layer) return;

    const obj = this.findCanvasObject(layer.canvasObjectId);
    if (!obj) return;

    this.isUpdating = true;
    try {
      if (layer.locked) {
        obj.set('selectable', false);
        obj.set('evented', false);
      } else if (layer.visible) {
        // Only make selectable if also visible
        obj.set('selectable', true);
        obj.set('evented', true);
      }

      this.canvas.requestRenderAll();
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Sync selection state to Canvas
   * Requirements: 6.1, 6.2
   *
   * When layerId is provided:
   * - Find the canvas object and select it
   *
   * When layerId is null:
   * - Deselect all objects
   */
  syncSelection(layerId: string | null): void {
    this.isUpdating = true;
    try {
      if (layerId === null) {
        this.canvas.discardActiveObject();
      } else {
        const layer = this.findLayerById(layerId);
        if (!layer) return;

        const obj = this.findCanvasObject(layer.canvasObjectId);
        if (obj && layer.visible && !layer.locked) {
          this.canvas.setActiveObject(obj);
        }
      }

      this.canvas.requestRenderAll();
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Sync all layers to Canvas
   * Useful for initial sync or recovery from inconsistent state
   * Requirements: 7.4
   */
  syncAllLayers(): void {
    const layers = this.getLayersArray();
    for (const layer of layers) {
      this.syncVisibility(layer.id);
      this.syncLockState(layer.id);
    }
  }

  // ============================================
  // Canvas → Layer Synchronization Handlers
  // ============================================

  /**
   * Handle Canvas object:added event
   * Requirements: 2.1, 2.2, 2.3, 2.4
   *
   * When a new object is added to canvas:
   * - Determine the layer type from object type
   * - Create a corresponding layer in the store
   * 
   * Note: Objects created by OpsExecutor already have IDs and will be
   * handled by the ops replay flow, so we skip them here.
   */
  private handleObjectAdded(e: ObjectEvent): void {
    if (this.isUpdating) return;

    const obj = e.target as FabricObjectWithId;
    if (!obj) return;

    // Skip if object already has an ID - it was created by OpsExecutor or manual tool
    // The layer will be created by the ops replay flow or already exists
    if (obj.id) {
      // Check if layer already exists for this object
      const existingLayer = this.getLayerByCanvasObjectId(obj.id);
      if (existingLayer) {
        return;
      }
      // Object has ID but no layer - create one (manual tool creation)
      const layerType = this.getLayerTypeFromObject(obj);
      if (layerType) {
        this.onLayerCreate(layerType, obj.id);
      }
      return;
    }

    // Generate ID for objects without one
    obj.id = `canvas-obj-${crypto.randomUUID()}`;

    // Determine layer type from fabric object type
    const layerType = this.getLayerTypeFromObject(obj);
    if (!layerType) return;

    // Create layer in store
    this.onLayerCreate(layerType, obj.id);
  }

  /**
   * Handle Canvas object:removed event
   * Requirements: 2.5
   *
   * When an object is removed from canvas:
   * - Find the corresponding layer
   * - Remove it from the store
   */
  private handleObjectRemoved(e: ObjectEvent): void {
    if (this.isUpdating) return;

    const obj = e.target as FabricObjectWithId;
    if (!obj || !obj.id) return;

    const layer = this.getLayerByCanvasObjectId(obj.id);
    if (layer) {
      this.onLayerRemove(layer.id);
    }
  }

  /**
   * Handle Canvas selection:created event
   * Requirements: 6.1, 6.3
   */
  private handleSelectionCreated(e: SelectionEvent): void {
    if (this.isUpdating) return;
    this.handleSelectionEvent(e);
  }

  /**
   * Handle Canvas selection:updated event
   * Requirements: 6.1, 6.3
   */
  private handleSelectionUpdated(e: SelectionEvent): void {
    if (this.isUpdating) return;
    this.handleSelectionEvent(e);
  }

  /**
   * Handle Canvas selection:cleared event
   * Requirements: 6.3
   */
  private handleSelectionCleared(): void {
    if (this.isUpdating) return;
    this.onSelectionChange(null);
  }

  /**
   * Common handler for selection events
   */
  private handleSelectionEvent(e: SelectionEvent): void {
    const selected = e.selected;
    if (!selected || selected.length === 0) {
      this.onSelectionChange(null);
      return;
    }

    // Get the first selected object (single selection)
    const obj = selected[0] as FabricObjectWithId;
    if (!obj || !obj.id) {
      this.onSelectionChange(null);
      return;
    }

    const layer = this.getLayerByCanvasObjectId(obj.id);
    if (layer) {
      this.onSelectionChange(layer.id);
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Find a Canvas object by its ID
   */
  findCanvasObject(canvasObjectId: string): FabricObjectWithId | null {
    const objects = this.canvas.getObjects() as FabricObjectWithId[];
    return objects.find((obj) => obj.id === canvasObjectId) || null;
  }

  /**
   * Find a layer by its ID
   */
  private findLayerById(layerId: string): Layer | undefined {
    const layers = this.getLayersArray();
    return layers.find((layer) => layer.id === layerId);
  }

  /**
   * Determine LayerType from Fabric object type
   * Requirements: 2.1, 2.2, 2.3
   */
  private getLayerTypeFromObject(obj: FabricObjectWithId): LayerType | null {
    const objType = obj.type;

    // Text types
    if (objType === 'i-text' || objType === 'text' || objType === 'textbox') {
      return 'text';
    }

    // Image type
    if (objType === 'image') {
      return 'image';
    }

    // Rectangle and other shapes
    if (objType === 'rect' || objType === 'path' || objType === 'circle' || objType === 'polygon') {
      return 'rect';
    }

    // Check custom layerType property
    if (obj.layerType && isLayerType(obj.layerType)) {
      return obj.layerType;
    }

    // Default to rect for unknown types
    return 'rect';
  }

  /**
   * Get the canvas instance
   */
  getCanvas(): fabric.Canvas {
    return this.canvas;
  }
}

/**
 * Create a Canvas Synchronizer instance
 */
export function createCanvasSynchronizer(
  config: CanvasSynchronizerConfig
): CanvasSynchronizer {
  return new CanvasSynchronizer(config);
}

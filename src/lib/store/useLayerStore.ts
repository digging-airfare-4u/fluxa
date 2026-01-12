/**
 * Layer Store (Zustand)
 * Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.3, 9.1
 * 
 * Manages layer state for the Fluxa canvas layer system.
 * Layers are the business-level abstraction over Fabric.js canvas objects.
 */

import { create } from 'zustand';
import type {
  Layer,
  LayerType,
  LayerState,
  LayerActions,
  LayerStore,
} from '@/lib/canvas/layer.types';
import {
  generateLayerId,
  generateLayerName,
} from '@/lib/canvas/layer.types';
import { deriveLayersFromOps } from '@/lib/canvas/layerDerivation';
import type { Op } from '@/lib/canvas/ops.types';

/**
 * Initial state values
 */
const initialState: LayerState = {
  layers: new Map<string, Layer>(),
  selectedLayerId: null,
  isPanelVisible: false,
  nameCounters: {
    rect: 0,
    text: 0,
    image: 0,
  },
};

/**
 * Persistence callback type for saving ops
 * Requirements: 8.1, 8.2, 9.1
 */
export type PersistOpCallback = (op: Op) => Promise<void>;

/**
 * Extended Layer Store with persistence actions
 */
export interface LayerPersistenceActions {
  /** Set the persistence callback for saving ops */
  setPersistCallback: (callback: PersistOpCallback | null) => void;
  
  /** Persist visibility change as op */
  persistVisibility: (layerId: string, visible: boolean) => Promise<void>;
  
  /** Persist lock change as op */
  persistLock: (layerId: string, locked: boolean) => Promise<void>;
  
  /** Persist name change as op */
  persistName: (layerId: string, name: string) => Promise<void>;
  
  /** Initialize layers from ops */
  initializeFromOps: (ops: Op[]) => void;
  
  /** Clear all layers (for document switch) */
  clearLayers: () => void;
}

/**
 * Extended Layer Store type with persistence
 */
export type ExtendedLayerStore = LayerStore & LayerPersistenceActions & {
  /** Persistence callback for saving ops */
  persistCallback: PersistOpCallback | null;
};

/**
 * Layer store for managing canvas layer state
 * 
 * Usage:
 * ```tsx
 * const { layers, createLayer, toggleVisibility } = useLayerStore();
 * 
 * // Create a new layer
 * const layer = createLayer('rect', 'canvas-object-123');
 * 
 * // Toggle visibility
 * toggleVisibility(layer.id);
 * 
 * // Initialize from ops (for document load)
 * initializeFromOps(ops);
 * ```
 */
export const useLayerStore = create<ExtendedLayerStore>((set, get) => ({
  ...initialState,
  
  /** Persistence callback for saving ops */
  persistCallback: null,

  /**
   * Create a new layer for a canvas object
   * Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4
   */
  createLayer: (type: LayerType, canvasObjectId: string): Layer => {
    const state = get();
    const newCounter = state.nameCounters[type] + 1;
    
    const layer: Layer = {
      id: generateLayerId(),
      name: generateLayerName(type, newCounter),
      type,
      visible: true,  // Default: visible (Requirement 1.5)
      locked: false,  // Default: unlocked (Requirement 1.5)
      canvasObjectId,
    };

    set((state) => {
      const newLayers = new Map(state.layers);
      newLayers.set(layer.id, layer);
      
      return {
        layers: newLayers,
        nameCounters: {
          ...state.nameCounters,
          [type]: newCounter,
        },
      };
    });

    return layer;
  },

  /**
   * Remove a layer by ID
   * Requirements: 2.5
   */
  removeLayer: (layerId: string): void => {
    set((state) => {
      const newLayers = new Map(state.layers);
      newLayers.delete(layerId);
      
      // If the removed layer was selected, clear selection
      const newSelectedLayerId = state.selectedLayerId === layerId 
        ? null 
        : state.selectedLayerId;
      
      return {
        layers: newLayers,
        selectedLayerId: newSelectedLayerId,
      };
    });
  },

  /**
   * Toggle layer visibility
   * Requirements: 4.1, 4.4, 4.6
   */
  toggleVisibility: (layerId: string): void => {
    set((state) => {
      const layer = state.layers.get(layerId);
      if (!layer) return state;

      const newVisible = !layer.visible;
      const updatedLayer: Layer = { ...layer, visible: newVisible };
      
      const newLayers = new Map(state.layers);
      newLayers.set(layerId, updatedLayer);
      
      // If hiding a selected layer, deselect it (Requirement 4.6)
      const newSelectedLayerId = 
        !newVisible && state.selectedLayerId === layerId
          ? null
          : state.selectedLayerId;
      
      return {
        layers: newLayers,
        selectedLayerId: newSelectedLayerId,
      };
    });
  },

  /**
   * Toggle layer lock state
   * Requirements: 5.1, 5.4, 5.6
   */
  toggleLock: (layerId: string): void => {
    set((state) => {
      const layer = state.layers.get(layerId);
      if (!layer) return state;

      const newLocked = !layer.locked;
      const updatedLayer: Layer = { ...layer, locked: newLocked };
      
      const newLayers = new Map(state.layers);
      newLayers.set(layerId, updatedLayer);
      
      // If locking a selected layer, deselect it (Requirement 5.6)
      const newSelectedLayerId = 
        newLocked && state.selectedLayerId === layerId
          ? null
          : state.selectedLayerId;
      
      return {
        layers: newLayers,
        selectedLayerId: newSelectedLayerId,
      };
    });
  },

  /**
   * Rename a layer
   * Requirements: 9.1
   */
  renameLayer: (layerId: string, name: string): void => {
    set((state) => {
      const layer = state.layers.get(layerId);
      if (!layer) return state;

      const updatedLayer: Layer = { ...layer, name };
      
      const newLayers = new Map(state.layers);
      newLayers.set(layerId, updatedLayer);
      
      return { layers: newLayers };
    });
  },

  /**
   * Set selected layer (from panel or canvas)
   * Requirements: 6.1, 6.2, 6.4, 6.5
   */
  setSelectedLayer: (layerId: string | null): void => {
    set((state) => {
      // If trying to select a layer, check if it's selectable
      if (layerId !== null) {
        const layer = state.layers.get(layerId);
        
        // Cannot select hidden or locked layers (Requirements 6.4, 6.5)
        if (!layer || !layer.visible || layer.locked) {
          return state;
        }
      }
      
      return { selectedLayerId: layerId };
    });
  },

  /**
   * Toggle panel visibility
   * Requirements: 3.7
   */
  togglePanel: (): void => {
    set((state) => ({ isPanelVisible: !state.isPanelVisible }));
  },

  /**
   * Get layer by canvas object ID
   * Requirements: 2.4
   */
  getLayerByCanvasObjectId: (canvasObjectId: string): Layer | undefined => {
    const state = get();
    for (const layer of state.layers.values()) {
      if (layer.canvasObjectId === canvasObjectId) {
        return layer;
      }
    }
    return undefined;
  },

  /**
   * Get all layers as ordered array
   * Returns layers in insertion order (Map preserves insertion order)
   */
  getLayersArray: (): Layer[] => {
    const state = get();
    return Array.from(state.layers.values());
  },

  /**
   * Set the persistence callback for saving ops
   * Requirements: 8.1, 8.2, 9.1
   */
  setPersistCallback: (callback: PersistOpCallback | null): void => {
    set({ persistCallback: callback });
  },

  /**
   * Persist visibility change as op
   * Requirements: 8.1
   */
  persistVisibility: async (layerId: string, visible: boolean): Promise<void> => {
    const { persistCallback } = get();
    if (!persistCallback) return;

    const op: Op = {
      type: 'setLayerVisibility',
      payload: { id: layerId, visible },
    };

    try {
      await persistCallback(op);
    } catch (error) {
      console.error('[LayerStore] Failed to persist visibility:', error);
    }
  },

  /**
   * Persist lock change as op
   * Requirements: 8.2
   */
  persistLock: async (layerId: string, locked: boolean): Promise<void> => {
    const { persistCallback } = get();
    if (!persistCallback) return;

    const op: Op = {
      type: 'setLayerLock',
      payload: { id: layerId, locked },
    };

    try {
      await persistCallback(op);
    } catch (error) {
      console.error('[LayerStore] Failed to persist lock:', error);
    }
  },

  /**
   * Persist name change as op
   * Requirements: 9.1
   */
  persistName: async (layerId: string, name: string): Promise<void> => {
    const { persistCallback } = get();
    if (!persistCallback) return;

    const op: Op = {
      type: 'renameLayer',
      payload: { id: layerId, name },
    };

    try {
      await persistCallback(op);
    } catch (error) {
      console.error('[LayerStore] Failed to persist name:', error);
    }
  },

  /**
   * Initialize layers from ops
   * Requirements: 8.3, 8.7
   */
  initializeFromOps: (ops: Op[]): void => {
    const { layers, nameCounters } = deriveLayersFromOps(ops);
    
    set({
      layers,
      nameCounters,
      selectedLayerId: null,
    });
  },

  /**
   * Clear all layers (for document switch)
   */
  clearLayers: (): void => {
    set({
      layers: new Map<string, Layer>(),
      selectedLayerId: null,
      nameCounters: {
        rect: 0,
        text: 0,
        image: 0,
      },
    });
  },
}));

/**
 * Selector hooks for common use cases
 */
export const useLayers = () => useLayerStore((state) => state.layers);

/**
 * Returns layers as an array.
 * Note: This creates a new array on each call, but the Layer objects
 * themselves are stable references from the Map.
 */
export const useLayersArray = (): Layer[] => {
  const layers = useLayerStore((state) => state.layers);
  return Array.from(layers.values());
};

export const useSelectedLayerId = () => useLayerStore((state) => state.selectedLayerId);
export const useIsPanelVisible = () => useLayerStore((state) => state.isPanelVisible);
export const useSelectedLayer = () => useLayerStore((state) => {
  if (!state.selectedLayerId) return null;
  return state.layers.get(state.selectedLayerId) ?? null;
});

/**
 * Get a specific layer by ID
 */
export const useLayer = (layerId: string) => useLayerStore((state) => 
  state.layers.get(layerId)
);

export default useLayerStore;

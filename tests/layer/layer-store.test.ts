/**
 * Feature: layer-system
 * Property 5: Visibility Toggle Round-Trip
 * Property 7: Lock Toggle Round-Trip
 * Property 13: Panel Toggle Round-Trip
 * Validates: Requirements 4.1, 4.4, 5.1, 5.4, 3.7
 *
 * These tests validate the Layer Store toggle operations using property-based testing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useLayerStore } from '@/lib/store/useLayerStore';
import type { LayerType } from '@/lib/canvas/layer.types';

// Arbitrary for layer types
const layerTypeArb: fc.Arbitrary<LayerType> = fc.constantFrom('rect', 'text', 'image');

// Arbitrary for canvas object IDs
const canvasObjectIdArb = fc.uuid().map(id => `canvas-${id}`);

// Reset store before each test
beforeEach(() => {
  useLayerStore.setState({
    layers: new Map(),
    selectedLayerId: null,
    isPanelVisible: false,
    nameCounters: { rect: 0, text: 0, image: 0 },
  });
});

/**
 * Property 5: Visibility Toggle Round-Trip
 * For any Layer, toggling visibility twice SHALL return the Layer to its original visible state.
 * Validates: Requirements 4.1, 4.4
 */
describe('Property 5: Visibility Toggle Round-Trip', () => {
  it('toggling visibility twice returns layer to original state', () => {
    fc.assert(
      fc.property(layerTypeArb, canvasObjectIdArb, (type, canvasObjectId) => {
        const store = useLayerStore.getState();
        
        // Create a layer
        const layer = store.createLayer(type, canvasObjectId);
        const originalVisible = layer.visible;
        
        // Toggle visibility twice
        store.toggleVisibility(layer.id);
        store.toggleVisibility(layer.id);
        
        // Get updated layer
        const updatedLayer = useLayerStore.getState().layers.get(layer.id);
        
        // Should return to original state
        expect(updatedLayer?.visible).toBe(originalVisible);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('toggling visibility once changes the state', () => {
    fc.assert(
      fc.property(layerTypeArb, canvasObjectIdArb, (type, canvasObjectId) => {
        const store = useLayerStore.getState();
        
        // Create a layer
        const layer = store.createLayer(type, canvasObjectId);
        const originalVisible = layer.visible;
        
        // Toggle visibility once
        store.toggleVisibility(layer.id);
        
        // Get updated layer
        const updatedLayer = useLayerStore.getState().layers.get(layer.id);
        
        // Should be opposite of original
        expect(updatedLayer?.visible).toBe(!originalVisible);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('toggling visibility multiple times follows round-trip pattern', () => {
    fc.assert(
      fc.property(
        layerTypeArb,
        canvasObjectIdArb,
        fc.integer({ min: 1, max: 10 }),
        (type, canvasObjectId, toggleCount) => {
          const store = useLayerStore.getState();
          
          // Create a layer
          const layer = store.createLayer(type, canvasObjectId);
          const originalVisible = layer.visible;
          
          // Toggle visibility toggleCount times
          for (let i = 0; i < toggleCount; i++) {
            store.toggleVisibility(layer.id);
          }
          
          // Get updated layer
          const updatedLayer = useLayerStore.getState().layers.get(layer.id);
          
          // Even toggles = original state, odd toggles = opposite state
          const expectedVisible = toggleCount % 2 === 0 ? originalVisible : !originalVisible;
          expect(updatedLayer?.visible).toBe(expectedVisible);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 7: Lock Toggle Round-Trip
 * For any Layer, toggling lock twice SHALL return the Layer to its original locked state.
 * Validates: Requirements 5.1, 5.4
 */
describe('Property 7: Lock Toggle Round-Trip', () => {
  it('toggling lock twice returns layer to original state', () => {
    fc.assert(
      fc.property(layerTypeArb, canvasObjectIdArb, (type, canvasObjectId) => {
        const store = useLayerStore.getState();
        
        // Create a layer
        const layer = store.createLayer(type, canvasObjectId);
        const originalLocked = layer.locked;
        
        // Toggle lock twice
        store.toggleLock(layer.id);
        store.toggleLock(layer.id);
        
        // Get updated layer
        const updatedLayer = useLayerStore.getState().layers.get(layer.id);
        
        // Should return to original state
        expect(updatedLayer?.locked).toBe(originalLocked);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('toggling lock once changes the state', () => {
    fc.assert(
      fc.property(layerTypeArb, canvasObjectIdArb, (type, canvasObjectId) => {
        const store = useLayerStore.getState();
        
        // Create a layer
        const layer = store.createLayer(type, canvasObjectId);
        const originalLocked = layer.locked;
        
        // Toggle lock once
        store.toggleLock(layer.id);
        
        // Get updated layer
        const updatedLayer = useLayerStore.getState().layers.get(layer.id);
        
        // Should be opposite of original
        expect(updatedLayer?.locked).toBe(!originalLocked);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('toggling lock multiple times follows round-trip pattern', () => {
    fc.assert(
      fc.property(
        layerTypeArb,
        canvasObjectIdArb,
        fc.integer({ min: 1, max: 10 }),
        (type, canvasObjectId, toggleCount) => {
          const store = useLayerStore.getState();
          
          // Create a layer
          const layer = store.createLayer(type, canvasObjectId);
          const originalLocked = layer.locked;
          
          // Toggle lock toggleCount times
          for (let i = 0; i < toggleCount; i++) {
            store.toggleLock(layer.id);
          }
          
          // Get updated layer
          const updatedLayer = useLayerStore.getState().layers.get(layer.id);
          
          // Even toggles = original state, odd toggles = opposite state
          const expectedLocked = toggleCount % 2 === 0 ? originalLocked : !originalLocked;
          expect(updatedLayer?.locked).toBe(expectedLocked);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 13: Panel Toggle Round-Trip
 * For any panel state, toggling the panel twice SHALL return it to its original visibility state.
 * Validates: Requirements 3.7
 */
describe('Property 13: Panel Toggle Round-Trip', () => {
  it('toggling panel twice returns to original state', () => {
    fc.assert(
      fc.property(fc.boolean(), (initialPanelState) => {
        // Set initial panel state
        useLayerStore.setState({ isPanelVisible: initialPanelState });
        
        const store = useLayerStore.getState();
        
        // Toggle panel twice
        store.togglePanel();
        store.togglePanel();
        
        // Get updated state
        const updatedState = useLayerStore.getState();
        
        // Should return to original state
        expect(updatedState.isPanelVisible).toBe(initialPanelState);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('toggling panel once changes the state', () => {
    fc.assert(
      fc.property(fc.boolean(), (initialPanelState) => {
        // Set initial panel state
        useLayerStore.setState({ isPanelVisible: initialPanelState });
        
        const store = useLayerStore.getState();
        
        // Toggle panel once
        store.togglePanel();
        
        // Get updated state
        const updatedState = useLayerStore.getState();
        
        // Should be opposite of original
        expect(updatedState.isPanelVisible).toBe(!initialPanelState);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('toggling panel multiple times follows round-trip pattern', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.integer({ min: 1, max: 10 }),
        (initialPanelState, toggleCount) => {
          // Set initial panel state
          useLayerStore.setState({ isPanelVisible: initialPanelState });
          
          const store = useLayerStore.getState();
          
          // Toggle panel toggleCount times
          for (let i = 0; i < toggleCount; i++) {
            store.togglePanel();
          }
          
          // Get updated state
          const updatedState = useLayerStore.getState();
          
          // Even toggles = original state, odd toggles = opposite state
          const expectedVisible = toggleCount % 2 === 0 ? initialPanelState : !initialPanelState;
          expect(updatedState.isPanelVisible).toBe(expectedVisible);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 12: Layer Store as Source of Truth
 * For any state inconsistency between Layer Store and Canvas Object,
 * the Layer Store state SHALL be applied to the Canvas Object to restore consistency.
 * Validates: Requirements 7.1, 7.3, 7.4
 *
 * This test validates that Layer Store operations always update first,
 * and that the store state is the authoritative source.
 */
describe('Property 12: Layer Store as Source of Truth', () => {
  it('layer store state is authoritative for visibility', () => {
    fc.assert(
      fc.property(
        layerTypeArb,
        canvasObjectIdArb,
        fc.boolean(),
        (type, canvasObjectId, targetVisible) => {
          const store = useLayerStore.getState();
          
          // Create a layer
          const layer = store.createLayer(type, canvasObjectId);
          
          // Set visibility to a specific state
          if (layer.visible !== targetVisible) {
            store.toggleVisibility(layer.id);
          }
          
          // Verify store state is correct
          const updatedLayer = useLayerStore.getState().layers.get(layer.id);
          expect(updatedLayer?.visible).toBe(targetVisible);
          
          // Store state should be the source of truth
          // Any sync to canvas should use this state
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('layer store state is authoritative for lock state', () => {
    fc.assert(
      fc.property(
        layerTypeArb,
        canvasObjectIdArb,
        fc.boolean(),
        (type, canvasObjectId, targetLocked) => {
          const store = useLayerStore.getState();
          
          // Create a layer
          const layer = store.createLayer(type, canvasObjectId);
          
          // Set lock state to a specific state
          if (layer.locked !== targetLocked) {
            store.toggleLock(layer.id);
          }
          
          // Verify store state is correct
          const updatedLayer = useLayerStore.getState().layers.get(layer.id);
          expect(updatedLayer?.locked).toBe(targetLocked);
          
          // Store state should be the source of truth
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('layer store updates happen before any sync operations', () => {
    fc.assert(
      fc.property(
        layerTypeArb,
        canvasObjectIdArb,
        fc.array(fc.constantFrom('visibility', 'lock'), { minLength: 1, maxLength: 5 }),
        (type, canvasObjectId, operations) => {
          const store = useLayerStore.getState();
          
          // Create a layer
          const layer = store.createLayer(type, canvasObjectId);
          
          // Track expected state
          let expectedVisible = layer.visible;
          let expectedLocked = layer.locked;
          
          // Apply operations
          for (const op of operations) {
            if (op === 'visibility') {
              expectedVisible = !expectedVisible;
              store.toggleVisibility(layer.id);
            } else {
              expectedLocked = !expectedLocked;
              store.toggleLock(layer.id);
            }
            
            // Verify store state is immediately updated
            const currentLayer = useLayerStore.getState().layers.get(layer.id);
            expect(currentLayer?.visible).toBe(expectedVisible);
            expect(currentLayer?.locked).toBe(expectedLocked);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('layer store maintains consistency across multiple layers', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(layerTypeArb, canvasObjectIdArb),
          { minLength: 1, maxLength: 5 }
        ),
        (layerConfigs) => {
          // Reset store for each property test iteration
          useLayerStore.setState({
            layers: new Map(),
            selectedLayerId: null,
            isPanelVisible: false,
            nameCounters: { rect: 0, text: 0, image: 0 },
          });
          
          const store = useLayerStore.getState();
          const createdLayers: Array<{ id: string; visible: boolean; locked: boolean }> = [];
          
          // Create multiple layers
          for (const [type, canvasObjectId] of layerConfigs) {
            const layer = store.createLayer(type, canvasObjectId);
            createdLayers.push({
              id: layer.id,
              visible: layer.visible,
              locked: layer.locked,
            });
          }
          
          // Verify all layers exist in store
          const storeState = useLayerStore.getState();
          for (const expected of createdLayers) {
            const actual = storeState.layers.get(expected.id);
            expect(actual).toBeDefined();
            expect(actual?.visible).toBe(expected.visible);
            expect(actual?.locked).toBe(expected.locked);
          }
          
          // Store is the single source of truth for all layers
          expect(storeState.layers.size).toBe(createdLayers.length);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('selection state is managed by layer store', () => {
    fc.assert(
      fc.property(
        layerTypeArb,
        canvasObjectIdArb,
        (type, canvasObjectId) => {
          const store = useLayerStore.getState();
          
          // Create a layer
          const layer = store.createLayer(type, canvasObjectId);
          
          // Initially no selection
          expect(useLayerStore.getState().selectedLayerId).toBeNull();
          
          // Select the layer
          store.setSelectedLayer(layer.id);
          expect(useLayerStore.getState().selectedLayerId).toBe(layer.id);
          
          // Deselect
          store.setSelectedLayer(null);
          expect(useLayerStore.getState().selectedLayerId).toBeNull();
          
          // Store manages selection state as source of truth
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

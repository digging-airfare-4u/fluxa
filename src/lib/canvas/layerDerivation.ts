/**
 * Layer Derivation from Ops
 * Requirements: 8.3, 8.4, 8.5, 8.6, 8.7
 * 
 * Derives layer state from ops replay. This module reconstructs the layer list
 * and their properties by processing ops in sequence order.
 */

import type { Op } from './ops.types';
import type { Layer, LayerType } from './layer.types';
import { LAYER_TYPE_NAMES } from './layer.types';

/**
 * Result of layer derivation from ops
 */
export interface LayerDerivationResult {
  /** Derived layers, keyed by layer ID */
  layers: Map<string, Layer>;
  
  /** Name counters for auto-naming (per type) */
  nameCounters: Record<LayerType, number>;
}

/**
 * Derive layers from a sequence of ops
 * Requirements: 8.3, 8.4, 8.5, 8.6, 8.7
 * 
 * Processes ops in order to reconstruct layer state:
 * - addRect, addText, addImage: Create new layers
 * - setLayerVisibility: Update layer visibility
 * - setLayerLock: Update layer lock state
 * - renameLayer: Update layer name
 * - removeLayer: Remove layer from list
 * 
 * @param ops - Array of ops in sequence order
 * @returns LayerDerivationResult with layers and name counters
 */
export function deriveLayersFromOps(ops: Op[]): LayerDerivationResult {
  const layers = new Map<string, Layer>();
  const nameCounters: Record<LayerType, number> = { rect: 0, text: 0, image: 0 };

  for (const op of ops) {
    switch (op.type) {
      case 'addRect': {
        nameCounters.rect++;
        const layer: Layer = {
          id: op.payload.id,
          name: `${LAYER_TYPE_NAMES.rect} ${nameCounters.rect}`,
          type: 'rect',
          visible: true,
          locked: false,
          canvasObjectId: op.payload.id,
        };
        layers.set(op.payload.id, layer);
        break;
      }

      case 'addText': {
        nameCounters.text++;
        const layer: Layer = {
          id: op.payload.id,
          name: `${LAYER_TYPE_NAMES.text} ${nameCounters.text}`,
          type: 'text',
          visible: true,
          locked: false,
          canvasObjectId: op.payload.id,
        };
        layers.set(op.payload.id, layer);
        break;
      }

      case 'addImage': {
        nameCounters.image++;
        const layer: Layer = {
          id: op.payload.id,
          name: `${LAYER_TYPE_NAMES.image} ${nameCounters.image}`,
          type: 'image',
          visible: true,
          locked: false,
          canvasObjectId: op.payload.id,
        };
        layers.set(op.payload.id, layer);
        break;
      }

      case 'setLayerVisibility': {
        const layer = layers.get(op.payload.id);
        if (layer) {
          layer.visible = op.payload.visible;
        }
        break;
      }

      case 'setLayerLock': {
        const layer = layers.get(op.payload.id);
        if (layer) {
          layer.locked = op.payload.locked;
        }
        break;
      }

      case 'renameLayer': {
        const layer = layers.get(op.payload.id);
        if (layer) {
          layer.name = op.payload.name;
        }
        break;
      }

      case 'removeLayer': {
        layers.delete(op.payload.id);
        break;
      }

      // Other op types (createFrame, setBackground, updateLayer) don't affect layers
      default:
        break;
    }
  }

  return { layers, nameCounters };
}

/**
 * Check if an op creates a layer
 */
export function isLayerCreationOp(op: Op): boolean {
  return op.type === 'addRect' || op.type === 'addText' || op.type === 'addImage';
}

/**
 * Check if an op modifies layer state (visibility, lock, name)
 */
export function isLayerStateOp(op: Op): boolean {
  return (
    op.type === 'setLayerVisibility' ||
    op.type === 'setLayerLock' ||
    op.type === 'renameLayer'
  );
}

/**
 * Check if an op removes a layer
 */
export function isLayerRemovalOp(op: Op): boolean {
  return op.type === 'removeLayer';
}

/**
 * Get the layer ID from an op that affects layers
 * Returns undefined for ops that don't affect layers
 */
export function getLayerIdFromOp(op: Op): string | undefined {
  switch (op.type) {
    case 'addRect':
    case 'addText':
    case 'addImage':
    case 'setLayerVisibility':
    case 'setLayerLock':
    case 'renameLayer':
    case 'removeLayer':
      return op.payload.id;
    default:
      return undefined;
  }
}

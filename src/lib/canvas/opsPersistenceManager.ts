/**
 * OpsPersistenceManager - Unified canvas operations persistence manager
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 * 
 * Provides a single entry point for creating, updating, and deleting canvas
 * elements with automatic database persistence via saveOp.
 */

import * as fabric from 'fabric';
import { saveOp } from '@/lib/supabase/queries/ops';
import { getProxyImageUrl } from '@/lib/utils/image-url';
import type {
  AddTextOp,
  AddRectOp,
  AddImageOp,
  UpdateLayerOp,
  RemoveLayerOp,
} from './ops.types';

/**
 * Parameters for adding text to canvas
 * Requirements: 2.1, 2.2
 */
export interface AddTextParams {
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  width?: number;
}

/**
 * Parameters for adding rectangle to canvas
 * Requirements: 3.1, 3.2
 */
export interface AddRectParams {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

/**
 * Parameters for adding image to canvas
 * Requirements: 4.1, 4.2
 */
export interface AddImageParams {
  src: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
}

/**
 * Parameters for updating layer properties
 * Requirements: 6.1, 6.3
 */
export interface UpdateLayerParams {
  left?: number;
  top?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  width?: number;
  height?: number;
}

// Extended fabric object with custom properties
interface ExtendedFabricObject extends fabric.FabricObject {
  id?: string;
  name?: string;
  layerType?: string;
}

/**
 * OpsPersistenceManager class
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export class OpsPersistenceManager {
  private documentId: string;
  private canvas: fabric.Canvas;

  /**
   * Create OpsPersistenceManager instance
   * Requirements: 1.1
   * @param documentId - The document ID for persistence
   * @param canvas - The Fabric.js canvas instance
   */
  constructor(documentId: string, canvas: fabric.Canvas) {
    this.documentId = documentId;
    this.canvas = canvas;
  }

  /**
   * Generate unique layer ID
   * Requirements: 1.2
   * @returns A unique layer ID in format layer-{timestamp}-{random}
   */
  generateLayerId(): string {
    return `layer-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get the canvas instance
   * @returns The Fabric.js canvas
   */
  getCanvas(): fabric.Canvas {
    return this.canvas;
  }


  /**
   * Add text to canvas and persist to database
   * Requirements: 2.1, 2.2, 2.3, 2.4
   * @param params - Text parameters
   * @returns The generated layerId
   * @throws Error if operation fails
   */
  async addText(params: AddTextParams): Promise<string> {
    const layerId = this.generateLayerId();

    // Create IText object with specified properties
    const textOptions: Partial<fabric.ITextProps> = {
      left: params.x,
      top: params.y,
      fontSize: params.fontSize ?? 24,
      fontFamily: params.fontFamily ?? 'Inter',
      fill: params.fill ?? '#000000',
      fontWeight: (params.fontWeight ?? 'normal') as fabric.ITextProps['fontWeight'],
      textAlign: params.textAlign ?? 'left',
    };

    // Add width for text wrapping if specified
    if (params.width) {
      textOptions.width = params.width;
    }

    const text = new fabric.IText(params.text, textOptions) as ExtendedFabricObject;
    text.id = layerId;
    text.name = params.text.substring(0, 20);

    // Add to canvas
    this.canvas.add(text);
    this.canvas.requestRenderAll();

    // Persist to database
    const addTextOp: AddTextOp = {
      type: 'addText',
      payload: {
        id: layerId,
        text: params.text,
        x: params.x,
        y: params.y,
        fontSize: params.fontSize ?? 24,
        fontFamily: params.fontFamily ?? 'Inter',
        fill: params.fill ?? '#000000',
        fontWeight: params.fontWeight ?? 'normal',
        textAlign: params.textAlign ?? 'left',
        width: params.width,
      },
    };

    try {
      await saveOp({ documentId: this.documentId, op: addTextOp });
    } catch (error) {
      console.error('[OpsPersistenceManager] Failed to persist addText op:', error);
      // Fire-and-forget pattern for UX - don't throw
    }

    return layerId;
  }


  /**
   * Add rectangle to canvas and persist to database
   * Requirements: 3.1, 3.2, 3.3
   * @param params - Rectangle parameters
   * @returns The generated layerId
   */
  async addRect(params: AddRectParams): Promise<string> {
    const layerId = this.generateLayerId();

    // Create Rect object with specified properties
    const rect = new fabric.Rect({
      left: params.x,
      top: params.y,
      width: params.width,
      height: params.height,
      fill: params.fill ?? 'transparent',
      stroke: params.stroke ?? '#000000',
      strokeWidth: params.strokeWidth ?? 2,
    }) as ExtendedFabricObject;

    rect.id = layerId;
    rect.name = '矩形';
    rect.layerType = 'rect';

    // Add to canvas
    this.canvas.add(rect);
    this.canvas.requestRenderAll();

    // Persist to database
    const addRectOp: AddRectOp = {
      type: 'addRect',
      payload: {
        id: layerId,
        x: params.x,
        y: params.y,
        width: params.width,
        height: params.height,
        fill: params.fill ?? 'transparent',
        stroke: params.stroke ?? '#000000',
        strokeWidth: params.strokeWidth ?? 2,
      },
    };

    try {
      await saveOp({ documentId: this.documentId, op: addRectOp });
    } catch (error) {
      console.error('[OpsPersistenceManager] Failed to persist addRect op:', error);
      // Fire-and-forget pattern for UX - don't throw
    }

    return layerId;
  }


  /**
   * Add image to canvas and persist to database
   * Requirements: 4.1, 4.2, 4.3, 4.4
   * @param params - Image parameters
   * @returns The generated layerId
   * @throws Error if image loading fails
   */
  async addImage(params: AddImageParams): Promise<string> {
    const layerId = this.generateLayerId();
    const proxiedSrc = getProxyImageUrl(params.src);

    return new Promise((resolve, reject) => {
      fabric.FabricImage.fromURL(proxiedSrc, { crossOrigin: 'anonymous' })
        .then((img) => {
          let scaleX = 1;
          let scaleY = 1;

          // If explicit scaleX/scaleY provided, use them directly
          if (params.scaleX !== undefined || params.scaleY !== undefined) {
            scaleX = params.scaleX ?? 1;
            scaleY = params.scaleY ?? 1;
          }
          // If width and height provided, calculate uniform scale to fit within bounds
          else if (params.width !== undefined && params.height !== undefined && img.width && img.height) {
            const scaleToFitWidth = params.width / img.width;
            const scaleToFitHeight = params.height / img.height;
            const uniformScale = Math.min(scaleToFitWidth, scaleToFitHeight);
            scaleX = uniformScale;
            scaleY = uniformScale;
          }
          // If only width provided, scale proportionally
          else if (params.width !== undefined && img.width) {
            const uniformScale = params.width / img.width;
            scaleX = uniformScale;
            scaleY = uniformScale;
          }
          // If only height provided, scale proportionally
          else if (params.height !== undefined && img.height) {
            const uniformScale = params.height / img.height;
            scaleX = uniformScale;
            scaleY = uniformScale;
          }

          // Set all properties
          img.set({
            left: params.x,
            top: params.y,
            scaleX,
            scaleY,
          });

          (img as ExtendedFabricObject).id = layerId;
          (img as ExtendedFabricObject).name = `Image ${layerId.substring(0, 8)}`;

          // Add to canvas
          this.canvas.add(img);
          this.canvas.requestRenderAll();

          // Persist to database
          const addImageOp: AddImageOp = {
            type: 'addImage',
            payload: {
              id: layerId,
              src: params.src,
              x: params.x,
              y: params.y,
              width: params.width,
              height: params.height,
              scaleX: params.scaleX,
              scaleY: params.scaleY,
            },
          };

          saveOp({ documentId: this.documentId, op: addImageOp })
            .catch((error) => {
              console.error('[OpsPersistenceManager] Failed to persist addImage op:', error);
              // Fire-and-forget pattern for UX - don't throw
            });

          resolve(layerId);
        })
        .catch((error) => {
          const errorMessage = `Failed to load image from ${params.src}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error('[OpsPersistenceManager]', errorMessage);
          reject(new Error(errorMessage));
        });
    });
  }


  /**
   * Remove layer from canvas and persist to database
   * Requirements: 5.1, 5.2, 5.3
   * @param layerId - The layer ID to remove
   */
  async removeLayer(layerId: string): Promise<void> {
    // Find the object in canvas
    const objects = this.canvas.getObjects();
    const target = objects.find(
      (obj) => (obj as ExtendedFabricObject).id === layerId
    );

    // Handle gracefully if layer doesn't exist
    if (!target) {
      console.warn(`[OpsPersistenceManager] Layer with id "${layerId}" not found, skipping removal`);
      return;
    }

    // Remove from canvas
    this.canvas.remove(target);
    this.canvas.requestRenderAll();

    // Persist to database
    const removeLayerOp: RemoveLayerOp = {
      type: 'removeLayer',
      payload: {
        id: layerId,
      },
    };

    try {
      await saveOp({ documentId: this.documentId, op: removeLayerOp });
    } catch (error) {
      console.error('[OpsPersistenceManager] Failed to persist removeLayer op:', error);
      // Fire-and-forget pattern for UX - don't throw
    }
  }


  /**
   * Update layer properties and persist to database
   * Requirements: 6.1, 6.2, 6.3
   * @param layerId - The layer ID to update
   * @param properties - The properties to update
   */
  async updateLayer(layerId: string, properties: UpdateLayerParams): Promise<void> {
    // Find the object in canvas to verify it exists
    const objects = this.canvas.getObjects();
    const target = objects.find(
      (obj) => (obj as ExtendedFabricObject).id === layerId
    );

    // Warn if layer doesn't exist
    if (!target) {
      console.warn(`[OpsPersistenceManager] Layer with id "${layerId}" not found, skipping update`);
      return;
    }

    // Note: We don't call target.set() here because the canvas object
    // has already been updated by Fabric.js when the user finished dragging.
    // We only need to persist the current state to the database.

    // Persist to database
    const updateLayerOp: UpdateLayerOp = {
      type: 'updateLayer',
      payload: {
        id: layerId,
        properties: properties as Record<string, unknown>,
      },
    };

    try {
      await saveOp({ documentId: this.documentId, op: updateLayerOp });
    } catch (error) {
      console.error('[OpsPersistenceManager] Failed to persist updateLayer op:', error);
      // Fire-and-forget pattern for UX - don't throw
    }
  }
}

/**
 * Create OpsPersistenceManager instance
 * @param documentId - The document ID for persistence
 * @param canvas - The Fabric.js canvas instance
 * @returns OpsPersistenceManager instance
 */
export function createOpsPersistenceManager(
  documentId: string,
  canvas: fabric.Canvas
): OpsPersistenceManager {
  return new OpsPersistenceManager(documentId, canvas);
}

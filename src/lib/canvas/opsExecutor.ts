/**
 * OpsExecutor - Executes canvas operations
 * Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9
 */

import * as fabric from 'fabric';
import {
  Op,
  SetBackgroundOp,
  AddTextOp,
  AddImageOp,
  AddRectOp,
  UpdateLayerOp,
  RemoveLayerOp,
  GradientConfig,
  validateOp,
} from './ops.types';

export interface LayerInfo {
  id: string;
  type: 'text' | 'image' | 'rect' | 'background';
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface OpsExecutorConfig {
  canvas: fabric.Canvas;
  onOpExecuted?: (op: Op, index: number) => void;
  onError?: (error: Error, op: Op) => void;
}

/**
 * Animation options for canvas landing effect
 * Requirements: 6.1, 6.3, 6.4, 6.5
 */
export interface AnimatedAddOptions {
  duration?: number; // default 280ms
  easing?: string; // default 'easeOutCubic'
  staggerDelay?: number; // default 50ms for multiple elements
  animate?: boolean; // default true, set false to skip animation
}

export class OpsExecutionError extends Error {
  constructor(
    message: string,
    public op: Op,
    public cause?: Error
  ) {
    super(message);
    this.name = 'OpsExecutionError';
  }
}

// Extended fabric object with custom properties
interface ExtendedFabricObject extends fabric.FabricObject {
  id?: string;
  name?: string;
  layerType?: string;
}

export class OpsExecutor {
  private canvas: fabric.Canvas;
  private layerRegistry: Map<string, fabric.FabricObject>;
  private onOpExecuted?: (op: Op, index: number) => void;
  private onError?: (error: Error, op: Op) => void;
  private executedSeqs: Set<string> = new Set(); // For idempotency

  // Default animation configuration
  private static readonly DEFAULT_ANIMATION_DURATION = 280;
  private static readonly DEFAULT_STAGGER_DELAY = 50;
  private static readonly DEFAULT_SCALE_IN = 0.96;

  constructor(config: OpsExecutorConfig) {
    this.canvas = config.canvas;
    this.layerRegistry = new Map();
    this.onOpExecuted = config.onOpExecuted;
    this.onError = config.onError;
  }

  /**
   * Get the canvas instance (for comparison)
   */
  getCanvas(): fabric.Canvas {
    return this.canvas;
  }

  /**
   * Animate a single element with landing effect
   * Requirements: 6.1, 6.3
   * 
   * Animates element from opacity 0, scale 0.96 to opacity 1, scale 1
   * Duration: 280ms, easing: easeOutCubic
   * 
   * @param element - The Fabric.js object to animate
   * @param options - Animation options
   * @returns Promise that resolves when animation completes
   */
  animateElement(
    element: fabric.FabricObject,
    options: AnimatedAddOptions = {}
  ): Promise<void> {
    const {
      duration = OpsExecutor.DEFAULT_ANIMATION_DURATION,
      animate = true,
    } = options;

    // Skip animation if disabled
    if (!animate) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      // Store original values
      const originalOpacity = element.opacity ?? 1;
      const originalScaleX = element.scaleX ?? 1;
      const originalScaleY = element.scaleY ?? 1;

      // Set initial state: opacity 0, scale 0.96
      element.set({
        opacity: 0,
        scaleX: originalScaleX * OpsExecutor.DEFAULT_SCALE_IN,
        scaleY: originalScaleY * OpsExecutor.DEFAULT_SCALE_IN,
      });

      // Animate all properties together using Fabric.js 7 API
      // The animate method takes an object of properties to animate
      element.animate(
        {
          opacity: originalOpacity,
          scaleX: originalScaleX,
          scaleY: originalScaleY,
        },
        {
          duration,
          easing: fabric.util.ease.easeOutCubic,
          onChange: () => this.canvas.requestRenderAll(),
          onComplete: () => resolve(),
        }
      );
    });
  }

  /**
   * Animate multiple elements with staggered timing
   * Requirements: 6.4, 6.5
   * 
   * Staggers animations by 50ms for each element in the batch
   * Animation is local-only (not synced via Realtime)
   * 
   * @param elements - Array of Fabric.js objects to animate
   * @param options - Animation options including stagger delay
   * @returns Promise that resolves when all animations complete
   */
  animateElements(
    elements: fabric.FabricObject[],
    options: AnimatedAddOptions = {}
  ): Promise<void[]> {
    const {
      staggerDelay = OpsExecutor.DEFAULT_STAGGER_DELAY,
      animate = true,
    } = options;

    // Skip animation if disabled or no elements
    if (!animate || elements.length === 0) {
      return Promise.resolve([]);
    }

    const animationPromises = elements.map((element, index) => {
      return new Promise<void>((resolve) => {
        // Stagger the start of each animation
        setTimeout(() => {
          this.animateElement(element, options).then(resolve);
        }, index * staggerDelay);
      });
    });

    return Promise.all(animationPromises);
  }

  /**
   * Get the default animation duration
   */
  static getDefaultAnimationDuration(): number {
    return OpsExecutor.DEFAULT_ANIMATION_DURATION;
  }

  /**
   * Get the default stagger delay
   */
  static getDefaultStaggerDelay(): number {
    return OpsExecutor.DEFAULT_STAGGER_DELAY;
  }

  /**
   * Get the default scale-in value
   */
  static getDefaultScaleIn(): number {
    return OpsExecutor.DEFAULT_SCALE_IN;
  }

  /**
   * Execute an array of ops in sequence
   * Requirement 9.1: Execute ops in sequence
   * Requirement 9.2: Stop on invalid op
   */
  async execute(ops: Op[], documentId?: string): Promise<void> {
    // Validate all ops before execution
    for (let i = 0; i < ops.length; i++) {
      if (!validateOp(ops[i])) {
        const error = new OpsExecutionError(
          `Invalid op at index ${i}: missing required fields or invalid type`,
          ops[i]
        );
        if (this.onError) {
          this.onError(error, ops[i]);
        }
        throw error;
      }
    }

    // Execute each op
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      
      // Check for idempotency if documentId and seq provided
      const opWithSeq = op as Op & { seq?: number };
      if (documentId && opWithSeq.seq !== undefined) {
        const seqKey = `${documentId}:${opWithSeq.seq}`;
        if (this.executedSeqs.has(seqKey)) {
          // Skip already executed op
          continue;
        }
        this.executedSeqs.add(seqKey);
      }

      try {
        await this.executeOp(op);
        if (this.onOpExecuted) {
          this.onOpExecuted(op, i);
        }
      } catch (error) {
        const execError = new OpsExecutionError(
          `Failed to execute op ${op.type} at index ${i}`,
          op,
          error instanceof Error ? error : undefined
        );
        if (this.onError) {
          this.onError(execError, op);
        }
        throw execError;
      }
    }

    this.canvas.requestRenderAll();
  }

  /**
   * Execute a single op
   */
  private async executeOp(op: Op): Promise<void> {
    switch (op.type) {
      case 'createFrame':
        this.handleCreateFrame(op.payload);
        break;
      case 'setBackground':
        this.handleSetBackground(op as SetBackgroundOp);
        break;
      case 'addText':
        await this.handleAddText(op as AddTextOp);
        break;
      case 'addImage':
        await this.handleAddImage(op as AddImageOp);
        break;
      case 'addRect':
        this.handleAddRect(op as AddRectOp);
        break;
      case 'updateLayer':
        this.handleUpdateLayer(op as UpdateLayerOp);
        break;
      case 'removeLayer':
        this.handleRemoveLayer(op as RemoveLayerOp);
        break;
      case 'setLayerVisibility':
      case 'setLayerLock':
      case 'renameLayer':
        // These ops are handled by Layer Store, not OpsExecutor
        // They are persisted for replay but don't affect canvas directly
        break;
      default:
        throw new Error(`Unknown op type: ${(op as Op).type}`);
    }
  }

  /**
   * Handle createFrame op
   */
  private handleCreateFrame(payload: { width: number; height: number; backgroundColor?: string }): void {
    this.canvas.setDimensions({
      width: payload.width,
      height: payload.height,
    });
    
    if (payload.backgroundColor) {
      this.canvas.backgroundColor = payload.backgroundColor;
    }
  }

  /**
   * Handle setBackground op
   * Requirement 9.3: Set canvas backgroundColor for solid
   * Requirement 9.4: Create gradient rect for gradient
   */
  private handleSetBackground(op: SetBackgroundOp): void {
    const { backgroundType, value } = op.payload;

    // Remove existing background layer if any
    const existingBg = this.layerRegistry.get('__background__');
    if (existingBg) {
      this.canvas.remove(existingBg);
      this.layerRegistry.delete('__background__');
    }

    switch (backgroundType) {
      case 'solid':
        this.canvas.backgroundColor = value as string;
        break;

      case 'gradient': {
        const gradientConfig = value as GradientConfig;
        const width = this.canvas.getWidth();
        const height = this.canvas.getHeight();

        // Create gradient with explicit type
        const gradientType = gradientConfig.type;
        const gradient = gradientType === 'linear'
          ? new fabric.Gradient<'linear'>({
              type: 'linear',
              coords: gradientConfig.coords || {
                x1: 0,
                y1: 0,
                x2: width,
                y2: height,
              },
              colorStops: gradientConfig.colorStops,
            })
          : new fabric.Gradient<'radial'>({
              type: 'radial',
              coords: gradientConfig.coords || {
                x1: width / 2,
                y1: height / 2,
                x2: width / 2,
                y2: height / 2,
                r1: 0,
                r2: Math.max(width, height) / 2,
              },
              colorStops: gradientConfig.colorStops,
            });

        // Create background rect with gradient
        const bgRect = new fabric.Rect({
          left: 0,
          top: 0,
          width,
          height,
          fill: gradient,
          selectable: false,
          evented: false,
        }) as ExtendedFabricObject;

        bgRect.id = '__background__';
        bgRect.layerType = 'background';

        this.canvas.add(bgRect);
        this.canvas.sendObjectToBack(bgRect);
        this.layerRegistry.set('__background__', bgRect);
        break;
      }

      case 'image': {
        const imageUrl = value as string;
        fabric.FabricImage.fromURL(imageUrl).then((img) => {
          const width = this.canvas.getWidth();
          const height = this.canvas.getHeight();

          img.scaleToWidth(width);
          img.scaleToHeight(height);
          img.set({
            left: 0,
            top: 0,
            selectable: false,
            evented: false,
          });

          (img as ExtendedFabricObject).id = '__background__';
          (img as ExtendedFabricObject).layerType = 'background';

          this.canvas.add(img);
          this.canvas.sendObjectToBack(img);
          this.layerRegistry.set('__background__', img);
          this.canvas.requestRenderAll();
        });
        break;
      }
    }
  }

  /**
   * Handle addText op
   * Requirement 9.5: Create Fabric IText object with specified properties
   */
  private async handleAddText(op: AddTextOp): Promise<void> {
    const { payload } = op;

    // Check if layer with this ID already exists in registry (idempotency)
    if (this.layerRegistry.has(payload.id)) {
      return;
    }

    // Also check if object already exists on canvas (for manual tool creation)
    const existingObject = this.canvas.getObjects().find(
      (obj) => (obj as ExtendedFabricObject).id === payload.id
    );
    if (existingObject) {
      // Object already exists on canvas, just register it
      this.layerRegistry.set(payload.id, existingObject as ExtendedFabricObject);
      return;
    }

    const textOptions: Partial<fabric.ITextProps> = {
      left: payload.x,
      top: payload.y,
      fontSize: payload.fontSize ?? 24,
      fontFamily: payload.fontFamily ?? 'Inter',
      fill: payload.fill ?? '#000000',
      fontWeight: (payload.fontWeight ?? 'normal') as fabric.ITextProps['fontWeight'],
      textAlign: payload.textAlign ?? 'left',
    };

    // Add width for text wrapping if specified
    if (payload.width) {
      textOptions.width = payload.width;
    }

    const text = new fabric.IText(payload.text, textOptions) as ExtendedFabricObject;
    text.id = payload.id;
    text.name = payload.text.substring(0, 20);

    this.canvas.add(text);
    this.layerRegistry.set(payload.id, text);
  }

  /**
   * Handle addRect op
   * Requirement 8.4: Create Fabric Rect object with specified properties
   */
  private handleAddRect(op: AddRectOp): void {
    const { payload } = op;

    // Check if layer with this ID already exists in registry (idempotency)
    if (this.layerRegistry.has(payload.id)) {
      return;
    }

    // Also check if object already exists on canvas (for manual tool creation)
    const existingObject = this.canvas.getObjects().find(
      (obj) => (obj as ExtendedFabricObject).id === payload.id
    );
    if (existingObject) {
      // Object already exists on canvas, just register it
      this.layerRegistry.set(payload.id, existingObject as ExtendedFabricObject);
      return;
    }

    const rect = new fabric.Rect({
      left: payload.x,
      top: payload.y,
      width: payload.width,
      height: payload.height,
      fill: payload.fill ?? '#3b82f6',
      stroke: payload.stroke,
      strokeWidth: payload.strokeWidth ?? 0,
    }) as ExtendedFabricObject;

    rect.id = payload.id;
    rect.name = `矩形`;
    rect.layerType = 'rect';

    this.canvas.add(rect);
    this.layerRegistry.set(payload.id, rect);
  }

  /**
   * Handle addImage op
   * Requirement 9.6: Load image from URL and create Fabric Image object
   */
  private async handleAddImage(op: AddImageOp): Promise<void> {
    const { payload } = op;

    // Check if layer with this ID already exists in registry (idempotency)
    if (this.layerRegistry.has(payload.id)) {
      return;
    }

    // Also check if object already exists on canvas (for manual tool creation)
    const existingObject = this.canvas.getObjects().find(
      (obj) => (obj as ExtendedFabricObject).id === payload.id
    );
    if (existingObject) {
      // Object already exists on canvas, just register it
      this.layerRegistry.set(payload.id, existingObject as ExtendedFabricObject);
      return;
    }

    return new Promise((resolve, reject) => {
      fabric.FabricImage.fromURL(payload.src, { crossOrigin: 'anonymous' })
        .then((img) => {
          let scaleX = 1;
          let scaleY = 1;
          
          // If explicit scaleX/scaleY provided, use them directly (for updateLayer ops)
          if (payload.scaleX !== undefined || payload.scaleY !== undefined) {
            scaleX = payload.scaleX ?? 1;
            scaleY = payload.scaleY ?? 1;
          } 
          // If width and height provided, calculate uniform scale to fit within bounds
          // while maintaining aspect ratio
          else if (payload.width !== undefined && payload.height !== undefined && img.width && img.height) {
            const scaleToFitWidth = payload.width / img.width;
            const scaleToFitHeight = payload.height / img.height;
            // Use the smaller scale to ensure image fits within both dimensions
            const uniformScale = Math.min(scaleToFitWidth, scaleToFitHeight);
            scaleX = uniformScale;
            scaleY = uniformScale;
          }
          // If only width provided, scale proportionally
          else if (payload.width !== undefined && img.width) {
            const uniformScale = payload.width / img.width;
            scaleX = uniformScale;
            scaleY = uniformScale;
          }
          // If only height provided, scale proportionally
          else if (payload.height !== undefined && img.height) {
            const uniformScale = payload.height / img.height;
            scaleX = uniformScale;
            scaleY = uniformScale;
          }

          // Set all properties at once
          img.set({
            left: payload.x,
            top: payload.y,
            scaleX: scaleX,
            scaleY: scaleY,
          });

          (img as ExtendedFabricObject).id = payload.id;
          (img as ExtendedFabricObject).name = `Image ${payload.id}`;

          this.canvas.add(img);
          this.layerRegistry.set(payload.id, img);
          this.canvas.requestRenderAll();
          resolve();
        })
        .catch((error) => {
          console.error('[OpsExecutor] Failed to load image:', payload.id, error);
          reject(new Error(`Failed to load image from ${payload.src}: ${error.message}`));
        });
    });
  }

  /**
   * Handle updateLayer op
   * Requirement 9.7: Find layer by id and update specified properties
   */
  private handleUpdateLayer(op: UpdateLayerOp): void {
    const { id, properties } = op.payload;

    const layer = this.layerRegistry.get(id);
    if (!layer) {
      // Layer might not exist yet (e.g., from realtime sync before initial load)
      console.warn(`[OpsExecutor] Layer with id "${id}" not found, skipping update`);
      return;
    }

    // Map x/y to left/top if provided (for compatibility)
    const mappedProperties = { ...properties } as Record<string, unknown>;
    if ('x' in mappedProperties && mappedProperties.x !== undefined) {
      mappedProperties.left = mappedProperties.x;
      delete mappedProperties.x;
    }
    if ('y' in mappedProperties && mappedProperties.y !== undefined) {
      mappedProperties.top = mappedProperties.y;
      delete mappedProperties.y;
    }

    // Update properties
    layer.set(mappedProperties as Partial<fabric.FabricObject>);
    layer.setCoords();
    this.canvas.requestRenderAll();
  }

  /**
   * Handle removeLayer op
   * Requirement 9.8: Find and remove layer by id
   */
  private handleRemoveLayer(op: RemoveLayerOp): void {
    const { id } = op.payload;

    const layer = this.layerRegistry.get(id);
    if (!layer) {
      throw new Error(`Layer with id "${id}" not found`);
    }

    this.canvas.remove(layer);
    this.layerRegistry.delete(id);
  }

  /**
   * Get layer by ID
   * Requirement 9.9: Layer registry lookup
   */
  getLayerById(id: string): fabric.FabricObject | undefined {
    return this.layerRegistry.get(id);
  }

  /**
   * Get all layers info
   * Requirement 9.9: Layer registry
   */
  getAllLayers(): LayerInfo[] {
    const layers: LayerInfo[] = [];

    this.layerRegistry.forEach((obj, id) => {
      const extObj = obj as ExtendedFabricObject;
      let type: LayerInfo['type'] = 'rect';

      if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
        type = 'text';
      } else if (obj.type === 'image') {
        type = 'image';
      } else if (extObj.layerType === 'background') {
        type = 'background';
      }

      layers.push({
        id,
        type,
        name: extObj.name || id,
        visible: obj.visible !== false,
        locked: obj.selectable === false,
      });
    });

    return layers;
  }

  /**
   * Get layer registry size
   */
  getLayerCount(): number {
    return this.layerRegistry.size;
  }

  /**
   * Check if layer exists
   */
  hasLayer(id: string): boolean {
    return this.layerRegistry.has(id);
  }

  /**
   * Clear all layers and registry
   */
  clear(): void {
    this.layerRegistry.forEach((obj) => {
      this.canvas.remove(obj);
    });
    this.layerRegistry.clear();
    this.executedSeqs.clear();
    this.canvas.backgroundColor = '#ffffff';
    this.canvas.requestRenderAll();
  }

  /**
   * Reset executed sequences (for testing)
   */
  resetExecutedSeqs(): void {
    this.executedSeqs.clear();
  }
}

/**
 * Create OpsExecutor instance
 */
export function createOpsExecutor(config: OpsExecutorConfig): OpsExecutor {
  return new OpsExecutor(config);
}

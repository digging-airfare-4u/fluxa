'use client';

/**
 * CanvasStage Component - Main Fabric.js canvas wrapper
 * Requirements: 2.1, 2.2, 2.3, 7.1, 13.1, 13.3
 * 
 * Integrates with Layer Store via CanvasSynchronizer for bidirectional
 * state synchronization between layers and canvas objects.
 */

import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from 'react';
import * as fabric from 'fabric';
import { ContextMenu } from './ContextMenu';
import { SelectionInfo, QuickEditHint } from './SelectionInfo';
import { TextToolbar, type TextProperties } from './TextToolbar';
import { ImageToolbar } from './ImageToolbar';
import type { ImageToolbarLoadingStates } from './ImageToolbar.types';
import { Minus, Plus, Maximize2, MousePointer2 } from 'lucide-react';
import { CanvasSynchronizer, createCanvasSynchronizer } from '@/lib/canvas/canvasSynchronizer';
import { useLayerStore } from '@/lib/store/useLayerStore';
import { OpsPersistenceManager, createOpsPersistenceManager } from '@/lib/canvas/opsPersistenceManager';
import { useT } from '@/lib/i18n/hooks';
import type { ToolType, LayerInfo, CanvasState, LayerModifiedEvent } from './types';

// Re-export types for backward compatibility
export type { ToolType, LayerInfo, CanvasState, LayerModifiedEvent };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_FACTOR = 1.15;
const ZOOM_STEP = 0.5;
const PAN_SENSITIVITY = 1;

// Custom cursor SVG for select tool
const SELECT_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M4 4L10.5 20L13 13L20 10.5L4 4Z" fill="black" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;
const SELECT_CURSOR_URL = `url('data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa(SELECT_CURSOR_SVG) : ''}') 4 4, default`;

export interface CanvasStageProps {
  documentId: string;
  width?: number;
  height?: number;
  activeTool?: ToolType;
  onSelectionChange?: (layerId: string | null) => void;
  onLayersChange?: (layers: LayerInfo[]) => void;
  onLayerModified?: (event: LayerModifiedEvent) => void;
  onToolReset?: () => void;
}

export interface CanvasStageRef {
  getCanvas(): fabric.Canvas | null;
  getSynchronizer(): CanvasSynchronizer | null;
  getPersistenceManager(): OpsPersistenceManager | null;
  exportPNG(multiplier: number): Promise<Blob>;
  selectLayer(layerId: string): void;
  selectAndCenterLayer(layerId: string): void;
  selectAndCenterLayerByImageUrl(imageUrl: string): boolean;
  deleteSelected(): void;
  undo(): void;
  redo(): void;
  getCanvasState(): CanvasState | null;
  setZoom(zoom: number): void;
  getZoom(): number;
  resetView(): void;
}

interface SelectionInfoState {
  type: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

interface TextToolbarState {
  x: number;
  y: number;
  properties: TextProperties;
}

interface ImageToolbarState {
  x: number;
  y: number;
  imageWidth: number;
  imageHeight: number;
  positionBelow: boolean;
  isLocked: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
}

const CanvasStage = forwardRef<CanvasStageRef, CanvasStageProps>(
  (
    {
      documentId,
      activeTool = 'select',
      onSelectionChange,
      onLayersChange,
      onLayerModified,
      onToolReset,
    },
    ref
  ) => {
    const t = useT('editor');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<fabric.Canvas | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoomState] = useState(0.5);
    const [isPanning, setIsPanning] = useState(false);
    const [spacePressed, setSpacePressed] = useState(false);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);

    // Drawing state
    const isDrawingRef = useRef(false);
    const drawStartRef = useRef<{ x: number; y: number } | null>(null);
    const currentShapeRef = useRef<fabric.FabricObject | null>(null);

    // Selection state
    const [selectionInfo, setSelectionInfo] = useState<SelectionInfoState | null>(null);
    const [textToolbarInfo, setTextToolbarInfo] = useState<TextToolbarState | null>(null);
    const [imageToolbarInfo, setImageToolbarInfo] = useState<ImageToolbarState | null>(null);
    const [imageToolbarLoading, setImageToolbarLoading] = useState<ImageToolbarLoadingStates>({
      removeBackground: false,
      upscale: false,
      erase: false,
      expand: false,
    });
    const selectedTextRef = useRef<fabric.IText | null>(null);
    const selectedImageRef = useRef<fabric.FabricImage | null>(null);
    const selectionUpdateRafRef = useRef<number | null>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const clipboardRef = useRef<fabric.FabricObject | null>(null);

    // History for undo/redo
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);
    const isUndoRedoRef = useRef(false);

    // Canvas Synchronizer and Persistence Manager refs
    const synchronizerRef = useRef<CanvasSynchronizer | null>(null);
    const persistenceManagerRef = useRef<OpsPersistenceManager | null>(null);

    // Get Layer Store actions
    const getLayerStoreActions = useCallback(() => {
      const store = useLayerStore.getState();
      return {
        createLayer: store.createLayer,
        removeLayer: store.removeLayer,
        setSelectedLayer: store.setSelectedLayer,
        getLayerByCanvasObjectId: store.getLayerByCanvasObjectId,
        getLayersArray: store.getLayersArray,
      };
    }, []);

    // Save state to history
    const saveHistory = useCallback(() => {
      if (isUndoRedoRef.current || !fabricRef.current) return;

      const json = JSON.stringify(fabricRef.current.toJSON());
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(json);
      historyIndexRef.current = historyRef.current.length - 1;

      if (historyRef.current.length > 50) {
        historyRef.current.shift();
        historyIndexRef.current--;
      }
    }, []);

    // Extract layers from Layer Store
    const extractLayers = useCallback((): LayerInfo[] => {
      const layers = useLayerStore.getState().getLayersArray();
      return layers.map((layer) => ({
        id: layer.id,
        type: layer.type === 'rect' ? 'rect' : layer.type === 'text' ? 'text' : 'image',
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
      }));
    }, []);

    // Notify layers change
    const notifyLayersChange = useCallback(() => {
      if (onLayersChange) {
        onLayersChange(extractLayers());
      }
    }, [onLayersChange, extractLayers]);

    // Update selection info
    const updateSelectionInfo = useCallback((obj: fabric.FabricObject) => {
      if (!containerRef.current || !fabricRef.current) return;

      if (selectionUpdateRafRef.current) {
        cancelAnimationFrame(selectionUpdateRafRef.current);
      }

      selectionUpdateRafRef.current = requestAnimationFrame(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;

        const boundingRect = obj.getBoundingRect();
        const vpt = canvas.viewportTransform;

        if (!vpt) return;

        const screenX = boundingRect.left * vpt[0] + vpt[4];
        const screenY = boundingRect.top * vpt[3] + vpt[5];

        setSelectionInfo({
          type: obj.type || 'object',
          width: boundingRect.width,
          height: boundingRect.height,
          x: screenX + (boundingRect.width * vpt[0]) / 2,
          y: screenY,
        });

        // Check if selected object is a text type
        if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
          const textObj = obj as fabric.IText;
          selectedTextRef.current = textObj;
          setTextToolbarInfo({
            x: screenX + (boundingRect.width * vpt[0]) / 2,
            y: screenY,
            properties: {
              fontFamily: textObj.fontFamily || 'Inter',
              fontSize: textObj.fontSize || 24,
              fontWeight: textObj.fontWeight as string || 'normal',
              fontStyle: textObj.fontStyle || 'normal',
              fill: (textObj.fill as string) || '#000000',
              textAlign: textObj.textAlign || 'left',
              underline: textObj.underline || false,
              linethrough: textObj.linethrough || false,
            },
          });
          // Clear image toolbar when text is selected
          selectedImageRef.current = null;
          setImageToolbarInfo(null);
        } else if (obj.type === 'activeselection') {
          // Multi-select (ActiveSelection): hide both toolbars
          selectedTextRef.current = null;
          setTextToolbarInfo(null);
          selectedImageRef.current = null;
          setImageToolbarInfo(null);
        } else if (obj.type === 'image') {
          // Single image selection
          const imageObj = obj as fabric.FabricImage;
          selectedImageRef.current = imageObj;

          // Calculate screen coordinates for toolbar positioning
          const scaledWidth = boundingRect.width * vpt[0];
          const scaledHeight = boundingRect.height * vpt[3];

          // Check if image is near top edge of viewport (need to position toolbar below)
          const toolbarHeight = 44; // Approximate toolbar height
          const edgeMargin = 8;
        const positionBelow = screenY < toolbarHeight + edgeMargin;
        
        // Check if image is locked
        const isLocked = !imageObj.selectable || !imageObj.evented;
        
        setImageToolbarInfo({
          x: screenX,
          y: screenY,
          imageWidth: scaledWidth,
          imageHeight: scaledHeight,
          positionBelow,
          isLocked,
        });
        
        // Clear text toolbar when image is selected
        selectedTextRef.current = null;
        setTextToolbarInfo(null);
      } else {
        // Non-text, non-image object: clear both toolbars
        selectedTextRef.current = null;
        setTextToolbarInfo(null);
        selectedImageRef.current = null;
        setImageToolbarInfo(null);
      }
    }, []);

    // Handle text property change
    const handleTextPropertyChange = useCallback((property: keyof TextProperties, value: string | number | boolean) => {
      const textObj = selectedTextRef.current;
      if (!textObj || !fabricRef.current) return;

      textObj.set(property as keyof fabric.IText, value);
      textObj.setCoords();
      fabricRef.current.requestRenderAll();

      setTextToolbarInfo(prev => {
        if (!prev) return null;
        return { ...prev, properties: { ...prev.properties, [property]: value } };
      });

      const layerId = (textObj as fabric.IText & { id?: string }).id;
      if (layerId && persistenceManagerRef.current) {
        persistenceManagerRef.current.updateLayer(layerId, { [property]: value } as Record<string, unknown>).catch(console.error);
      }
    }, []);

    // Context menu handlers
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      if (!fabricRef.current) return;
      const activeObject = fabricRef.current.getActiveObject();
      if (activeObject) {
        setContextMenu({ x: e.clientX, y: e.clientY });
      }
    }, []);

    const handleCopy = useCallback(() => {
      if (!fabricRef.current) return;
      const activeObject = fabricRef.current.getActiveObject();
      if (activeObject) {
        activeObject.clone().then((cloned: fabric.FabricObject) => {
          clipboardRef.current = cloned;
        });
      }
    }, []);

    /**
     * Duplicate the selected object with offset position
     * Requirements: 12.3, 12.4 - Duplicate with Cmd/Ctrl+D, offset position
     */
    const handleDuplicate = useCallback(() => {
      if (!fabricRef.current) return;
      const activeObject = fabricRef.current.getActiveObject();
      if (activeObject) {
        activeObject.clone().then((cloned: fabric.FabricObject) => {
          // Offset the duplicated object by 20px
          cloned.set({ 
            left: (cloned.left || 0) + 20, 
            top: (cloned.top || 0) + 20 
          });
          
          // Generate new ID for the duplicated object
          const newId = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          (cloned as fabric.FabricObject & { id?: string }).id = newId;
          
          fabricRef.current?.add(cloned);
          fabricRef.current?.setActiveObject(cloned);
          fabricRef.current?.requestRenderAll();
          
          console.log('[CanvasStage] Object duplicated successfully');
        }).catch((error: Error) => {
          console.error('[CanvasStage] Failed to duplicate object:', error);
        });
      }
    }, []);

    const handlePaste = useCallback(() => {
      if (!fabricRef.current || !clipboardRef.current) return;
      clipboardRef.current.clone().then((cloned: fabric.FabricObject) => {
        cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
        fabricRef.current?.add(cloned);
        fabricRef.current?.setActiveObject(cloned);
        fabricRef.current?.requestRenderAll();
      });
    }, []);

    const handleBringForward = useCallback(() => {
      if (!fabricRef.current) return;
      const activeObject = fabricRef.current.getActiveObject();
      if (activeObject) {
        fabricRef.current.bringObjectForward(activeObject);
        fabricRef.current.requestRenderAll();
      }
    }, []);

    const handleSendBackward = useCallback(() => {
      if (!fabricRef.current) return;
      const activeObject = fabricRef.current.getActiveObject();
      if (activeObject) {
        fabricRef.current.sendObjectBackwards(activeObject);
        fabricRef.current.requestRenderAll();
      }
    }, []);

    const handleBringToFront = useCallback(() => {
      if (!fabricRef.current) return;
      const activeObject = fabricRef.current.getActiveObject();
      if (activeObject) {
        fabricRef.current.bringObjectToFront(activeObject);
        fabricRef.current.requestRenderAll();
      }
    }, []);

    const handleSendToBack = useCallback(() => {
      if (!fabricRef.current) return;
      const activeObject = fabricRef.current.getActiveObject();
      if (activeObject) {
        fabricRef.current.sendObjectToBack(activeObject);
        fabricRef.current.requestRenderAll();
      }
    }, []);

    // Image toolbar handlers
    /**
     * Download the selected image at its original resolution
     * Requirements: 3.1, 3.2, 3.3, 3.4 - Export original resolution, trigger download with timestamp filename, error handling
     */
    const handleImageDownload = useCallback(async () => {
      const imageObj = selectedImageRef.current;
      if (!imageObj) {
        console.error('[CanvasStage] No image selected for download');
        return;
      }
      
      try {
        // Get the original image source
        const src = imageObj.getSrc?.() || (imageObj as unknown as { _element?: HTMLImageElement })._element?.src;
        if (!src) {
          console.error('[CanvasStage] No image source found - EXPORT_FAILED');
          // TODO: Show error notification when toast system is available
          return;
        }
        
        // Fetch the image to get original resolution (not scaled by canvas zoom)
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        
        // Validate blob
        if (!blob || blob.size === 0) {
          throw new Error('Downloaded image is empty or invalid');
        }
        
        const url = URL.createObjectURL(blob);
        
        // Generate filename with timestamp (format: image-YYYYMMDD-HHmmss.png)
        const now = new Date();
        const timestamp = now.toISOString()
          .replace(/[-:]/g, '')
          .replace('T', '-')
          .slice(0, 15);
        const filename = `image-${timestamp}.png`;
        
        // Create download link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('[CanvasStage] Image downloaded successfully:', filename);
      } catch (error) {
        // Log error with context for debugging
        console.error('[CanvasStage] Failed to download image - EXPORT_FAILED:', {
          error: error instanceof Error ? error.message : String(error),
          imageType: imageObj.type,
        });
        // TODO: Show error toast notification when toast system is available
        // toast.error(t('image_toolbar.error_processing'));
      }
    }, []);

    /**
     * Copy the selected image to internal clipboard
     * Requirements: 4.1, 4.2 - Copy to clipboard with success feedback
     */
    const handleImageCopy = useCallback(() => {
      const imageObj = selectedImageRef.current;
      if (!imageObj || !fabricRef.current) {
        console.warn('[CanvasStage] No image selected for copy');
        return;
      }
      
      imageObj.clone().then((cloned: fabric.FabricObject) => {
        clipboardRef.current = cloned;
        console.log('[CanvasStage] Image copied to clipboard successfully');
        // TODO: Show success toast notification when toast system is available
        // toast.success(t('image_toolbar.copy_success'));
      }).catch((error: Error) => {
        console.error('[CanvasStage] Failed to copy image - COPY_FAILED:', error);
        // TODO: Show error toast notification when toast system is available
      });
    }, []);

    /**
     * Delete the selected image from canvas
     * Requirements: 5.1, 5.2 - Remove image, toolbar disappears, recorded in undo history
     */
    const handleImageDelete = useCallback(() => {
      const imageObj = selectedImageRef.current;
      if (!imageObj || !fabricRef.current) {
        console.warn('[CanvasStage] No image selected for deletion');
        return;
      }
      
      const layerId = (imageObj as fabric.FabricImage & { id?: string }).id;
      
      // Use persistence manager if available (handles undo history)
      if (layerId && persistenceManagerRef.current) {
        persistenceManagerRef.current.removeLayer(layerId).catch((error) => {
          console.error('[CanvasStage] Failed to remove layer via persistence manager:', error);
        });
      } else {
        // Fallback: directly remove from canvas
        fabricRef.current.remove(imageObj);
      }
      
      // Clear selection and toolbar
      fabricRef.current.discardActiveObject();
      fabricRef.current.requestRenderAll();
      
      // Clear image toolbar state (Requirements: 5.2 - toolbar disappears)
      setImageToolbarInfo(null);
      selectedImageRef.current = null;
      
      console.log('[CanvasStage] Image deleted successfully', layerId ? `(layer: ${layerId})` : '');
    }, []);

    const handleImageRemoveBackground = useCallback(async () => {
      // TODO: Implement AI background removal in task 12
      console.log('[CanvasStage] Remove background - not yet implemented');
    }, []);

    const handleImageUpscale = useCallback(async () => {
      // TODO: Implement AI upscale in task 13
      console.log('[CanvasStage] Upscale - not yet implemented');
    }, []);

    const handleImageErase = useCallback(() => {
      // TODO: Implement AI erase in task 14
      console.log('[CanvasStage] Erase - not yet implemented');
    }, []);

    const handleImageExpand = useCallback(() => {
      // TODO: Implement AI expand in task 15
      console.log('[CanvasStage] Expand - not yet implemented');
    }, []);

    const handleImageToggleLock = useCallback(() => {
      const imageObj = selectedImageRef.current;
      if (!imageObj || !fabricRef.current) return;
      
      const isCurrentlyLocked = !imageObj.selectable || !imageObj.evented;
      const newLockState = !isCurrentlyLocked;
      
      imageObj.set({
        selectable: !newLockState,
        evented: !newLockState,
      });
      
      fabricRef.current.requestRenderAll();
      
      // Update toolbar state
      setImageToolbarInfo(prev => prev ? { ...prev, isLocked: newLockState } : null);
    }, []);

    // Reset view
    const resetView = useCallback(() => {
      if (!fabricRef.current || !containerRef.current) return;
      const canvas = fabricRef.current;
      const container = containerRef.current;
      canvas.setZoom(1);
      setZoomState(1);
      const vpt = canvas.viewportTransform;
      if (vpt) {
        vpt[4] = container.clientWidth / 2;
        vpt[5] = container.clientHeight / 2;
        canvas.setViewportTransform(vpt);
      }
    }, []);

    // Handle zoom
    const handleZoom = useCallback((newZoom: number) => {
      if (!fabricRef.current || !containerRef.current) return;
      const canvas = fabricRef.current;
      const container = containerRef.current;
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      const center = new fabric.Point(container.clientWidth / 2, container.clientHeight / 2);
      canvas.zoomToPoint(center, clampedZoom);
      setZoomState(clampedZoom);
    }, []);

    // Undo function
    const undo = useCallback(() => {
      if (!fabricRef.current || historyIndexRef.current <= 0) return;
      isUndoRedoRef.current = true;
      historyIndexRef.current--;
      const state = historyRef.current[historyIndexRef.current];
      fabricRef.current.loadFromJSON(JSON.parse(state)).then(() => {
        fabricRef.current?.requestRenderAll();
        notifyLayersChange();
        isUndoRedoRef.current = false;
      });
    }, [notifyLayersChange]);

    // Redo function
    const redo = useCallback(() => {
      if (!fabricRef.current || historyIndexRef.current >= historyRef.current.length - 1) return;
      isUndoRedoRef.current = true;
      historyIndexRef.current++;
      const state = historyRef.current[historyIndexRef.current];
      fabricRef.current.loadFromJSON(JSON.parse(state)).then(() => {
        fabricRef.current?.requestRenderAll();
        notifyLayersChange();
        isUndoRedoRef.current = false;
      });
    }, [notifyLayersChange]);

    // Delete selected object
    const deleteSelected = useCallback(() => {
      if (!fabricRef.current) return;
      const activeObject = fabricRef.current.getActiveObject();
      if (activeObject) {
        const layerId = (activeObject as fabric.FabricObject & { id?: string }).id;
        if (layerId && persistenceManagerRef.current) {
          persistenceManagerRef.current.removeLayer(layerId).catch(console.error);
        } else {
          fabricRef.current.remove(activeObject);
        }
        fabricRef.current.discardActiveObject();
        fabricRef.current.requestRenderAll();
      }
    }, []);

    // Generate unique layer ID
    const generateLayerId = useCallback(() => {
      return `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }, []);

    // Handle drag and drop
    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const canvas = fabricRef.current;
      const container = containerRef.current;
      const persistenceManager = persistenceManagerRef.current;
      if (!canvas || !container || !persistenceManager) return;

      const fluxaData = e.dataTransfer.getData('application/x-fluxa-image');
      let imageUrl: string | null = null;

      if (fluxaData) {
        try {
          const data = JSON.parse(fluxaData);
          imageUrl = data.src;
        } catch { /* Fall back to plain text */ }
      }

      if (!imageUrl) {
        imageUrl = e.dataTransfer.getData('text/plain');
      }
      if (!imageUrl) return;

      const rect = container.getBoundingClientRect();
      const vpt = canvas.viewportTransform;
      if (!vpt) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const canvasX = (screenX - vpt[4]) / vpt[0];
      const canvasY = (screenY - vpt[5]) / vpt[3];

      try {
        const layerId = await persistenceManager.addImage({ src: imageUrl, x: canvasX, y: canvasY });
        const objects = canvas.getObjects();
        const newImage = objects.find((obj) => (obj as fabric.FabricObject & { id?: string }).id === layerId);
        if (newImage) {
          canvas.setActiveObject(newImage);
          canvas.requestRenderAll();
        }
      } catch (error) {
        console.error('[CanvasStage] Failed to add dropped image:', error);
      }
    }, []);

    // Initialize Fabric canvas
    useEffect(() => {
      if (!canvasRef.current || fabricRef.current) return;
      const container = containerRef.current;
      if (!container) return;

      const canvas = new fabric.Canvas(canvasRef.current, {
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundColor: 'transparent',
        selection: true,
        preserveObjectStacking: true,
        renderOnAddRemove: true,
        defaultCursor: SELECT_CURSOR_URL,
        hoverCursor: SELECT_CURSOR_URL,
        moveCursor: 'move',
      });

      fabricRef.current = canvas;

      const actions = getLayerStoreActions();
      const synchronizer = createCanvasSynchronizer({
        canvas,
        onLayerCreate: actions.createLayer,
        onLayerRemove: actions.removeLayer,
        onSelectionChange: actions.setSelectedLayer,
        getLayerByCanvasObjectId: actions.getLayerByCanvasObjectId,
        getLayersArray: actions.getLayersArray,
      });
      synchronizer.initialize();
      synchronizerRef.current = synchronizer;

      const persistenceManager = createOpsPersistenceManager(documentId, canvas);
      persistenceManagerRef.current = persistenceManager;

      setTimeout(() => {
        canvas.setZoom(1);
        setZoomState(1);
        const vpt = canvas.viewportTransform;
        if (vpt && containerRef.current) {
          vpt[4] = containerRef.current.clientWidth / 2;
          vpt[5] = containerRef.current.clientHeight / 2;
          canvas.setViewportTransform(vpt);
        }
      }, 0);

      // Selection events
      canvas.on('selection:created', (e) => {
        const selected = e.selected?.[0];
        if (selected) {
          onSelectionChange?.((selected as fabric.FabricObject & { id?: string }).id || null);
          updateSelectionInfo(selected);
        }
      });

      canvas.on('selection:updated', (e) => {
        const selected = e.selected?.[0];
        if (selected) {
          onSelectionChange?.((selected as fabric.FabricObject & { id?: string }).id || null);
          updateSelectionInfo(selected);
        }
      });

      canvas.on('selection:cleared', () => {
        onSelectionChange?.(null);
        setSelectionInfo(null);
        setTextToolbarInfo(null);
        setImageToolbarInfo(null);
        selectedTextRef.current = null;
        selectedImageRef.current = null;
      });

      // Object modification events
      canvas.on('object:modified', () => {
        saveHistory();
        notifyLayersChange();
        const active = canvas.getActiveObject();
        if (active) {
          updateSelectionInfo(active);
          const layerId = (active as fabric.FabricObject & { id?: string }).id;
          if (layerId && onLayerModified) {
            onLayerModified({
              layerId,
              properties: {
                left: active.left ?? 0,
                top: active.top ?? 0,
                scaleX: active.scaleX ?? 1,
                scaleY: active.scaleY ?? 1,
                angle: active.angle ?? 0,
              },
            });
          }
        }
      });

      canvas.on('object:moving', () => {
        const active = canvas.getActiveObject();
        if (active) updateSelectionInfo(active);
      });

      canvas.on('object:scaling', () => {
        const active = canvas.getActiveObject();
        if (active) updateSelectionInfo(active);
      });

      canvas.on('object:added', () => { saveHistory(); notifyLayersChange(); });
      canvas.on('object:removed', () => { saveHistory(); notifyLayersChange(); });

      saveHistory();

      const handleResize = () => {
        if (!container || !canvas) return;
        canvas.setDimensions({ width: container.clientWidth, height: container.clientHeight });
        canvas.requestRenderAll();
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (selectionUpdateRafRef.current) {
          cancelAnimationFrame(selectionUpdateRafRef.current);
        }
        synchronizerRef.current?.dispose();
        synchronizerRef.current = null;
        persistenceManagerRef.current = null;
        canvas.dispose();
        fabricRef.current = null;
      };
    }, [documentId, getLayerStoreActions]); // eslint-disable-line react-hooks/exhaustive-deps

    // Subscribe to Layer Store changes
    useEffect(() => {
      const unsubscribe = useLayerStore.subscribe((state, prevState) => {
        if (state.selectedLayerId !== prevState.selectedLayerId && synchronizerRef.current) {
          synchronizerRef.current.syncSelection(state.selectedLayerId);
        }
        for (const [id, layer] of state.layers) {
          const prevLayer = prevState.layers.get(id);
          if (prevLayer?.visible !== layer.visible) synchronizerRef.current?.syncVisibility(id);
          if (prevLayer?.locked !== layer.locked) synchronizerRef.current?.syncLockState(id);
        }
      });
      return () => unsubscribe();
    }, []);

    // Zoom with mouse wheel
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleWheel = (e: WheelEvent) => {
        if (!fabricRef.current) return;
        e.preventDefault();
        const canvas = fabricRef.current;
        
        if (e.ctrlKey || e.metaKey) {
          const direction = e.deltaY > 0 ? -1 : 1;
          let newZoom = canvas.getZoom() * Math.pow(ZOOM_FACTOR, direction);
          newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
          const rect = container.getBoundingClientRect();
          const point = new fabric.Point(e.clientX - rect.left, e.clientY - rect.top);
          canvas.zoomToPoint(point, newZoom);
          setZoomState(newZoom);
        } else {
          const vpt = canvas.viewportTransform;
          if (vpt) {
            if (e.shiftKey) {
              vpt[4] -= e.deltaY * PAN_SENSITIVITY;
            } else {
              vpt[4] -= e.deltaX * PAN_SENSITIVITY;
              vpt[5] -= e.deltaY * PAN_SENSITIVITY;
            }
            canvas.setViewportTransform(vpt);
            canvas.requestRenderAll();
          }
        }
      };

      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }, []);

    // Space key for panning
    useEffect(() => {
      const isInputElement = (target: EventTarget | null): boolean => {
        if (!target || !(target instanceof HTMLElement)) return false;
        const tagName = target.tagName.toLowerCase();
        return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (isInputElement(e.target)) return;
        if (e.code === 'Space' && !spacePressed) {
          setSpacePressed(true);
          if (containerRef.current) containerRef.current.style.cursor = 'grab';
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (isInputElement(e.target)) return;
        if (e.code === 'Space') {
          setSpacePressed(false);
          setIsPanning(false);
          if (containerRef.current) containerRef.current.style.cursor = 'default';
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }, [spacePressed]);

    // Panning with space+drag or middle mouse
    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const handleMouseDown = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        const evt = opt.e as MouseEvent;
        if (evt.button === 1 || (evt.button === 0 && spacePressed)) {
          setIsPanning(true);
          canvas.selection = false;
          lastPosRef.current = { x: evt.clientX, y: evt.clientY };
          if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
        }
      };

      const handleMouseMove = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        if (!isPanning || !lastPosRef.current) return;
        const evt = opt.e as MouseEvent;
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += evt.clientX - lastPosRef.current.x;
          vpt[5] += evt.clientY - lastPosRef.current.y;
          canvas.requestRenderAll();
          lastPosRef.current = { x: evt.clientX, y: evt.clientY };
        }
      };

      const handleMouseUp = () => {
        if (!isPanning) return;
        setIsPanning(false);
        if (activeTool === 'select' || activeTool === 'boxSelect') canvas.selection = true;
        lastPosRef.current = null;
        if (containerRef.current) containerRef.current.style.cursor = spacePressed ? 'grab' : 'default';
      };

      canvas.on('mouse:down', handleMouseDown);
      canvas.on('mouse:move', handleMouseMove);
      canvas.on('mouse:up', handleMouseUp);
      return () => {
        canvas.off('mouse:down', handleMouseDown);
        canvas.off('mouse:move', handleMouseMove);
        canvas.off('mouse:up', handleMouseUp);
      };
    }, [isPanning, spacePressed, activeTool]);

    // Tool mode handling
    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      canvas.isDrawingMode = false;
      canvas.selection = true;

      if (activeTool === 'rectangle') {
        canvas.defaultCursor = 'crosshair';
        canvas.hoverCursor = 'crosshair';
        canvas.selection = false;
      } else if (activeTool === 'text') {
        canvas.defaultCursor = 'text';
        canvas.hoverCursor = 'text';
        canvas.selection = false;
      } else if (activeTool === 'pencil') {
        canvas.isDrawingMode = true;
        canvas.selection = false;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = '#000000';
        canvas.freeDrawingBrush.width = 2;
      } else if (activeTool === 'boxSelect') {
        canvas.defaultCursor = 'crosshair';
        canvas.hoverCursor = 'crosshair';
        canvas.selection = true;
      } else {
        canvas.defaultCursor = SELECT_CURSOR_URL;
        canvas.hoverCursor = SELECT_CURSOR_URL;
      }
      canvas.requestRenderAll();
    }, [activeTool]);

    // Rectangle and Text tool drawing
    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas || !containerRef.current) return;
      if (activeTool !== 'rectangle' && activeTool !== 'text') return;

      const handleMouseDown = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        if (spacePressed) return;
        const pointer = canvas.getScenePoint(opt.e);
        drawStartRef.current = { x: pointer.x, y: pointer.y };
        isDrawingRef.current = true;

        if (activeTool === 'rectangle') {
          const rect = new fabric.Rect({
            left: pointer.x, top: pointer.y, width: 0, height: 0,
            fill: 'transparent', stroke: '#000000', strokeWidth: 2, selectable: false, evented: false,
          });
          canvas.add(rect);
          currentShapeRef.current = rect;
        }
      };

      const handleMouseMove = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        if (!isDrawingRef.current || !drawStartRef.current || activeTool !== 'rectangle') return;
        const pointer = canvas.getScenePoint(opt.e);
        const rect = currentShapeRef.current as fabric.Rect;
        if (!rect) return;
        const left = Math.min(drawStartRef.current.x, pointer.x);
        const top = Math.min(drawStartRef.current.y, pointer.y);
        const width = Math.abs(pointer.x - drawStartRef.current.x);
        const height = Math.abs(pointer.y - drawStartRef.current.y);
        rect.set({ left, top, width, height });
        canvas.requestRenderAll();
      };

      const handleMouseUp = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        if (!isDrawingRef.current || !drawStartRef.current) return;
        const pointer = canvas.getScenePoint(opt.e);
        const persistenceManager = persistenceManagerRef.current;

        if (activeTool === 'rectangle' && currentShapeRef.current) {
          const rect = currentShapeRef.current as fabric.Rect;
          if ((rect.width ?? 0) > 5 && (rect.height ?? 0) > 5) {
            canvas.remove(rect);
            if (persistenceManager) {
              persistenceManager.addRect({
                x: rect.left ?? 0, y: rect.top ?? 0, width: rect.width ?? 0, height: rect.height ?? 0,
                fill: (rect.fill as string) ?? 'transparent', stroke: (rect.stroke as string) ?? '#000000', strokeWidth: rect.strokeWidth ?? 2,
              }).then((layerId) => {
                const objects = canvas.getObjects();
                const newRect = objects.find((obj) => (obj as fabric.FabricObject & { id?: string }).id === layerId);
                if (newRect) { canvas.setActiveObject(newRect); canvas.requestRenderAll(); }
              }).catch(console.error);
            }
          } else {
            canvas.remove(rect);
          }
        } else if (activeTool === 'text' && persistenceManager) {
          persistenceManager.addText({
            text: '双击编辑文字', x: pointer.x, y: pointer.y, fontSize: 24, fontFamily: 'Inter, sans-serif', fill: '#000000',
          }).then((layerId) => {
            const objects = canvas.getObjects();
            const newText = objects.find((obj) => (obj as fabric.FabricObject & { id?: string }).id === layerId) as fabric.IText | undefined;
            if (newText) { canvas.setActiveObject(newText); newText.enterEditing(); newText.selectAll(); canvas.requestRenderAll(); }
          }).catch(console.error);
        }

        isDrawingRef.current = false;
        drawStartRef.current = null;
        currentShapeRef.current = null;
        onToolReset?.();
        canvas.requestRenderAll();
      };

      canvas.on('mouse:down', handleMouseDown);
      canvas.on('mouse:move', handleMouseMove);
      canvas.on('mouse:up', handleMouseUp);
      return () => {
        canvas.off('mouse:down', handleMouseDown);
        canvas.off('mouse:move', handleMouseMove);
        canvas.off('mouse:up', handleMouseUp);
      };
    }, [activeTool, spacePressed, onToolReset]);

    // Pencil tool - handle path created
    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas || activeTool !== 'pencil') return;

      const handlePathCreated = (opt: { path: fabric.Path }) => {
        (opt.path as fabric.Path & { id?: string }).id = generateLayerId();
      };

      canvas.on('path:created', handlePathCreated);
      return () => canvas.off('path:created', handlePathCreated);
    }, [activeTool, generateLayerId]);

    // Keyboard shortcuts
    // Requirements: 12.1, 12.2, 12.3, 12.4 - Delete, Copy (Cmd/Ctrl+C), Duplicate (Cmd/Ctrl+D)
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!fabricRef.current) return;
        const activeElement = document.activeElement;
        const isTyping = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || (activeElement as HTMLElement)?.isContentEditable;

        if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) {
          e.preventDefault();
          deleteSelected();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isTyping) {
          e.preventDefault();
          undo();
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !isTyping) {
          e.preventDefault();
          redo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
          e.preventDefault();
          resetView();
        }
        // Copy: Cmd/Ctrl+C - Requirements: 12.2, 12.4
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !isTyping) {
          e.preventDefault();
          handleCopy();
        }
        // Duplicate: Cmd/Ctrl+D - Requirements: 12.3, 12.4
        if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !isTyping) {
          e.preventDefault();
          handleDuplicate();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [deleteSelected, undo, redo, resetView, handleCopy, handleDuplicate]);

    // Export PNG
    const exportPNG = useCallback(async (multiplier: number): Promise<Blob> => {
      if (!fabricRef.current) throw new Error('Canvas not initialized');
      const objects = fabricRef.current.getObjects();
      if (objects.length === 0) throw new Error('No objects to export');

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      objects.forEach(obj => {
        const rect = obj.getBoundingRect();
        minX = Math.min(minX, rect.left);
        minY = Math.min(minY, rect.top);
        maxX = Math.max(maxX, rect.left + rect.width);
        maxY = Math.max(maxY, rect.top + rect.height);
      });

      const padding = 20;
      const dataURL = fabricRef.current.toDataURL({
        format: 'png', multiplier, quality: 1,
        left: minX - padding, top: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2,
      });

      const response = await fetch(dataURL);
      return response.blob();
    }, []);

    // Select layer by ID
    const selectLayer = useCallback((layerId: string) => {
      if (!fabricRef.current) return;
      const objects = fabricRef.current.getObjects();
      const target = objects.find((obj) => (obj as fabric.FabricObject & { id?: string }).id === layerId);
      if (target) {
        fabricRef.current.setActiveObject(target);
        fabricRef.current.requestRenderAll();
      }
    }, []);

    // Select and center layer
    const selectAndCenterLayer = useCallback((layerId: string) => {
      if (!fabricRef.current || !containerRef.current) return;
      const canvas = fabricRef.current;
      const container = containerRef.current;
      const objects = canvas.getObjects();
      const target = objects.find((obj) => (obj as fabric.FabricObject & { id?: string }).id === layerId);
      if (target) {
        canvas.setActiveObject(target);
        const objCenter = target.getCenterPoint();
        const currentZoom = canvas.getZoom();
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] = container.clientWidth / 2 - objCenter.x * currentZoom;
          vpt[5] = container.clientHeight / 2 - objCenter.y * currentZoom;
          canvas.setViewportTransform(vpt);
        }
        canvas.requestRenderAll();
      }
    }, []);

    // Select and center layer by image URL
    const selectAndCenterLayerByImageUrl = useCallback((imageUrl: string): boolean => {
      if (!fabricRef.current || !containerRef.current) return false;
      const canvas = fabricRef.current;
      const container = containerRef.current;
      const objects = canvas.getObjects();
      
      const target = objects.find((obj) => {
        if (obj.type === 'image') {
          const imgObj = obj as fabric.FabricImage;
          const src = imgObj.getSrc?.() || (imgObj as unknown as { _element?: HTMLImageElement })._element?.src;
          return src && (src === imageUrl || src.includes(imageUrl.split('?')[0]) || imageUrl.includes(src.split('?')[0]));
        }
        return false;
      });

      if (target) {
        canvas.setActiveObject(target);
        const objCenter = target.getCenterPoint();
        const currentZoom = canvas.getZoom();
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] = container.clientWidth / 2 - objCenter.x * currentZoom;
          vpt[5] = container.clientHeight / 2 - objCenter.y * currentZoom;
          canvas.setViewportTransform(vpt);
        }
        canvas.requestRenderAll();
        return true;
      }
      return false;
    }, []);

    // Get canvas state
    const getCanvasState = useCallback((): CanvasState | null => {
      if (!fabricRef.current) return null;
      return { objects: fabricRef.current.getObjects(), backgroundColor: fabricRef.current.backgroundColor };
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getCanvas: () => fabricRef.current,
      getSynchronizer: () => synchronizerRef.current,
      getPersistenceManager: () => persistenceManagerRef.current,
      exportPNG,
      selectLayer,
      selectAndCenterLayer,
      selectAndCenterLayerByImageUrl,
      deleteSelected,
      undo,
      redo,
      getCanvasState,
      setZoom: handleZoom,
      getZoom: () => zoom,
      resetView,
    }), [exportPNG, selectLayer, selectAndCenterLayer, selectAndCenterLayerByImageUrl, deleteSelected, undo, redo, getCanvasState, handleZoom, zoom, resetView]);

    return (
      <div
        ref={containerRef}
        className="canvas-container relative w-full h-full overflow-hidden"
        onContextMenu={handleContextMenu}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <canvas ref={canvasRef} />

        {selectionInfo && (
          <>
            <SelectionInfo {...selectionInfo} />
            <QuickEditHint x={selectionInfo.x} y={selectionInfo.y} height={selectionInfo.height * zoom} />
          </>
        )}

        {textToolbarInfo && (
          <TextToolbar x={textToolbarInfo.x} y={textToolbarInfo.y} properties={textToolbarInfo.properties} onPropertyChange={handleTextPropertyChange} />
        )}

        {imageToolbarInfo && (
          <ImageToolbar
            x={imageToolbarInfo.x}
            y={imageToolbarInfo.y}
            imageWidth={imageToolbarInfo.imageWidth}
            imageHeight={imageToolbarInfo.imageHeight}
            positionBelow={imageToolbarInfo.positionBelow}
            isLocked={imageToolbarInfo.isLocked}
            loadingStates={imageToolbarLoading}
            onDownload={handleImageDownload}
            onCopy={handleImageCopy}
            onDelete={handleImageDelete}
            onRemoveBackground={handleImageRemoveBackground}
            onUpscale={handleImageUpscale}
            onErase={handleImageErase}
            onExpand={handleImageExpand}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
            onToggleLock={handleImageToggleLock}
          />
        )}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} onCopy={handleCopy} onPaste={handlePaste}
            onDelete={deleteSelected} onBringForward={handleBringForward} onSendBackward={handleSendBackward}
            onBringToFront={handleBringToFront} onSendToBack={handleSendToBack} canPaste={clipboardRef.current !== null}
          />
        )}

        <div className="canvas-controls absolute bottom-4 left-1/2 -translate-x-1/2">
          <button onClick={() => handleZoom(zoom - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} title={t('canvas.zoom_out')}><Minus size={14} /></button>
          <button onClick={() => handleZoom(1)} className="min-w-[44px] text-xs font-medium text-gray-300" title={t('canvas.reset_zoom')}>{Math.round(zoom * 100)}%</button>
          <button onClick={() => handleZoom(zoom + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} title={t('canvas.zoom_in')}><Plus size={14} /></button>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <button onClick={resetView} title={t('canvas.fit_view')}><Maximize2 size={14} /></button>
        </div>

        {spacePressed && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-300"
               style={{ background: 'rgba(15, 10, 31, 0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <MousePointer2 size={14} />
            <span>{t('canvas.drag_to_pan')}</span>
          </div>
        )}
      </div>
    );
  }
);

CanvasStage.displayName = 'CanvasStage';

export default CanvasStage;

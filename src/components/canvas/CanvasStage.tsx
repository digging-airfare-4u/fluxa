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
import { toast } from 'sonner';
import { ContextMenu } from './ContextMenu';
import { SelectionInfo } from './SelectionInfo';
import { TextToolbar, type TextProperties } from './TextToolbar';
import { ImageToolbar } from './ImageToolbar';
import type { ImageToolbarLoadingStates } from './ImageToolbar.types';
import { Minus, Plus, Maximize2, MousePointer2 } from 'lucide-react';
import { CanvasSynchronizer, createCanvasSynchronizer } from '@/lib/canvas/canvasSynchronizer';
import { useLayerStore } from '@/lib/store/useLayerStore';
import { OpsPersistenceManager, createOpsPersistenceManager } from '@/lib/canvas/opsPersistenceManager';
import { findFreePosition, getViewportBounds, type BoundingBox } from '@/lib/canvas/placementUtils';
import { usePlaceholderManager } from '@/hooks/usePlaceholderManager';
import { useT } from '@/lib/i18n/hooks';
import { runImageTool, GenerationApiError } from '@/lib/api/generate';
import { uploadDroppedAsset } from '@/lib/api/assets-upload';
import { subscribeToJob, fetchJob, type Job } from '@/lib/realtime/subscribeJobs';
import { pendingGenerationTracker } from '@/lib/realtime/pendingGenerationTracker';
import { getProxyImageUrl } from '@/lib/utils/image-url';
import type { Op, AddImageOp } from '@/lib/canvas/ops.types';
import type { ToolType, LayerInfo, CanvasState, LayerModifiedEvent } from './types';

// Re-export types for backward compatibility
export type { ToolType, LayerInfo, CanvasState, LayerModifiedEvent };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const WHEEL_ZOOM_SENSITIVITY = 0.0038;
const ZOOM_STEP = 0.5;
const PAN_SENSITIVITY = 1;
const IMAGE_TOOLBAR_GAP = 20;
const IMAGE_TOOLBAR_EDGE_MARGIN = 12;
const IMAGE_CONTROL_HIT_SIZE = 28;
const DROP_FILE_CONCURRENCY = Number(process.env.NEXT_PUBLIC_DROP_FILE_CONCURRENCY || 3);
const DROP_FILE_OFFSET = 28;
const DROP_PLACEHOLDER_WIDTH = 220;
const DROP_PLACEHOLDER_HEIGHT = 220;
const DROP_COMPRESS_MAX_BYTES = Number(process.env.NEXT_PUBLIC_DROP_COMPRESS_MAX_BYTES || 10 * 1024 * 1024);
const DROP_COMPRESS_MAX_DIMENSION = Number(process.env.NEXT_PUBLIC_DROP_COMPRESS_MAX_DIMENSION || 4096);
const DROP_COMPRESS_QUALITY = Number(process.env.NEXT_PUBLIC_DROP_COMPRESS_QUALITY || 0.82);
const DROP_COMPRESS_TARGET_MIME = process.env.NEXT_PUBLIC_DROP_COMPRESS_TARGET_MIME || 'image/webp';

// Custom cursor SVG for select tool
const SELECT_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M4 4L10.5 20L13 13L20 10.5L4 4Z" fill="black" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;
const SELECT_CURSOR_URL = `url('data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa(SELECT_CURSOR_SVG) : ''}') 4 4, default`;

export interface CanvasStageProps {
  projectId: string;
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
  focusPlaceholder(id: string): void;
  addPlaceholder(id: string, x: number, y: number, width: number, height: number): void;
  removePlaceholder(id: string): void;
  getPlaceholderPosition(id: string): { x: number; y: number } | null;
  deleteSelected(): void;
  undo(): void;
  redo(): void;
  getCanvasState(): CanvasState | null;
  setZoom(zoom: number): void;
  getZoom(): number;
  resetView(): void;
  /** Fit all content in view with smooth animation */
  fitAllContent(): void;
  /** Find a free position for placing an object without overlapping existing objects */
  getFreePosition(width: number, height: number): { x: number; y: number };
}

interface SelectionInfoState {
  type: string;
  label?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  attachedToImageBorder?: boolean;
  attachedWidth?: number;
  editable?: boolean;
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
      projectId,
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
    const placeholderCanvasRef = useRef<{ getCanvas: () => fabric.Canvas | null } | null>({
      getCanvas: () => fabricRef.current,
    });
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
    const selectionInfoRef = useRef<HTMLDivElement | null>(null);
    const textToolbarRef = useRef<HTMLDivElement | null>(null);
    const imageToolbarRef = useRef<HTMLDivElement | null>(null);
    const selectionUpdateRafRef = useRef<number | null>(null);
    const selectionUpdateCountRef = useRef(0);
    const movingEventCountRef = useRef(0);
    const movingLogTimeRef = useRef(0);
    const lastMoveUpdateRef = useRef(0);
    const isDraggingImageRef = useRef(false);
    const moveUpdateThrottleMs = 100;

    // Context menu state
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const clipboardRef = useRef<fabric.FabricObject | null>(null);
    const activeDropPlaceholdersRef = useRef<Set<string>>(new Set());

    const { addPlaceholder, removePlaceholder, getPlaceholderPosition } = usePlaceholderManager({
      canvasRef: placeholderCanvasRef,
    });


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
    const renameLayer = useLayerStore((state) => state.renameLayer);
    const persistName = useLayerStore((state) => state.persistName);

    const getImageLayerName = useCallback((canvasObjectId?: string) => {
      if (!canvasObjectId) return undefined;
      const layer = useLayerStore.getState().getLayerByCanvasObjectId(canvasObjectId);
      return layer?.type === 'image' ? layer.name : undefined;
    }, []);

    const handleImageDescriptionChange = useCallback(async (value: string) => {
      const imageObj = selectedImageRef.current as (fabric.FabricImage & { id?: string; name?: string }) | null;
      const canvasObjectId = imageObj?.id;
      if (!canvasObjectId) return;

      const layer = useLayerStore.getState().getLayerByCanvasObjectId(canvasObjectId);
      const nextName = value.trim();

      if (!layer || !nextName || nextName === layer.name) {
        return;
      }

      renameLayer(layer.id, nextName);
      imageObj.name = nextName;
      setSelectionInfo((prev) => (
        prev && prev.type === 'image'
          ? { ...prev, label: nextName, editable: true }
          : prev
      ));

      try {
        await persistName(layer.id, nextName);
      } catch (error) {
        console.error('[CanvasStage] Failed to persist image description:', error);
      }
    }, [persistName, renameLayer]);

    const cancelPendingSelectionUpdate = useCallback(() => {
      if (selectionUpdateRafRef.current !== null) {
        cancelAnimationFrame(selectionUpdateRafRef.current);
        selectionUpdateRafRef.current = null;
      }
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

    const applyImageSelectionAppearance = useCallback((imageObj: fabric.FabricImage) => {
      const alreadyApplied =
        imageObj.hasBorders === true &&
        imageObj.hasControls === true &&
        imageObj.borderColor === '#3B82F6' &&
        imageObj.borderScaleFactor === 1.25 &&
        imageObj.cornerSize === IMAGE_CONTROL_HIT_SIZE &&
        imageObj.moveCursor === SELECT_CURSOR_URL &&
        imageObj.hoverCursor === SELECT_CURSOR_URL;

      if (!alreadyApplied) {
        imageObj.set({
          hasBorders: true,
          hasControls: true,
          borderColor: '#3B82F6',
          borderScaleFactor: 1.25,
          cornerStyle: 'rect',
          cornerColor: 'rgba(0, 0, 0, 0)',
          cornerStrokeColor: 'rgba(0, 0, 0, 0)',
          transparentCorners: false,
          cornerSize: IMAGE_CONTROL_HIT_SIZE,
          moveCursor: SELECT_CURSOR_URL,
          hoverCursor: SELECT_CURSOR_URL,
        });
      }

      const imageWithControls = imageObj as fabric.FabricImage & {
        setControlsVisibility?: (options: Record<string, boolean>) => void;
      };
      imageWithControls.setControlsVisibility?.({ mtr: false });
      if (!alreadyApplied) {
        fabricRef.current?.requestRenderAll();
      }
    }, []);

    // Update selection info
    const updateSelectionInfo = useCallback((
      obj: fabric.FabricObject,
      options?: { positionOnly?: boolean }
    ) => {
      if (!containerRef.current || !fabricRef.current) return;

      cancelPendingSelectionUpdate();

      selectionUpdateRafRef.current = requestAnimationFrame(() => {
        selectionUpdateRafRef.current = null;
        selectionUpdateCountRef.current += 1;
        const canvas = fabricRef.current;
        if (!canvas) return;

        const boundingRect = obj.getBoundingRect();
        const vpt = canvas.viewportTransform;

        if (!vpt) return;

        const screenY = boundingRect.top * vpt[3] + vpt[5];
        const centerX = (boundingRect.left + boundingRect.width / 2) * vpt[0] + vpt[4];
        const isImage = obj.type === 'image';

        if (selectionInfoRef.current) {
          selectionInfoRef.current.style.left = `${centerX}px`;
          selectionInfoRef.current.style.top = isImage
            ? `${screenY}px`
            : `${screenY - 36}px`;
        }

        if (textToolbarRef.current) {
          textToolbarRef.current.style.left = `${centerX}px`;
          textToolbarRef.current.style.top = `${screenY - 52}px`;
        }

        if (imageToolbarRef.current) {
          const toolbarHeight = 44;
          const positionBelow = screenY < toolbarHeight + IMAGE_TOOLBAR_EDGE_MARGIN;
          const topY = positionBelow ? screenY + IMAGE_TOOLBAR_GAP : screenY - IMAGE_TOOLBAR_GAP;
          imageToolbarRef.current.style.left = `${centerX}px`;
          imageToolbarRef.current.style.top = `${topY}px`;
          imageToolbarRef.current.style.transform = positionBelow
            ? 'translateX(-50%)'
            : 'translateX(-50%) translateY(-100%)';
        }

        if (options?.positionOnly && obj.type === 'image') {
          const imageObj = obj as fabric.FabricImage;
          applyImageSelectionAppearance(imageObj);
          const scaledWidth = boundingRect.width * vpt[0];
          const scaledHeight = boundingRect.height * vpt[3];
          const toolbarHeight = 44;
          const positionBelow = screenY < toolbarHeight + IMAGE_TOOLBAR_EDGE_MARGIN;
          const isLocked = !imageObj.selectable || !imageObj.evented;

          selectedImageRef.current = imageObj;
          setImageToolbarInfo(prev => prev ? {
            ...prev,
            x: centerX,
            y: screenY,
            imageWidth: scaledWidth,
            imageHeight: scaledHeight,
            positionBelow,
            isLocked,
          } : prev);

          setSelectionInfo({
            type: obj.type || 'object',
            label: getImageLayerName((obj as fabric.FabricObject & { id?: string }).id),
            width: boundingRect.width,
            height: boundingRect.height,
            x: centerX,
            y: screenY,
            attachedToImageBorder: true,
            attachedWidth: Math.max(110, scaledWidth),
            editable: true,
          });
        }


        if (options?.positionOnly) {
          return;
        }

        setSelectionInfo({
          type: obj.type || 'object',
          label: isImage ? getImageLayerName((obj as fabric.FabricObject & { id?: string }).id) : undefined,
          width: boundingRect.width,
          height: boundingRect.height,
          x: centerX,
          y: screenY,
          attachedToImageBorder: isImage,
          attachedWidth: isImage ? Math.max(110, boundingRect.width * vpt[0]) : undefined,
          editable: isImage,
        });

        // Check if selected object is a text type
        if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
          const textObj = obj as fabric.IText;
          selectedTextRef.current = textObj;
          if (!textToolbarRef.current) {
            setTextToolbarInfo({
              x: centerX,
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
          } else {
            setTextToolbarInfo(prev => prev ? {
              ...prev,
              x: centerX,
              y: screenY,
            } : prev);
          }
          // Clear image toolbar when text is selected
          selectedImageRef.current = null;
          setImageToolbarInfo(null);
        } else if (obj.type === 'activeselection' || obj.type === 'activeSelection') {
          // Multi-select (ActiveSelection): hide both toolbars
          selectedTextRef.current = null;
          setTextToolbarInfo(null);
          selectedImageRef.current = null;
          setImageToolbarInfo(null);
        } else if (obj.type === 'image') {
          // Single image selection
          const imageObj = obj as fabric.FabricImage;
          applyImageSelectionAppearance(imageObj);
          selectedImageRef.current = imageObj;

          // Calculate screen coordinates for toolbar positioning
          const scaledWidth = boundingRect.width * vpt[0];
          const scaledHeight = boundingRect.height * vpt[3];

          // Check if image is near top edge of viewport (need to position toolbar below)
          const toolbarHeight = 44; // Approximate toolbar height
          const positionBelow = screenY < toolbarHeight + IMAGE_TOOLBAR_EDGE_MARGIN;

          // Check if image is locked
          const isLocked = !imageObj.selectable || !imageObj.evented;

          if (!imageToolbarRef.current) {
            setImageToolbarInfo({
              x: centerX,
              y: screenY,
              imageWidth: scaledWidth,
              imageHeight: scaledHeight,
              positionBelow,
              isLocked,
            });
          } else {
            setImageToolbarInfo(prev => prev ? {
              ...prev,
              x: centerX,
              y: screenY,
              imageWidth: scaledWidth,
              imageHeight: scaledHeight,
              positionBelow,
              isLocked,
            } : prev);
          }

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
      });
    }, [applyImageSelectionAppearance, cancelPendingSelectionUpdate, getImageLayerName]);

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





    const executeAddImageOp = useCallback(async (op: Op, overrides?: { x?: number; y?: number; placeholderId?: string }) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const payload = (op as AddImageOp).payload;
      const proxiedSrc = getProxyImageUrl(payload.src);

      const img = await fabric.FabricImage.fromURL(proxiedSrc, { crossOrigin: 'anonymous' });
      let scaleX = 1;
      let scaleY = 1;

      if (payload.scaleX !== undefined || payload.scaleY !== undefined) {
        scaleX = payload.scaleX ?? 1;
        scaleY = payload.scaleY ?? 1;
      } else if (payload.width !== undefined && payload.height !== undefined && img.width && img.height) {
        const scaleToFitWidth = payload.width / img.width;
        const scaleToFitHeight = payload.height / img.height;
        const uniformScale = Math.min(scaleToFitWidth, scaleToFitHeight);
        scaleX = uniformScale;
        scaleY = uniformScale;
      } else if (payload.width !== undefined && img.width) {
        const uniformScale = payload.width / img.width;
        scaleX = uniformScale;
        scaleY = uniformScale;
      } else if (payload.height !== undefined && img.height) {
        const uniformScale = payload.height / img.height;
        scaleX = uniformScale;
        scaleY = uniformScale;
      }

      img.set({
        left: overrides?.x ?? payload.x,
        top: overrides?.y ?? payload.y,
        scaleX,
        scaleY,
        opacity: payload.fadeIn ? 0 : 1,
      });
      applyImageSelectionAppearance(img);

      (img as fabric.FabricObject & { id?: string }).id = payload.id;

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      updateSelectionInfo(img);

      if (overrides?.placeholderId) {
        removePlaceholder(overrides.placeholderId);
      }

      if (payload.fadeIn) {
        img.animate({ opacity: 1 }, {
          duration: 400,
          onChange: () => canvas.requestRenderAll(),
        });
      }
    }, [updateSelectionInfo, removePlaceholder, applyImageSelectionAppearance]);

    const runToolAndPlaceImage = useCallback(async (tool: 'removeBackground' | 'upscale' | 'erase' | 'expand') => {
      const imageObj = selectedImageRef.current;
      if (!imageObj || !fabricRef.current) {
        console.warn('[CanvasStage] No image selected for AI tool');
        return;
      }

      const src = imageObj.getSrc?.() || (imageObj as unknown as { _element?: HTMLImageElement })._element?.src;
      if (!src) {
        console.error('[CanvasStage] No image source found for AI tool');
        return;
      }

      const bounds = imageObj.getBoundingRect();
      const targetX = bounds.left + bounds.width + 16;
      const targetY = bounds.top;
      const originLayerId = (imageObj as fabric.FabricImage & { id?: string }).id;

      const placeholderId = `placeholder-${Date.now()}`;
      addPlaceholder(placeholderId, targetX, targetY, bounds.width, bounds.height);
      pendingGenerationTracker.registerGeneration(targetX, targetY);

      let result;
      try {
        result = await runImageTool({
          projectId,
          documentId,
          tool,
          imageUrl: src,
          targetX,
          targetY,
          source: {
            type: 'canvas_tool',
            originLayerId: originLayerId || undefined,
          },
        });
      } catch (error) {
        console.error('[CanvasStage] Image tool API call failed:', error);
        removePlaceholder(placeholderId);
        pendingGenerationTracker.unregisterGeneration(targetX, targetY);
        throw error;
      }

      if (!result.jobId) {
        console.warn('[CanvasStage] No jobId returned from image tool');
        removePlaceholder(placeholderId);
        pendingGenerationTracker.unregisterGeneration(targetX, targetY);
        return;
      }

      let handled = false;
      let unsubscribeFn: (() => Promise<void>) | null = null;

      const handleJobDone = async (job: Job) => {
        if (handled) return;
        handled = true;

        const output = job.output as { op?: Op } | undefined;
        if (!output?.op) {
          if (unsubscribeFn) await unsubscribeFn();
          removePlaceholder(placeholderId);
          pendingGenerationTracker.unregisterGeneration(targetX, targetY);
          return;
        }

        const op = {
          ...(output.op as AddImageOp),
          payload: {
            ...(output.op as AddImageOp).payload,
            fadeIn: true,
          },
        } as AddImageOp;
        const layerId = op.payload.id;

        if (layerId) {
          pendingGenerationTracker.registerLayerId(layerId);
        }

        const finalPosition = getPlaceholderPosition(placeholderId);
        const finalX = finalPosition?.x ?? targetX;
        const finalY = finalPosition?.y ?? targetY;

        try {
          await executeAddImageOp(op, { x: finalX, y: finalY, placeholderId });
        } finally {
          if (layerId) {
            pendingGenerationTracker.unregisterLayerId(layerId);
          }
          pendingGenerationTracker.unregisterGeneration(targetX, targetY);
          if (unsubscribeFn) {
            await unsubscribeFn();
          }
        }
      };

      const handleJobFailed = async (job: Job) => {
        console.error('[CanvasStage] Image tool job failed:', job.error);
        removePlaceholder(placeholderId);
        pendingGenerationTracker.unregisterGeneration(targetX, targetY);
        if (unsubscribeFn) {
          await unsubscribeFn();
        }
      };

      const { unsubscribe } = subscribeToJob(result.jobId, {
        onDone: handleJobDone,
        onFailed: handleJobFailed,
      });
      unsubscribeFn = unsubscribe;

      const existingJob = await fetchJob(result.jobId);
      if (existingJob?.status === 'done') {
        await handleJobDone(existingJob);
      } else if (existingJob?.status === 'failed') {
        await handleJobFailed(existingJob);
      }
    }, [documentId, projectId, executeAddImageOp, addPlaceholder, removePlaceholder, getPlaceholderPosition]);

    const handleImageRemoveBackground = useCallback(async () => {
      setImageToolbarLoading(prev => ({ ...prev, removeBackground: true }));
      try {
        await runToolAndPlaceImage('removeBackground');
      } catch (error) {
        if (error instanceof GenerationApiError && error.isInsufficientPoints()) {
          const details = error.getInsufficientPointsDetails();
          toast.error(t('image_toolbar.insufficient_points'), {
            description: t('image_toolbar.points_required', { 
              current: details?.current_balance ?? 0, 
              required: details?.required_points ?? 0 
            }),
          });
        } else {
          toast.error(t('image_toolbar.error_processing'));
        }
      } finally {
        setImageToolbarLoading(prev => ({ ...prev, removeBackground: false }));
      }
    }, [runToolAndPlaceImage, t]);

    const handleImageUpscale = useCallback(async () => {
      setImageToolbarLoading(prev => ({ ...prev, upscale: true }));
      try {
        await runToolAndPlaceImage('upscale');
      } catch (error) {
        if (error instanceof GenerationApiError && error.isInsufficientPoints()) {
          const details = error.getInsufficientPointsDetails();
          toast.error(t('image_toolbar.insufficient_points'), {
            description: t('image_toolbar.points_required', { 
              current: details?.current_balance ?? 0, 
              required: details?.required_points ?? 0 
            }),
          });
        } else {
          toast.error(t('image_toolbar.error_processing'));
        }
      } finally {
        setImageToolbarLoading(prev => ({ ...prev, upscale: false }));
      }
    }, [runToolAndPlaceImage, t]);

    const handleImageErase = useCallback(async () => {
      setImageToolbarLoading(prev => ({ ...prev, erase: true }));
      try {
        await runToolAndPlaceImage('erase');
      } catch (error) {
        if (error instanceof GenerationApiError && error.isInsufficientPoints()) {
          const details = error.getInsufficientPointsDetails();
          toast.error(t('image_toolbar.insufficient_points'), {
            description: t('image_toolbar.points_required', { 
              current: details?.current_balance ?? 0, 
              required: details?.required_points ?? 0 
            }),
          });
        } else {
          toast.error(t('image_toolbar.error_processing'));
        }
      } finally {
        setImageToolbarLoading(prev => ({ ...prev, erase: false }));
      }
    }, [runToolAndPlaceImage, t]);

    const handleImageExpand = useCallback(async () => {
      setImageToolbarLoading(prev => ({ ...prev, expand: true }));
      try {
        await runToolAndPlaceImage('expand');
      } catch (error) {
        if (error instanceof GenerationApiError && error.isInsufficientPoints()) {
          const details = error.getInsufficientPointsDetails();
          toast.error(t('image_toolbar.insufficient_points'), {
            description: t('image_toolbar.points_required', { 
              current: details?.current_balance ?? 0, 
              required: details?.required_points ?? 0 
            }),
          });
        } else {
          toast.error(t('image_toolbar.error_processing'));
        }
      } finally {
        setImageToolbarLoading(prev => ({ ...prev, expand: false }));
      }
    }, [runToolAndPlaceImage, t]);

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

    /**
     * Fit all content in view with smooth animation
     * Calculates bounding box of all objects and zooms/pans to show everything
     */
    const fitAllContent = useCallback(() => {
      if (!fabricRef.current || !containerRef.current) return;
      const canvas = fabricRef.current;
      const container = containerRef.current;

      const objects = canvas.getObjects();
      if (objects.length === 0) {
        // No objects, reset to default view
        resetView();
        return;
      }

      const currentVpt = canvas.viewportTransform;
      if (!currentVpt) return;

      // Get bounds directly from object properties (canvas coordinates)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      for (const obj of objects) {
        // Use object's actual position and dimensions
        const left = obj.left ?? 0;
        const top = obj.top ?? 0;
        const width = (obj.width ?? 0) * (obj.scaleX ?? 1);
        const height = (obj.height ?? 0) * (obj.scaleY ?? 1);
        
        const right = left + width;
        const bottom = top + height;
        
        minX = Math.min(minX, left);
        minY = Math.min(minY, top);
        maxX = Math.max(maxX, right);
        maxY = Math.max(maxY, bottom);
      }

      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      const contentCenterX = (minX + maxX) / 2;
      const contentCenterY = (minY + maxY) / 2;

      console.log('[fitAllContent] Objects:', objects.map(obj => ({
        id: (obj as { id?: string }).id,
        left: obj.left,
        top: obj.top,
        width: obj.width,
        height: obj.height,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        actualWidth: (obj.width ?? 0) * (obj.scaleX ?? 1),
        actualHeight: (obj.height ?? 0) * (obj.scaleY ?? 1),
      })));
      console.log('[fitAllContent] Content bounds:', { minX, minY, maxX, maxY, contentWidth, contentHeight, contentCenterX, contentCenterY });
      console.log('[fitAllContent] Container size:', { width: container.clientWidth, height: container.clientHeight });
      console.log('[fitAllContent] Current viewport:', { zoom: canvas.getZoom(), vptX: currentVpt[4], vptY: currentVpt[5] });

      // Calculate target zoom to fit content with padding
      const padding = 80;
      const availableWidth = Math.max(container.clientWidth - padding * 2, 1);
      const availableHeight = Math.max(container.clientHeight - padding * 2, 1);
      const scaleX = availableWidth / contentWidth;
      const scaleY = availableHeight / contentHeight;
      const fitZoom = Math.min(scaleX, scaleY);
      
      // Apply a scale factor (0.4) so content takes ~40% of available space, not 100%
      // This gives a comfortable viewing distance with breathing room around content
      const FIT_SCALE_FACTOR = 0.4;
      const targetZoom = Math.min(Math.max(fitZoom * FIT_SCALE_FACTOR, MIN_ZOOM), 1);

      console.log('[fitAllContent] Target zoom:', targetZoom, 'fitZoom:', fitZoom, 'after factor:', fitZoom * FIT_SCALE_FACTOR);

      // Calculate target viewport position to center content
      const targetVptX = container.clientWidth / 2 - contentCenterX * targetZoom;
      const targetVptY = container.clientHeight / 2 - contentCenterY * targetZoom;

      console.log('[fitAllContent] Target viewport:', { targetVptX, targetVptY });

      // Get current viewport state for animation
      const startZoom = canvas.getZoom();
      const startVptX = currentVpt[4];
      const startVptY = currentVpt[5];

      // Animate viewport transition
      const duration = 400;
      const startTime = performance.now();

      const animateViewport = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);

        const newZoom = startZoom + (targetZoom - startZoom) * eased;
        const newVptX = startVptX + (targetVptX - startVptX) * eased;
        const newVptY = startVptY + (targetVptY - startVptY) * eased;

        canvas.setZoom(newZoom);
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] = newVptX;
          vpt[5] = newVptY;
          canvas.setViewportTransform(vpt);
        }
        canvas.requestRenderAll();

        if (progress < 1) {
          requestAnimationFrame(animateViewport);
        } else {
          setZoomState(targetZoom);
        }
      };

      requestAnimationFrame(animateViewport);
    }, [resetView]);

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

    const runWithConcurrency = useCallback(async (
      tasks: Array<() => Promise<void>>,
      limit: number,
    ) => {
      if (tasks.length === 0) return;

      const safeLimit = Math.max(1, limit);
      let cursor = 0;

      const worker = async () => {
        while (cursor < tasks.length) {
          const current = cursor;
          cursor += 1;
          await tasks[current]();
        }
      };

      await Promise.all(Array.from({ length: Math.min(safeLimit, tasks.length) }, () => worker()));
    }, []);

    const shouldCompressDroppedImage = useCallback(async (file: File): Promise<boolean> => {
      if (file.size > DROP_COMPRESS_MAX_BYTES) {
        return true;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error ?? new Error('failed to read file'));
        reader.readAsDataURL(file);
      });

      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.width, height: image.height });
        image.onerror = () => reject(new Error('failed to decode image dimensions'));
        image.src = dataUrl;
      });

      const { width, height } = dimensions;
      return Math.max(width, height) > DROP_COMPRESS_MAX_DIMENSION;
    }, []);

    const compressDroppedImage = useCallback(async (file: File): Promise<File> => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error ?? new Error('failed to read file'));
        reader.readAsDataURL(file);
      });

      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('failed to decode image for compression'));
        img.src = dataUrl;
      });

      const maxDimension = Math.max(image.width, image.height);
      const scale = maxDimension > DROP_COMPRESS_MAX_DIMENSION
        ? DROP_COMPRESS_MAX_DIMENSION / maxDimension
        : 1;

      const targetWidth = Math.max(1, Math.round(image.width * scale));
      const targetHeight = Math.max(1, Math.round(image.height * scale));

      const canvasEl = document.createElement('canvas');
      canvasEl.width = targetWidth;
      canvasEl.height = targetHeight;

      const ctx = canvasEl.getContext('2d');
      if (!ctx) {
        throw new Error('failed to create canvas context for compression');
      }

      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvasEl.toBlob((result) => {
          if (!result) {
            reject(new Error('compression to blob failed'));
            return;
          }
          resolve(result);
        }, DROP_COMPRESS_TARGET_MIME, DROP_COMPRESS_QUALITY);
      });

      const nextName = file.name.replace(/\.[^.]+$/, '') + '.webp';
      return new File([blob], nextName, { type: blob.type || DROP_COMPRESS_TARGET_MIME });
    }, []);

    const processDroppedFiles = useCallback(async (
      droppedFiles: File[],
      anchorX: number,
      anchorY: number,
      persistenceManager: OpsPersistenceManager,
    ) => {
      const tasks = droppedFiles.map((file, index) => async () => {
        if (!file.type.startsWith('image/')) {
          toast.error(t('canvas.drop_unsupported_file', { name: file.name }));
          // continue processing dropped files
          return;
        }

        const x = anchorX + index * DROP_FILE_OFFSET;
        const y = anchorY + index * DROP_FILE_OFFSET;
        const placeholderId = `drop-upload-${Date.now()}-${index}`;

        activeDropPlaceholdersRef.current.add(placeholderId);
        addPlaceholder(placeholderId, x, y, DROP_PLACEHOLDER_WIDTH, DROP_PLACEHOLDER_HEIGHT);

        try {
          let uploadFile = file;
          const shouldCompress = await shouldCompressDroppedImage(file);
          if (shouldCompress) {
            uploadFile = await compressDroppedImage(file);
          }

          const uploadResult = await uploadDroppedAsset({
            projectId,
            documentId,
            file: uploadFile,
          });

          const finalPosition = getPlaceholderPosition(placeholderId);
          await persistenceManager.addImage({
            src: uploadResult.url,
            x: finalPosition?.x ?? x,
            y: finalPosition?.y ?? y,
          });
        } catch (error) {
          console.error('[CanvasStage] Failed to process dropped file:', error);
          toast.error(t('canvas.drop_upload_failed', { name: file.name }));
        } finally {
          removePlaceholder(placeholderId);
          activeDropPlaceholdersRef.current.delete(placeholderId);
        }
      });

      await runWithConcurrency(tasks, DROP_FILE_CONCURRENCY);
    }, [addPlaceholder, removePlaceholder, getPlaceholderPosition, runWithConcurrency, shouldCompressDroppedImage, compressDroppedImage, projectId, documentId, t]);

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const canvas = fabricRef.current;
      const container = containerRef.current;
      const persistenceManager = persistenceManagerRef.current;
      if (!canvas || !container || !persistenceManager) return;

      const rect = container.getBoundingClientRect();
      const vpt = canvas.viewportTransform;
      if (!vpt) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const canvasX = (screenX - vpt[4]) / vpt[0];
      const canvasY = (screenY - vpt[5]) / vpt[3];

      const droppedFiles = Array.from(e.dataTransfer.files ?? []);
      if (droppedFiles.length > 0) {
        await processDroppedFiles(droppedFiles, canvasX, canvasY, persistenceManager);
        return;
      }

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
    }, [processDroppedFiles]);

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
        moveCursor: SELECT_CURSOR_URL,
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
      const handleSelectionChangeEvent = () => {
        const active = canvas.getActiveObject();
        if (!active) return;

        isDraggingImageRef.current = false;

        if (active.type === 'activeSelection' || active.type === 'activeselection') {
          // Multi-select on canvas should not collapse back to a single layer.
          onSelectionChange?.(null);
          updateSelectionInfo(active);
          return;
        }

        onSelectionChange?.((active as fabric.FabricObject & { id?: string }).id || null);
        updateSelectionInfo(active);
      };

      canvas.on('selection:created', handleSelectionChangeEvent);
      canvas.on('selection:updated', handleSelectionChangeEvent);

      canvas.on('selection:cleared', () => {
        isDraggingImageRef.current = false;
        onSelectionChange?.(null);
        setSelectionInfo(null);
        setTextToolbarInfo(null);
        setImageToolbarInfo(null);
        selectedTextRef.current = null;
        selectedImageRef.current = null;
      });

      const restoreImageToolbarAfterDrag = (): boolean => {
        if (!isDraggingImageRef.current) return false;
        isDraggingImageRef.current = false;

        const active = canvas.getActiveObject();
        if (active?.type === 'image') {
          updateSelectionInfo(active);
        }
        return true;
      };

      // Object modification events
      canvas.on('object:modified', () => {
        const restoredFromDrag = restoreImageToolbarAfterDrag();
        saveHistory();
        notifyLayersChange();
        const active = canvas.getActiveObject();
        if (active) {
          if (!(restoredFromDrag && active.type === 'image')) {
            updateSelectionInfo(active);
          }
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
        movingEventCountRef.current += 1;
        const now = performance.now();
        if (!movingLogTimeRef.current) movingLogTimeRef.current = now;

        if (now - movingLogTimeRef.current >= 1000) {
          console.log('[CanvasStage] Moving perf:', {
            movingEventsPerSecond: movingEventCountRef.current,
            selectionUpdatesPerSecond: selectionUpdateCountRef.current,
          });
          movingEventCountRef.current = 0;
          selectionUpdateCountRef.current = 0;
          movingLogTimeRef.current = now;
        }

        const active = canvas.getActiveObject();
        if (!active) return;

        if (active.type === 'image') {
          if (!isDraggingImageRef.current) {
            isDraggingImageRef.current = true;
            cancelPendingSelectionUpdate();
            setImageToolbarInfo(null);
            setSelectionInfo(null);
          }
          return;
        }

        if (now - lastMoveUpdateRef.current < moveUpdateThrottleMs) return;
        lastMoveUpdateRef.current = now;

        updateSelectionInfo(active, { positionOnly: true });
      });


      canvas.on('object:scaling', () => {
        const active = canvas.getActiveObject();
        if (active) updateSelectionInfo(active, { positionOnly: true });
      });

      canvas.on('object:rotating', () => {
        const active = canvas.getActiveObject();
        if (active) updateSelectionInfo(active, { positionOnly: true });
      });

      canvas.on('object:added', () => { saveHistory(); notifyLayersChange(); });
      canvas.on('object:removed', () => { saveHistory(); notifyLayersChange(); });
      canvas.on('mouse:up', restoreImageToolbarAfterDrag);

      saveHistory();

      const handleResize = () => {
        if (!container || !canvas) return;
        canvas.setDimensions({ width: container.clientWidth, height: container.clientHeight });
        canvas.requestRenderAll();
      };
      window.addEventListener('resize', handleResize);
      const activeDropPlaceholders = activeDropPlaceholdersRef.current;

      return () => {
        window.removeEventListener('resize', handleResize);
        if (selectionUpdateRafRef.current) {
          cancelAnimationFrame(selectionUpdateRafRef.current);
        }
        for (const placeholderId of activeDropPlaceholders) {
          removePlaceholder(placeholderId);
        }
        activeDropPlaceholders.clear();
        selectionUpdateCountRef.current = 0;
        movingEventCountRef.current = 0;
        movingLogTimeRef.current = 0;
        lastMoveUpdateRef.current = 0;
        isDraggingImageRef.current = false;
        canvas.off('selection:created', handleSelectionChangeEvent);
        canvas.off('selection:updated', handleSelectionChangeEvent);
        canvas.off('mouse:up', restoreImageToolbarAfterDrag);
        synchronizerRef.current?.dispose();
        synchronizerRef.current = null;
        persistenceManagerRef.current = null;
        canvas.dispose();
        fabricRef.current = null;
      };
    }, [cancelPendingSelectionUpdate, documentId, getLayerStoreActions]); // eslint-disable-line react-hooks/exhaustive-deps

    // Subscribe to Layer Store changes
    useEffect(() => {
      const unsubscribe = useLayerStore.subscribe((state, prevState) => {
        if (state.selectedLayerId !== prevState.selectedLayerId && synchronizerRef.current) {
          const activeObject = synchronizerRef.current.getCanvas().getActiveObject();
          if (
            state.selectedLayerId === null &&
            activeObject &&
            (activeObject.type === 'activeSelection' || activeObject.type === 'activeselection')
          ) {
            return;
          }
          synchronizerRef.current.syncSelection(state.selectedLayerId);
        }
        for (const [id, layer] of state.layers) {
          const prevLayer = prevState.layers.get(id);
          if (prevLayer?.visible !== layer.visible) synchronizerRef.current?.syncVisibility(id);
          if (prevLayer?.locked !== layer.locked) synchronizerRef.current?.syncLockState(id);
        }

        const activeObject = synchronizerRef.current?.getCanvas().getActiveObject() as (fabric.FabricObject & { id?: string }) | undefined;
        if (!activeObject?.id || activeObject.type !== 'image') {
          return;
        }

        const currentLayer = Array.from(state.layers.values()).find(
          (layer) => layer.canvasObjectId === activeObject.id
        );
        const previousLayer = Array.from(prevState.layers.values()).find(
          (layer) => layer.canvasObjectId === activeObject.id
        );

        if (currentLayer?.name !== previousLayer?.name) {
          setSelectionInfo((prev) => (
            prev && prev.type === 'image'
              ? { ...prev, label: currentLayer?.name, editable: true }
              : prev
          ));
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
          const zoomScale = Math.exp(-e.deltaY * WHEEL_ZOOM_SENSITIVITY);
          let newZoom = canvas.getZoom() * zoomScale;
          newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
          const rect = container.getBoundingClientRect();
          const point = new fabric.Point(e.clientX - rect.left, e.clientY - rect.top);
          canvas.zoomToPoint(point, newZoom);
          setZoomState(newZoom);
          const active = canvas.getActiveObject();
          if (active) updateSelectionInfo(active, { positionOnly: true });
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
            const active = canvas.getActiveObject();
            if (active) updateSelectionInfo(active, { positionOnly: true });
          }
        }
      };

      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }, [updateSelectionInfo]);

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
          const active = canvas.getActiveObject();
          if (active) updateSelectionInfo(active, { positionOnly: true });
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
    }, [isPanning, spacePressed, activeTool, updateSelectionInfo]);

    // Tool mode handling
    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      canvas.isDrawingMode = false;
      canvas.selection = true;
      canvas.moveCursor = SELECT_CURSOR_URL;

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

        const objBounds = target.getBoundingRect();
        const padding = 80;
        const availableWidth = Math.max(container.clientWidth - padding * 2, 1);
        const availableHeight = Math.max(container.clientHeight - padding * 2, 1);
        const scaleX = availableWidth / objBounds.width;
        const scaleY = availableHeight / objBounds.height;
        const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 4);

        canvas.setZoom(nextZoom);
        setZoomState(nextZoom);

        const objCenter = target.getCenterPoint();
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] = container.clientWidth / 2 - objCenter.x * nextZoom;
          vpt[5] = container.clientHeight / 2 - objCenter.y * nextZoom;
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

        const objBounds = target.getBoundingRect();
        const padding = 80;
        const availableWidth = Math.max(container.clientWidth - padding * 2, 1);
        const availableHeight = Math.max(container.clientHeight - padding * 2, 1);
        const scaleX = availableWidth / objBounds.width;
        const scaleY = availableHeight / objBounds.height;
        const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 4);

        canvas.setZoom(nextZoom);
        setZoomState(nextZoom);

        const objCenter = target.getCenterPoint();
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] = container.clientWidth / 2 - objCenter.x * nextZoom;
          vpt[5] = container.clientHeight / 2 - objCenter.y * nextZoom;
          canvas.setViewportTransform(vpt);
        }
        canvas.requestRenderAll();
        return true;
      }
      return false;
    }, []);

    /**
     * Focus on a placeholder with smooth animated pan and zoom
     * Requirements: Smooth transition when placeholder is created
     */
    const focusPlaceholder = useCallback((id: string) => {
      if (!fabricRef.current || !containerRef.current) return;
      const canvas = fabricRef.current;
      const container = containerRef.current;
      const target = canvas.getObjects().find((obj) => (obj as { placeholderId?: string }).placeholderId === id);
      if (!target) return;

      canvas.setActiveObject(target);
      const objBounds = target.getBoundingRect();

      const padding = 160;
      const availableWidth = Math.max(container.clientWidth - padding * 2, 1);
      const availableHeight = Math.max(container.clientHeight - padding * 2, 1);
      const scaleX = availableWidth / objBounds.width;
      const scaleY = availableHeight / objBounds.height;
      const targetZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 2.2);

      const objCenter = target.getCenterPoint();
      const targetVptX = container.clientWidth / 2 - objCenter.x * targetZoom;
      const targetVptY = container.clientHeight / 2 - objCenter.y * targetZoom;

      // Get current viewport state
      const currentZoom = canvas.getZoom();
      const currentVpt = canvas.viewportTransform;
      if (!currentVpt) return;

      const startVptX = currentVpt[4];
      const startVptY = currentVpt[5];
      const startZoom = currentZoom;

      // Animate viewport transition
      const duration = 400;
      const startTime = performance.now();

      const animateViewport = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);

        const newZoom = startZoom + (targetZoom - startZoom) * eased;
        const newVptX = startVptX + (targetVptX - startVptX) * eased;
        const newVptY = startVptY + (targetVptY - startVptY) * eased;

        canvas.setZoom(newZoom);
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] = newVptX;
          vpt[5] = newVptY;
          canvas.setViewportTransform(vpt);
        }
        canvas.requestRenderAll();

        if (progress < 1) {
          requestAnimationFrame(animateViewport);
        } else {
          setZoomState(targetZoom);
        }
      };

      requestAnimationFrame(animateViewport);
    }, []);

    // Get canvas state
    const getCanvasState = useCallback((): CanvasState | null => {
      if (!fabricRef.current) return null;
      return { objects: fabricRef.current.getObjects(), backgroundColor: fabricRef.current.backgroundColor };
    }, []);

    /**
     * Find a free position for placing an object without overlapping existing objects
     * Requirements: Smart placeholder placement
     */
    const getFreePosition = useCallback((width: number, height: number): { x: number; y: number } => {
      const canvas = fabricRef.current;
      if (!canvas) {
        // Fallback to default position
        return { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
      }

      // Get bounding boxes of all existing objects on canvas
      const existingObjects: BoundingBox[] = canvas.getObjects().map((obj) => {
        const bounds = obj.getBoundingRect();
        return {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
        };
      });

      // Get viewport bounds in canvas coordinates
      const viewportBounds = getViewportBounds(canvas);

      // Find free position
      const position = findFreePosition({
        width,
        height,
        existingObjects,
        viewportBounds,
        gap: 40,
      });

      return position;
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
      focusPlaceholder,
      deleteSelected,
      undo,
      redo,
      getCanvasState,
      setZoom: handleZoom,
      getZoom: () => zoom,
      resetView,
      fitAllContent,
      getFreePosition,
    
      addPlaceholder,
      removePlaceholder,
      getPlaceholderPosition,
    }), [exportPNG, selectLayer, selectAndCenterLayer, selectAndCenterLayerByImageUrl, focusPlaceholder, deleteSelected, undo, redo, getCanvasState, handleZoom, zoom, resetView, fitAllContent, getFreePosition, addPlaceholder, removePlaceholder, getPlaceholderPosition]);

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
            <SelectionInfo
              ref={selectionInfoRef}
              {...selectionInfo}
              onLabelChange={handleImageDescriptionChange}
            />
          </>
        )}

        {textToolbarInfo && (
          <TextToolbar
            ref={textToolbarRef}
            x={textToolbarInfo.x}
            y={textToolbarInfo.y}
            properties={textToolbarInfo.properties}
            onPropertyChange={handleTextPropertyChange}
          />
        )}

        {imageToolbarInfo && (
          <ImageToolbar
            ref={imageToolbarRef}
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

        <div className="canvas-controls absolute bottom-14 left-4">
          <button onClick={() => handleZoom(zoom - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} title={t('canvas.zoom_out')}><Minus size={14} /></button>
          <button onClick={() => handleZoom(1)} className="min-w-[44px] text-xs font-medium text-gray-300" title={t('canvas.reset_zoom')}>{Math.round(zoom * 100)}%</button>
          <button onClick={() => handleZoom(zoom + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} title={t('canvas.zoom_in')}><Plus size={14} /></button>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <button onClick={fitAllContent} title={t('canvas.fit_view')}><Maximize2 size={14} /></button>
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

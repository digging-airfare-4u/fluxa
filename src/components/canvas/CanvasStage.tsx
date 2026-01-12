'use client';

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
import { Minus, Plus, Maximize2, MousePointer2 } from 'lucide-react';

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

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_SENSITIVITY = 0.001;

const CanvasStage = forwardRef<CanvasStageRef, CanvasStageProps>(
  (
    {
      documentId,
      width = 1080,
      height = 1350,
      activeTool = 'select',
      onSelectionChange,
      onLayersChange,
      onLayerModified,
      onToolReset,
    },
    ref
  ) => {
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

    // Selection state for info display
    const [selectionInfo, setSelectionInfo] = useState<{
      type: string;
      width: number;
      height: number;
      x: number;
      y: number;
    } | null>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
      x: number;
      y: number;
    } | null>(null);

    // Clipboard for copy/paste
    const clipboardRef = useRef<fabric.FabricObject | null>(null);

    // History for undo/redo
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);
    const isUndoRedoRef = useRef(false);

    // Save state to history
    const saveHistory = useCallback(() => {
      if (isUndoRedoRef.current || !fabricRef.current) return;

      const json = JSON.stringify(fabricRef.current.toJSON());
      
      // Remove any redo states
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(json);
      historyIndexRef.current = historyRef.current.length - 1;

      // Limit history size
      if (historyRef.current.length > 50) {
        historyRef.current.shift();
        historyIndexRef.current--;
      }
    }, []);

    // Extract layers from canvas
    const extractLayers = useCallback((): LayerInfo[] => {
      if (!fabricRef.current) return [];

      const objects = fabricRef.current.getObjects();
      return objects.map((obj) => {
        const id = (obj as fabric.FabricObject & { id?: string }).id || '';
        const name = (obj as fabric.FabricObject & { name?: string }).name || obj.type || 'Unknown';
        const layerType = (obj as fabric.FabricObject & { layerType?: string }).layerType;

        let type: LayerInfo['type'] = 'rect';
        if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
          type = 'text';
        } else if (obj.type === 'image') {
          type = 'image';
        } else if (layerType === 'background') {
          type = 'background';
        }

        return {
          id,
          type,
          name,
          visible: obj.visible !== false,
          locked: obj.selectable === false,
        };
      });
    }, []);

    // Notify layers change
    const notifyLayersChange = useCallback(() => {
      if (onLayersChange) {
        onLayersChange(extractLayers());
      }
    }, [onLayersChange, extractLayers]);

    // Update selection info for display
    const updateSelectionInfo = useCallback((obj: fabric.FabricObject) => {
      if (!containerRef.current || !fabricRef.current) return;

      const canvas = fabricRef.current;
      const boundingRect = obj.getBoundingRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const vpt = canvas.viewportTransform;
      
      if (!vpt) return;

      // Transform canvas coordinates to screen coordinates
      const screenX = boundingRect.left * vpt[0] + vpt[4];
      const screenY = boundingRect.top * vpt[3] + vpt[5];

      setSelectionInfo({
        type: obj.type || 'object',
        width: boundingRect.width,
        height: boundingRect.height,
        x: screenX + boundingRect.width * vpt[0] / 2,
        y: screenY,
      });
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

    const handlePaste = useCallback(() => {
      if (!fabricRef.current || !clipboardRef.current) return;
      
      clipboardRef.current.clone().then((cloned: fabric.FabricObject) => {
        cloned.set({
          left: (cloned.left || 0) + 20,
          top: (cloned.top || 0) + 20,
        });
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

    // Reset view to center (for infinite canvas, just center at origin)
    const resetView = useCallback(() => {
      if (!fabricRef.current || !containerRef.current) return;
      
      const canvas = fabricRef.current;
      const container = containerRef.current;
      
      // Reset to 100% zoom and center at origin
      canvas.setZoom(1);
      setZoomState(1);
      
      const vpt = canvas.viewportTransform;
      if (vpt) {
        vpt[4] = container.clientWidth / 2;
        vpt[5] = container.clientHeight / 2;
        canvas.setViewportTransform(vpt);
      }
    }, []);

    // Initialize Fabric canvas - Infinite Canvas Mode
    useEffect(() => {
      if (!canvasRef.current || fabricRef.current) return;

      const container = containerRef.current;
      if (!container) return;

      // Custom cursor SVG for select tool (black arrow like Figma)
      const selectCursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M4 4L10.5 20L13 13L20 10.5L4 4Z" fill="black" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`;
      const selectCursorUrl = `url('data:image/svg+xml;base64,${btoa(selectCursorSvg)}') 4 4, default`;

      const canvas = new fabric.Canvas(canvasRef.current, {
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundColor: 'transparent',
        selection: true,
        preserveObjectStacking: true,
        renderOnAddRemove: true,
        defaultCursor: selectCursorUrl,
        hoverCursor: selectCursorUrl,
        moveCursor: 'move',
      });

      fabricRef.current = canvas;

      // Infinite canvas - no artboard, just set initial zoom
      // Center view initially
      setTimeout(() => {
        // Set initial zoom and center at origin
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
          if (onSelectionChange) {
            const id = (selected as fabric.FabricObject & { id?: string }).id;
            onSelectionChange(id || null);
          }
          updateSelectionInfo(selected);
        }
      });

      canvas.on('selection:updated', (e) => {
        const selected = e.selected?.[0];
        if (selected) {
          if (onSelectionChange) {
            const id = (selected as fabric.FabricObject & { id?: string }).id;
            onSelectionChange(id || null);
          }
          updateSelectionInfo(selected);
        }
      });

      canvas.on('selection:cleared', () => {
        if (onSelectionChange) {
          onSelectionChange(null);
        }
        setSelectionInfo(null);
      });

      // Object modification events
      canvas.on('object:modified', (e) => {
        saveHistory();
        notifyLayersChange();
        const active = canvas.getActiveObject();
        if (active) {
          updateSelectionInfo(active);
          
          // Notify about layer modification for persistence
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
        if (active) {
          updateSelectionInfo(active);
        }
      });

      canvas.on('object:scaling', () => {
        const active = canvas.getActiveObject();
        if (active) {
          updateSelectionInfo(active);
        }
      });

      canvas.on('object:added', () => {
        saveHistory();
        notifyLayersChange();
      });

      canvas.on('object:removed', () => {
        saveHistory();
        notifyLayersChange();
      });

      // Save initial state
      saveHistory();

      // Handle resize
      const handleResize = () => {
        if (!container || !canvas) return;
        canvas.setDimensions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
        canvas.requestRenderAll();
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        canvas.dispose();
        fabricRef.current = null;
      };
    }, [documentId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Handle zoom with mouse wheel - Infinite canvas style
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleWheel = (e: WheelEvent) => {
        if (!fabricRef.current) return;
        e.preventDefault();

        const canvas = fabricRef.current;
        const delta = -e.deltaY;
        let newZoom = canvas.getZoom() * (1 + delta * ZOOM_SENSITIVITY);
        
        newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

        // Zoom to mouse position
        const rect = container.getBoundingClientRect();
        const point = new fabric.Point(e.clientX - rect.left, e.clientY - rect.top);
        canvas.zoomToPoint(point, newZoom);
        setZoomState(newZoom);
      };

      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }, []);

    // Space key for panning mode
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !spacePressed) {
          setSpacePressed(true);
          if (containerRef.current) {
            containerRef.current.style.cursor = 'grab';
          }
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          setSpacePressed(false);
          setIsPanning(false);
          if (containerRef.current) {
            containerRef.current.style.cursor = 'default';
          }
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
          if (containerRef.current) {
            containerRef.current.style.cursor = 'grabbing';
          }
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
        if (!isPanning) return; // Only handle if we were panning
        setIsPanning(false);
        // Only restore selection for select/boxSelect tools
        if (activeTool === 'select' || activeTool === 'boxSelect') {
          canvas.selection = true;
        }
        lastPosRef.current = null;
        if (containerRef.current) {
          containerRef.current.style.cursor = spacePressed ? 'grab' : 'default';
        }
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

    // Generate unique layer ID
    const generateLayerId = useCallback(() => {
      return `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }, []);

    // Tool mode handling
    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      // Reset drawing mode
      canvas.isDrawingMode = false;
      canvas.selection = true;

      // Set cursor based on tool
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
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = '#000000';
        canvas.freeDrawingBrush.width = 2;
      } else if (activeTool === 'boxSelect') {
        canvas.defaultCursor = 'crosshair';
        canvas.hoverCursor = 'crosshair';
        canvas.selection = true;
      } else {
        // Select tool - restore default cursor
        const selectCursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M4 4L10.5 20L13 13L20 10.5L4 4Z" fill="black" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>`;
        const selectCursorUrl = `url('data:image/svg+xml;base64,${btoa(selectCursorSvg)}') 4 4, default`;
        canvas.defaultCursor = selectCursorUrl;
        canvas.hoverCursor = selectCursorUrl;
      }

      canvas.requestRenderAll();
    }, [activeTool]);

    // Rectangle and Text tool drawing
    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas || !containerRef.current) return;
      if (activeTool !== 'rectangle' && activeTool !== 'text') return;

      const handleMouseDown = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        if (spacePressed) return; // Don't draw while panning
        
        // Use getScenePoint for correct canvas coordinates in infinite canvas
        const pointer = canvas.getScenePoint(opt.e);
        drawStartRef.current = { x: pointer.x, y: pointer.y };
        isDrawingRef.current = true;

        if (activeTool === 'rectangle') {
          const rect = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: '#000000',
            strokeWidth: 2,
            selectable: false,
            evented: false,
          });
          canvas.add(rect);
          currentShapeRef.current = rect;
        }
      };

      const handleMouseMove = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        if (!isDrawingRef.current || !drawStartRef.current) return;
        if (activeTool !== 'rectangle') return;

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

        if (activeTool === 'rectangle' && currentShapeRef.current) {
          const rect = currentShapeRef.current as fabric.Rect;
          // Only keep if it has some size
          if ((rect.width ?? 0) > 5 && (rect.height ?? 0) > 5) {
            rect.set({ selectable: true, evented: true });
            (rect as fabric.Rect & { id?: string }).id = generateLayerId();
            canvas.setActiveObject(rect);
          } else {
            canvas.remove(rect);
          }
        } else if (activeTool === 'text') {
          // Add text at click position
          const text = new fabric.IText('双击编辑文字', {
            left: pointer.x,
            top: pointer.y,
            fontSize: 24,
            fontFamily: 'Inter, sans-serif',
            fill: '#000000',
          });
          (text as fabric.IText & { id?: string }).id = generateLayerId();
          canvas.add(text);
          canvas.setActiveObject(text);
          text.enterEditing();
          text.selectAll();
        }

        isDrawingRef.current = false;
        drawStartRef.current = null;
        currentShapeRef.current = null;
        
        // Reset to select tool after drawing
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
    }, [activeTool, spacePressed, generateLayerId, onToolReset]);

    // Pencil tool - handle path created
    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      if (activeTool !== 'pencil') return;

      const handlePathCreated = (opt: { path: fabric.Path }) => {
        const path = opt.path;
        (path as fabric.Path & { id?: string }).id = generateLayerId();
      };

      canvas.on('path:created', handlePathCreated);

      return () => {
        canvas.off('path:created', handlePathCreated);
      };
    }, [activeTool, generateLayerId]);

    // Keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!fabricRef.current) return;

        // Delete selected object
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const activeObject = fabricRef.current.getActiveObject();
          if (activeObject && document.activeElement?.tagName !== 'INPUT') {
            fabricRef.current.remove(activeObject);
            fabricRef.current.discardActiveObject();
            fabricRef.current.requestRenderAll();
          }
        }

        // Undo: Ctrl+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        }

        // Redo: Ctrl+Y or Ctrl+Shift+Z
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
          e.preventDefault();
          redo();
        }

        // Reset view: Ctrl+0
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
          e.preventDefault();
          resetView();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [resetView]);

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

    // Export PNG - exports all objects bounding area
    const exportPNG = useCallback(async (multiplier: number): Promise<Blob> => {
      if (!fabricRef.current) {
        throw new Error('Canvas not initialized');
      }

      const objects = fabricRef.current.getObjects();
      if (objects.length === 0) {
        throw new Error('No objects to export');
      }

      // Calculate bounding box of all objects
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      objects.forEach(obj => {
        const rect = obj.getBoundingRect();
        minX = Math.min(minX, rect.left);
        minY = Math.min(minY, rect.top);
        maxX = Math.max(maxX, rect.left + rect.width);
        maxY = Math.max(maxY, rect.top + rect.height);
      });

      // Add some padding
      const padding = 20;
      minX -= padding;
      minY -= padding;
      maxX += padding;
      maxY += padding;

      const dataURL = fabricRef.current.toDataURL({
        format: 'png',
        multiplier,
        quality: 1,
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY,
      });

      const response = await fetch(dataURL);
      return response.blob();
    }, []);

    // Select layer by ID
    const selectLayer = useCallback((layerId: string) => {
      if (!fabricRef.current) return;

      const objects = fabricRef.current.getObjects();
      const target = objects.find(
        (obj) => (obj as fabric.FabricObject & { id?: string }).id === layerId
      );

      if (target) {
        fabricRef.current.setActiveObject(target);
        fabricRef.current.requestRenderAll();
      }
    }, []);

    // Select and center layer by ID
    const selectAndCenterLayer = useCallback((layerId: string) => {
      if (!fabricRef.current || !containerRef.current) return;

      const canvas = fabricRef.current;
      const container = containerRef.current;
      const objects = canvas.getObjects();
      const target = objects.find(
        (obj) => (obj as fabric.FabricObject & { id?: string }).id === layerId
      );

      if (target) {
        // Select the object
        canvas.setActiveObject(target);
        
        // Get object center
        const objCenter = target.getCenterPoint();
        
        // Calculate viewport transform to center the object
        const currentZoom = canvas.getZoom();
        const vpt = canvas.viewportTransform;
        if (vpt) {
          // Calculate new viewport position to center the object
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
      
      // Find image object by matching source URL
      const target = objects.find((obj) => {
        if (obj.type === 'image') {
          const imgObj = obj as fabric.FabricImage;
          const src = imgObj.getSrc?.() || (imgObj as unknown as { _element?: HTMLImageElement })._element?.src;
          // Match by URL (handle both exact match and partial match for signed URLs)
          return src && (src === imageUrl || src.includes(imageUrl.split('?')[0]) || imageUrl.includes(src.split('?')[0]));
        }
        return false;
      });

      if (target) {
        // Select the object
        canvas.setActiveObject(target);
        
        // Get object center
        const objCenter = target.getCenterPoint();
        
        // Calculate viewport transform to center the object
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

    // Delete selected object
    const deleteSelected = useCallback(() => {
      if (!fabricRef.current) return;

      const activeObject = fabricRef.current.getActiveObject();
      if (activeObject) {
        fabricRef.current.remove(activeObject);
        fabricRef.current.discardActiveObject();
        fabricRef.current.requestRenderAll();
      }
    }, []);

    // Get canvas state
    const getCanvasState = useCallback((): CanvasState | null => {
      if (!fabricRef.current) return null;

      return {
        objects: fabricRef.current.getObjects(),
        backgroundColor: fabricRef.current.backgroundColor,
      };
    }, []);

    // Handle zoom
    const handleZoom = useCallback((newZoom: number) => {
      if (!fabricRef.current || !containerRef.current) return;

      const canvas = fabricRef.current;
      const container = containerRef.current;
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      
      // Zoom to center of viewport
      const center = new fabric.Point(container.clientWidth / 2, container.clientHeight / 2);
      canvas.zoomToPoint(center, clampedZoom);
      setZoomState(clampedZoom);
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getCanvas: () => fabricRef.current,
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
      >
        <canvas ref={canvasRef} />

        {/* Selection info display */}
        {selectionInfo && (
          <>
            <SelectionInfo {...selectionInfo} />
            <QuickEditHint x={selectionInfo.x} y={selectionInfo.y} height={selectionInfo.height * zoom} />
          </>
        )}

        {/* Context menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onDelete={deleteSelected}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
            canPaste={clipboardRef.current !== null}
          />
        )}

        {/* Zoom controls - Dark theme */}
        <div className="canvas-controls absolute bottom-4 left-1/2 -translate-x-1/2">
          <button
            onClick={() => handleZoom(zoom - 0.1)}
            disabled={zoom <= MIN_ZOOM}
            title="缩小"
          >
            <Minus size={14} />
          </button>
          
          <button
            onClick={() => handleZoom(1)}
            className="min-w-[44px] text-xs font-medium text-gray-300"
            title="重置缩放"
          >
            {Math.round(zoom * 100)}%
          </button>
          
          <button
            onClick={() => handleZoom(zoom + 0.1)}
            disabled={zoom >= MAX_ZOOM}
            title="放大"
          >
            <Plus size={14} />
          </button>

          <div className="w-px h-4 bg-white/10 mx-0.5" />

          <button
            onClick={resetView}
            title="适应视图 (⌘0)"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        {/* Pan mode indicator - Dark theme */}
        {spacePressed && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-300"
               style={{
                 background: 'rgba(15, 10, 31, 0.9)',
                 backdropFilter: 'blur(12px)',
                 border: '1px solid rgba(255, 255, 255, 0.1)',
               }}>
            <MousePointer2 size={14} />
            <span>拖拽平移</span>
          </div>
        )}
      </div>
    );
  }
);

CanvasStage.displayName = 'CanvasStage';

export default CanvasStage;

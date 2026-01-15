'use client';

/**
 * Editor Layout Component - Main editor page layout (Lovart style)
 * Requirements: 3.5, 3.6, 6.1, 6.4, 6.5, 6.6, 6.7, 7.2, 14.2
 */

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import * as fabric from 'fabric';
import { 
  Menu, ChevronUp,
  Home, FolderOpen, Plus, Trash2, ImageIcon,
  Undo, Redo, Copy, Eye, ZoomIn, ZoomOut
} from 'lucide-react';
import { LeftToolbar, ToolType } from './LeftToolbar';
import CanvasStage, { CanvasStageRef, LayerInfo, LayerModifiedEvent } from '../canvas/CanvasStage';
import { ChatPanel, ChatPanelRef } from '../chat/ChatPanel';
import { PointsBalanceIndicator } from '@/components/points';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { LayerPanel, LayerPanelToggle, LAYER_PANEL_WIDTH } from '@/components/layer';
import { OpsExecutor, createOpsExecutor } from '@/lib/canvas/opsExecutor';
import { saveOp, createUpdateLayerOp } from '@/lib/supabase/queries/ops';
import { useLayerStore, useIsPanelVisible } from '@/lib/store/useLayerStore';
import { useT } from '@/lib/i18n/hooks';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu';
import type { Op } from '@/lib/canvas/ops.types';

export interface EditorLayoutRef {
  executeOps: (ops: Op[]) => Promise<void>;
  addPlaceholder: (id: string, x: number, y: number, width: number, height: number) => void;
  removePlaceholder: (id: string) => void;
  getPlaceholderPosition: (id: string) => { x: number; y: number } | null;
}

interface EditorLayoutProps {
  projectId: string;
  documentId: string;
  conversationId: string;
  projectName: string;
  canvasWidth?: number;
  canvasHeight?: number;
  onProjectNameChange?: (name: string) => void;
  initialPrompt?: string;
}

export const EditorLayout = forwardRef<EditorLayoutRef, EditorLayoutProps>(function EditorLayout({
  projectId,
  documentId,
  conversationId,
  projectName,
  canvasWidth = 1080,
  canvasHeight = 1350,
  onProjectNameChange,
  initialPrompt,
}, ref) {
  const router = useRouter();
  const t = useT('editor');
  const tCommon = useTranslations('common');
  
  // Canvas ref and state
  const canvasRef = useRef<CanvasStageRef>(null);
  const chatPanelRef = useRef<ChatPanelRef>(null);
  const opsExecutorRef = useRef<OpsExecutor | null>(null);
  
  // UI state
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  
  // Project name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(projectName);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generating state (kept for potential future use)
  const [isGenerating, setIsGenerating] = useState(false);

  // Debounce timer for saving layer modifications
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingModificationsRef = useRef<Map<string, LayerModifiedEvent['properties']>>(new Map());

  // Get Layer Store actions for persistence
  // Requirements: 8.3, 8.7
  const { initializeFromOps, setPersistCallback, clearLayers } = useLayerStore();
  
  // Get layer panel visibility state for layout offset
  const isLayerPanelVisible = useIsPanelVisible();

  // Track if initial ops have been loaded
  const initialOpsLoadedRef = useRef(false);

  useEffect(() => {
    setEditedName(projectName);
  }, [projectName]);

  // Set up persistence callback for Layer Store
  // Requirements: 8.1, 8.2, 9.1
  useEffect(() => {
    const persistCallback = async (op: Op) => {
      await saveOp({ documentId, op });
    };
    setPersistCallback(persistCallback);

    return () => {
      setPersistCallback(null);
    };
  }, [documentId, setPersistCallback]);

  // Clear layers when document changes
  useEffect(() => {
    clearLayers();
    initialOpsLoadedRef.current = false;
  }, [documentId, clearLayers]);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  // Handle layer modification with debounce
  const handleLayerModified = useCallback((event: LayerModifiedEvent) => {
    pendingModificationsRef.current.set(event.layerId, event.properties);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      const modifications = pendingModificationsRef.current;
      pendingModificationsRef.current = new Map();

      // Use OpsPersistenceManager to update and persist
      // Requirements: 8.4
      const persistenceManager = canvasRef.current?.getPersistenceManager();
      
      for (const [layerId, properties] of modifications) {
        try {
          if (persistenceManager) {
            await persistenceManager.updateLayer(layerId, {
              left: properties.left,
              top: properties.top,
              scaleX: properties.scaleX,
              scaleY: properties.scaleY,
              angle: properties.angle,
            });
            console.log('[Editor] Layer modification saved via persistence manager:', layerId);
          } else {
            // Fallback to direct saveOp if persistence manager not available
            const op = createUpdateLayerOp(layerId, {
              left: properties.left,
              top: properties.top,
              scaleX: properties.scaleX,
              scaleY: properties.scaleY,
              angle: properties.angle,
            });
            await saveOp({ documentId, op });
            console.log('[Editor] Layer modification saved (fallback):', layerId);
          }
        } catch (error) {
          console.error('[Editor] Failed to save layer modification:', error);
        }
      }
    }, 500);
  }, [documentId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Initialize OpsExecutor when canvas is ready
  useEffect(() => {
    const checkCanvas = () => {
      const canvas = canvasRef.current?.getCanvas();
      if (canvas && !opsExecutorRef.current) {
        opsExecutorRef.current = createOpsExecutor({
          canvas,
          onOpExecuted: (op, index) => {
            console.log(`[Editor] Op executed: ${op.type} at index ${index}`);
          },
          onError: (error, op) => {
            console.error(`[Editor] Op error:`, error, op);
          },
        });
        return true;
      }
      return false;
    };

    if (checkCanvas()) return;

    const interval = setInterval(() => {
      if (checkCanvas()) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const handleToolChange = useCallback((tool: ToolType) => {
    setActiveTool(tool);
  }, []);

  const handleToolReset = useCallback(() => {
    setActiveTool('select');
  }, []);

  const handleSelectionChange = useCallback((layerId: string | null) => {
    setSelectedLayerId(layerId);
  }, []);

  const handleLayersChange = useCallback((newLayers: LayerInfo[]) => {
    setLayers(newLayers);
  }, []);

  const handleOpsGenerated = useCallback(async (ops: Op[]) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;

    if (!opsExecutorRef.current || opsExecutorRef.current.getCanvas() !== canvas) {
      opsExecutorRef.current = createOpsExecutor({
        canvas,
        onOpExecuted: (op, index) => {
          console.log(`[Editor] Op executed: ${op.type} at index ${index}`);
        },
        onError: (error, op) => {
          console.error(`[Editor] Op error:`, error, op);
        },
      });
    }

    try {
      // Set synchronizer to updating mode to prevent duplicate layer creation
      const synchronizer = canvasRef.current?.getSynchronizer();
      if (synchronizer) {
        synchronizer.setUpdating(true);
      }
      
      await opsExecutorRef.current.execute(ops, documentId);
      
      // Reset synchronizer updating mode
      if (synchronizer) {
        synchronizer.setUpdating(false);
      }
      
      // Initialize layers from ops on first load
      // Requirements: 8.3, 8.7
      if (!initialOpsLoadedRef.current && ops.length > 0) {
        initializeFromOps(ops);
        initialOpsLoadedRef.current = true;
        console.log('[Editor] Layers initialized from ops');
      }
    } catch (error) {
      // Reset synchronizer updating mode on error
      const synchronizer = canvasRef.current?.getSynchronizer();
      if (synchronizer) {
        synchronizer.setUpdating(false);
      }
      console.error('[Editor] Failed to execute ops:', error);
    }
  }, [documentId, initializeFromOps]);

  // Placeholder management for image generation
  const placeholdersRef = useRef<Map<string, fabric.FabricObject>>(new Map());

  const addPlaceholder = useCallback((id: string, x: number, y: number, width: number, height: number) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;

    // Create a placeholder rectangle - selectable and draggable
    const placeholder = new fabric.Rect({
      left: x,
      top: y,
      width,
      height,
      fill: '#E8E8E8',
      rx: 8,
      ry: 8,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      strokeWidth: 0,
    });

    // Store custom id for tracking
    (placeholder as fabric.FabricObject & { placeholderId?: string }).placeholderId = id;

    canvas.add(placeholder);
    placeholdersRef.current.set(id, placeholder);
    canvas.requestRenderAll();

    // Add shimmer animation effect using opacity
    let animating = true;
    const animateShimmer = () => {
      if (!animating || !placeholdersRef.current.has(id)) return;
      
      placeholder.animate({ opacity: 0.5 }, {
        duration: 800,
        easing: fabric.util.ease.easeInOutSine,
        onChange: () => canvas.requestRenderAll(),
        onComplete: () => {
          if (!animating || !placeholdersRef.current.has(id)) return;
          placeholder.animate({ opacity: 1 }, {
            duration: 800,
            easing: fabric.util.ease.easeInOutSine,
            onChange: () => canvas.requestRenderAll(),
            onComplete: animateShimmer,
          });
        },
      });
    };
    animateShimmer();

    // Store cleanup function
    (placeholder as fabric.FabricObject & { stopAnimation?: () => void }).stopAnimation = () => {
      animating = false;
    };
  }, []);

  // Get placeholder's current position (after user may have dragged it)
  const getPlaceholderPosition = useCallback((id: string): { x: number; y: number } | null => {
    const placeholder = placeholdersRef.current.get(id);
    if (!placeholder) return null;
    return {
      x: placeholder.left ?? 0,
      y: placeholder.top ?? 0,
    };
  }, []);

  const removePlaceholder = useCallback((id: string) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;

    const placeholder = placeholdersRef.current.get(id);
    if (placeholder) {
      // Stop animation
      (placeholder as fabric.FabricObject & { stopAnimation?: () => void }).stopAnimation?.();
      canvas.remove(placeholder);
      placeholdersRef.current.delete(id);
      canvas.requestRenderAll();
    }
  }, []);

  useImperativeHandle(ref, () => ({
    executeOps: handleOpsGenerated,
    addPlaceholder,
    removePlaceholder,
    getPlaceholderPosition,
  }), [handleOpsGenerated, addPlaceholder, removePlaceholder, getPlaceholderPosition]);

  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return;

    try {
      const blob = await canvasRef.current.exportPNG(2);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName || 'design'}-export.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[Editor] Export failed:', error);
    }
  }, [projectName]);

  const handleImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl && opsExecutorRef.current) {
          const op: Op = {
            type: 'addImage',
            payload: {
              id: `layer-${Date.now()}`,
              src: dataUrl,
              x: canvasWidth / 4,
              y: canvasHeight / 4,
              width: canvasWidth / 2,
            },
          };
          await opsExecutorRef.current.execute([op], documentId);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [canvasWidth, canvasHeight, documentId]);

  const handleAIClick = useCallback(() => {
    if (isChatCollapsed) {
      setIsChatCollapsed(false);
      setTimeout(() => {
        chatPanelRef.current?.focusInput();
      }, 350);
    } else {
      chatPanelRef.current?.focusInput();
    }
  }, [isChatCollapsed]);

  const handleBack = useCallback(() => {
    router.push('/app');
  }, [router]);

  const handleNameSubmit = useCallback(() => {
    if (editedName.trim()) {
      onProjectNameChange?.(editedName.trim());
    } else {
      setEditedName(projectName);
    }
    setIsEditingName(false);
  }, [editedName, projectName, onProjectNameChange]);

  const handleNameCancel = useCallback(() => {
    setEditedName(projectName);
    setIsEditingName(false);
  }, [projectName]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNameSubmit();
    else if (e.key === 'Escape') handleNameCancel();
  }, [handleNameSubmit, handleNameCancel]);

  // Handle generating state change from ChatPanel
  const handleGeneratingChange = useCallback((generating: boolean) => {
    setIsGenerating(generating);
  }, []);

  // Handle locate image on canvas
  const handleLocateImage = useCallback((layerId: string) => {
    canvasRef.current?.selectAndCenterLayer(layerId);
  }, []);

  // Handle locate image by asset URL (for chat input referenced images)
  const handleLocateImageByUrl = useCallback((imageUrl: string) => {
    const found = canvasRef.current?.selectAndCenterLayerByImageUrl(imageUrl);
    if (!found) {
      console.log('[Editor] Image not found on canvas:', imageUrl);
    }
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#FAFAFA] dark:bg-[#0D0915]">
      {/* Layer Panel - collapsible side panel (renders first for z-index) */}
      {/* Requirements: 3.5 */}
      <LayerPanel />

      {/* Floating top bar - logo and project name */}
      <div 
        className="fixed top-4 z-40 flex items-center gap-2 transition-[left] duration-300 ease-in-out"
        style={{ left: isLayerPanelVisible ? LAYER_PANEL_WIDTH + 28 : 16 }}
      >
        {/* Logo with dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              onMouseEnter={() => setIsLogoHovered(true)}
              onMouseLeave={() => setIsLogoHovered(false)}
            >
              {isLogoHovered ? (
                <div className="flex items-center gap-0.5">
                  <Menu className="size-5 text-[#666] dark:text-[#888]" />
                  <ChevronUp className="size-4 text-[#666] dark:text-[#888]" />
                </div>
              ) : (
                <img 
                  src="/logo.png" 
                  alt={tCommon('accessibility.logo_alt')} 
                  className="size-8 rounded-lg"
                />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 text-xs">
            <DropdownMenuItem onClick={handleBack} className="text-xs py-1.5">
              <Home className="size-3.5 mr-2" />
              {t('menu.home')}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs py-1.5">
              <FolderOpen className="size-3.5 mr-2" />
              {t('menu.projects')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs py-1.5">
              <Plus className="size-3.5 mr-2" />
              {t('menu.new_project')}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs py-1.5 text-red-500 focus:text-red-500">
              <Trash2 className="size-3.5 mr-2" />
              {t('menu.delete_project')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleImageUpload} className="text-xs py-1.5">
              <ImageIcon className="size-3.5 mr-2" />
              {t('menu.import_image')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-xs py-1.5">
              <Undo className="size-3.5 mr-2" />
              {t('menu.undo')}
              <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="text-xs py-1.5">
              <Redo className="size-3.5 mr-2" />
              {t('menu.redo')}
              <DropdownMenuShortcut>⌘⇧Z</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="text-xs py-1.5">
              <Copy className="size-3.5 mr-2" />
              {t('menu.copy_object')}
              <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs py-1.5">
              <Eye className="size-3.5 mr-2" />
              {t('menu.show_all_images')}
              <DropdownMenuShortcut>⇧1</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs py-1.5">
              <ZoomIn className="size-3.5 mr-2" />
              {t('menu.zoom_in')}
              <DropdownMenuShortcut>⌘+</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs py-1.5">
              <ZoomOut className="size-3.5 mr-2" />
              {t('menu.zoom_out')}
              <DropdownMenuShortcut>⌘-</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Project name - plain text, click to edit */}
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleNameSubmit}
            className="h-8 px-2 text-sm font-medium bg-transparent border-b border-black/20 dark:border-white/20 outline-none text-[#1A1A1A] dark:text-white"
            style={{ width: Math.max(80, editedName.length * 8 + 16) }}
          />
        ) : (
          <span
            onClick={() => setIsEditingName(true)}
            className="text-sm font-medium text-[#1A1A1A] dark:text-white cursor-pointer hover:opacity-70 transition-opacity"
          >
            {projectName}
          </span>
        )}

        {/* Language Switcher */}
        <LanguageSwitcher />
      </div>

      {/* Floating bottom left - layer toggle and points in same row */}
      {/* Requirements: 3.6, 3.7, 3.8 */}
      <div 
        className="fixed bottom-4 z-40 flex items-center gap-2 transition-[left] duration-300 ease-in-out"
        style={{ left: isLayerPanelVisible ? LAYER_PANEL_WIDTH + 28 : 16 }}
      >
        <LayerPanelToggle />
        <PointsBalanceIndicator />
      </div>

      {/* Left Toolbar */}
      <LeftToolbar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        onImageUpload={handleImageUpload}
        onAIClick={handleAIClick}
        style={{ left: isLayerPanelVisible ? LAYER_PANEL_WIDTH + 28 : 16 }}
      />

      {/* Main content area - full width, ChatPanel floats on top */}
      <div className="h-full relative z-0">
        {/* Canvas container */}
        <div className="canvas-container h-full relative">
          <CanvasStage
            ref={canvasRef}
            documentId={documentId}
            width={canvasWidth}
            height={canvasHeight}
            activeTool={activeTool}
            onSelectionChange={handleSelectionChange}
            onLayersChange={handleLayersChange}
            onLayerModified={handleLayerModified}
            onToolReset={handleToolReset}
          />
        </div>
      </div>

      {/* Chat Panel - floating style */}
      <ChatPanel
        ref={chatPanelRef}
        conversationId={conversationId}
        projectId={projectId}
        documentId={documentId}
        onOpsGenerated={handleOpsGenerated}
        onCollapse={setIsChatCollapsed}
        onGeneratingChange={handleGeneratingChange}
        onAddPlaceholder={addPlaceholder}
        onRemovePlaceholder={removePlaceholder}
        onGetPlaceholderPosition={getPlaceholderPosition}
        onLocateImage={handleLocateImage}
        onLocateImageByUrl={handleLocateImageByUrl}
        initialCollapsed={isChatCollapsed}
        initialPrompt={initialPrompt}
      />
    </div>
  );
});

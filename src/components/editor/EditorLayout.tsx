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
import CanvasStage, { CanvasStageRef, LayerInfo } from '../canvas/CanvasStage';
import { ChatPanel, ChatPanelRef } from '../chat/ChatPanel';
import { PointsBalanceIndicator } from '@/components/points';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { LayerPanel, LayerPanelToggle, LAYER_PANEL_WIDTH } from '@/components/layer';
import { saveOp } from '@/lib/supabase/queries/ops';
import { useLayerStore, useIsPanelVisible } from '@/lib/store/useLayerStore';
import { useOpsExecution, usePlaceholderManager, useLayerModification } from '@/hooks';
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

  // Use extracted hooks
  const { executeOps } = useOpsExecution({
    documentId,
    canvasRef,
  });

  const { addPlaceholder, removePlaceholder, getPlaceholderPosition } = usePlaceholderManager({
    canvasRef,
  });

  const { handleLayerModified } = useLayerModification({
    documentId,
    canvasRef,
  });

  // Get Layer Store actions for persistence
  const { setPersistCallback, clearLayers } = useLayerStore();
  
  // Get layer panel visibility state for layout offset
  const isLayerPanelVisible = useIsPanelVisible();

  useEffect(() => {
    setEditedName(projectName);
  }, [projectName]);

  // Set up persistence callback for Layer Store
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
  }, [documentId, clearLayers]);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    executeOps,
    addPlaceholder,
    removePlaceholder,
    getPlaceholderPosition,
  }), [executeOps, addPlaceholder, removePlaceholder, getPlaceholderPosition]);

  const handleAddPlaceholder = useCallback((id: string, x: number, y: number, width: number, height: number) => {
    addPlaceholder(id, x, y, width, height);
    canvasRef.current?.focusPlaceholder(id);
  }, [addPlaceholder]);

  /**
   * Get a free position for placing an object without overlapping existing objects
   * Delegates to CanvasStage's getFreePosition for collision detection
   */
  const handleGetFreePosition = useCallback((width: number, height: number): { x: number; y: number } => {
    return canvasRef.current?.getFreePosition(width, height) ?? { x: 100, y: 100 };
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
    await executeOps(ops);

    // After executing, center on the first addImage op if present
    // Skip centering if the image has fadeIn (it was generated from a placeholder that was already focused)
    const firstAddImage = ops.find((op) => op.type === 'addImage') as Op | undefined;
    if (firstAddImage) {
      const payload = (firstAddImage as Op & { payload?: { id?: string; fadeIn?: boolean } }).payload;
      // Only center if not a fadeIn image (those came from placeholders that were already positioned)
      if (payload?.id && !payload?.fadeIn) {
        canvasRef.current?.selectAndCenterLayer(payload.id);
      }
    }
  }, [executeOps]);

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
        if (dataUrl) {
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
          await executeOps([op]);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [canvasWidth, canvasHeight, executeOps]);

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

  // Navigate to projects page
  const handleProjects = useCallback(() => {
    router.push('/app/projects');
  }, [router]);

  // Create new project
  const handleNewProject = useCallback(() => {
    router.push('/app');
  }, [router]);

  // Delete current project (with confirmation)
  const handleDeleteProject = useCallback(async () => {
    if (!confirm(t('menu.delete_confirm'))) return;
    
    try {
      // Import deleteProject dynamically to avoid circular deps
      const { deleteProject } = await import('@/lib/supabase/queries/projects');
      await deleteProject(projectId);
      router.push('/app');
    } catch (error) {
      console.error('[Editor] Failed to delete project:', error);
    }
  }, [projectId, router, t]);

  // Undo action
  const handleUndo = useCallback(() => {
    canvasRef.current?.undo();
  }, []);

  // Redo action
  const handleRedo = useCallback(() => {
    canvasRef.current?.redo();
  }, []);

  // Duplicate selected object
  const handleDuplicate = useCallback(() => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;
    
    activeObject.clone().then((cloned: fabric.FabricObject) => {
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      });
      // Generate new ID
      const newId = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      (cloned as fabric.FabricObject & { id?: string }).id = newId;
      
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
    });
  }, []);

  // Reset view to show all objects
  const handleShowAll = useCallback(() => {
    canvasRef.current?.resetView();
  }, []);

  // Zoom in
  const handleZoomIn = useCallback(() => {
    const currentZoom = canvasRef.current?.getZoom() || 1;
    canvasRef.current?.setZoom(Math.min(currentZoom + 0.25, 5));
  }, []);

  // Zoom out
  const handleZoomOut = useCallback(() => {
    const currentZoom = canvasRef.current?.getZoom() || 1;
    canvasRef.current?.setZoom(Math.max(currentZoom - 0.25, 0.1));
  }, []);

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
            <DropdownMenuItem onClick={handleProjects} className="text-xs py-1.5">
              <FolderOpen className="size-3.5 mr-2" />
              {t('menu.projects')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleNewProject} className="text-xs py-1.5">
              <Plus className="size-3.5 mr-2" />
              {t('menu.new_project')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDeleteProject} className="text-xs py-1.5 text-red-500 focus:text-red-500">
              <Trash2 className="size-3.5 mr-2" />
              {t('menu.delete_project')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleImageUpload} className="text-xs py-1.5">
              <ImageIcon className="size-3.5 mr-2" />
              {t('menu.import_image')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleUndo} className="text-xs py-1.5">
              <Undo className="size-3.5 mr-2" />
              {t('menu.undo')}
              <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleRedo} className="text-xs py-1.5">
              <Redo className="size-3.5 mr-2" />
              {t('menu.redo')}
              <DropdownMenuShortcut>⌘⇧Z</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicate} disabled={!selectedLayerId} className="text-xs py-1.5">
              <Copy className="size-3.5 mr-2" />
              {t('menu.copy_object')}
              <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleShowAll} className="text-xs py-1.5">
              <Eye className="size-3.5 mr-2" />
              {t('menu.show_all_images')}
              <DropdownMenuShortcut>⇧1</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleZoomIn} className="text-xs py-1.5">
              <ZoomIn className="size-3.5 mr-2" />
              {t('menu.zoom_in')}
              <DropdownMenuShortcut>⌘+</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleZoomOut} className="text-xs py-1.5">
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
        onAddPlaceholder={handleAddPlaceholder}
        onRemovePlaceholder={removePlaceholder}
        onGetPlaceholderPosition={getPlaceholderPosition}
        onGetFreePosition={handleGetFreePosition}
        onLocateImage={handleLocateImage}
        onLocateImageByUrl={handleLocateImageByUrl}
        initialCollapsed={isChatCollapsed}
        initialPrompt={initialPrompt}
      />
    </div>
  );
});

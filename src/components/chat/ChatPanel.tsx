/**
 * ChatPanel Component - Right side panel
 * Requirements: 11.1-11.9 - Chat panel with message history, AI responses, and input
 * Requirements: 4.1-4.5 - Three-phase generation feedback with animations
 */

'use client';

import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import Image from 'next/image';
import { ChevronRight, ChevronLeft, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ChatMessage } from './ChatMessage';
import { ChatInput, ChatInputRef } from './ChatInput';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { GeneratingPlaceholder, GeneratingPlaceholderBox } from '@/components/ui/GeneratingPlaceholder';
import { InlineError } from '@/components/ui/InlineError';
import { useChat } from '@/hooks/chat';
import { useGeneration } from '@/hooks/chat';
import {
  useChatStore,
  useIsGenerating,
} from '@/lib/store/useChatStore';
import { useMembershipLevel } from '@/lib/store/usePointsStore';
import { fetchModels } from '@/lib/supabase/queries/models';
import { fetchUserProviderConfigs, type UserProviderConfig } from '@/lib/api/provider-configs';
import { getAgentDefaultBrainModel } from '@/lib/supabase/queries/settings';
import { resolveSelectableModels, isSelectableImageModel } from '@/lib/models/resolve-selectable-models';
import type { Op } from '@/lib/canvas/ops.types';
import { InsufficientPointsDialog } from '@/components/points/InsufficientPointsDialog';
import { InvalidProviderConfigDialog } from '@/components/points/InvalidProviderConfigDialog';
import { ShareDialog } from '@/components/share';
import type { MessageMetadata } from '@/lib/supabase/queries/messages';

export interface ChatPanelRef {
  focusInput: () => void;
}

interface ChatPanelProps {
  conversationId: string;
  projectId: string;
  documentId: string;
  onOpsGenerated?: (ops: Op[]) => void;
  onCollapse?: (collapsed: boolean) => void;
  onGeneratingChange?: (isGenerating: boolean, modelName?: string) => void;
  onAddPlaceholder?: (id: string, x: number, y: number, width: number, height: number) => void;
  onRemovePlaceholder?: (id: string) => void;
  onGetPlaceholderPosition?: (id: string) => { x: number; y: number } | null;
  /** Get a free position for placing an object without overlapping existing objects */
  onGetFreePosition?: (width: number, height: number) => { x: number; y: number };
  /** Callback to open provider config settings */
  onOpenSettings?: () => void;
  onLocateImage?: (layerId: string) => void;
  onLocateImageByUrl?: (imageUrl: string) => void;
  initialCollapsed?: boolean;
  initialPrompt?: string;
}

export const ChatPanel = forwardRef<ChatPanelRef, ChatPanelProps>(function ChatPanel({
  conversationId,
  projectId,
  documentId,
  onOpsGenerated,
  onCollapse,
  onGeneratingChange,
  onAddPlaceholder,
  onRemovePlaceholder,
  onGetPlaceholderPosition,
  onGetFreePosition,
  onOpenSettings,
  onLocateImageByUrl,
  initialCollapsed = false,
  initialPrompt,
}, ref) {
  const t = useTranslations('chat');
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);

  // Use chat hook for message management
  const {
    messages,
    isLoading,
    error: chatError,
    addMessage,
    updateMessage,
    removeMessage,
    replaceMessage,
    createUserMessage,
    deleteMessageById,
    clearPendingMessages,
  } = useChat({ conversationId });

  // Use store for shared state
  const {
    selectedModel,
    selectedAgentModel,
    selectedAgentImageModel,
    chatMode,
    selectedResolution,
    selectedAspectRatio,
    models,
    selectableModels,
    generationPhase,
    error: generationError,
    insufficientPointsError,
    setSelectedModel,
    setSelectedResolution,
    setSelectedAspectRatio,
    setModels,
    setSelectableModels,
    clearError,
    clearInsufficientPointsError,
    userProviderConfigError,
    clearUserProviderConfigError,
    startGeneration,
    failGeneration,
    setChatMode,
    setSelectedAgentModel,
    setSelectedAgentImageModel,
  } = useChatStore();

  const isGenerating = useIsGenerating();
  const membershipLevel = useMembershipLevel();

  // Use generation hook
  const {
    startAgentGeneration,
    startImageGeneration,
    startOpsGeneration,
    stop: stopGeneration,
  } = useGeneration({
    projectId,
    documentId,
    conversationId,
    models,
    selectableModels,
    selectedResolution,
    selectedAspectRatio,
    onOpsGenerated,
    onGeneratingChange,
    onAddPlaceholder,
    onRemovePlaceholder,
    onGetPlaceholderPosition,
    onGetFreePosition,
  });

  // Expose focusInput method via ref
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      chatInputRef.current?.focus();
    },
  }), []);

  // Load models on mount (system + user BYOK)
  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      const [{ data: { session } }, systemModels, configuredAgentDefaultModel] = await Promise.all([
        supabase.auth.getSession(),
        fetchModels(),
        getAgentDefaultBrainModel().catch(() => null),
      ]);

      let userConfigs: UserProviderConfig[] = [];
      if (session?.access_token) {
        userConfigs = await fetchUserProviderConfigs().catch((error) => {
          console.error('[ChatPanel] Failed to load BYOK configs:', error);
          return [];
        });
      }

      if (cancelled) {
        return;
      }

      const resolvedSelectableModels = resolveSelectableModels(systemModels, userConfigs);
      setModels(systemModels);
      setSelectableModels(resolvedSelectableModels);

      if (
        configuredAgentDefaultModel
        && resolvedSelectableModels.some((model) => (
          model.value === configuredAgentDefaultModel && model.type === 'ops'
        ))
      ) {
        setSelectedAgentModel(configuredAgentDefaultModel);
      }
    };

    void loadModels();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.access_token) {
        return;
      }

      void loadModels();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [setModels, setSelectableModels, setSelectedAgentModel]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-send initial prompt if provided
  const initialPromptSentRef = useRef(false);

  const handleToggleCollapse = useCallback(() => {
    if (isAnimating) return;
    
    if (!isCollapsed) {
      setIsAnimating(true);
      setTimeout(() => {
        setIsCollapsed(true);
        setIsAnimating(false);
        onCollapse?.(true);
      }, 200);
    } else {
      setIsCollapsed(false);
      onCollapse?.(false);
    }
  }, [isCollapsed, isAnimating, onCollapse]);

  const handleStopGeneration = useCallback(() => {
    stopGeneration();
    clearPendingMessages();
  }, [stopGeneration, clearPendingMessages]);

  const handleRetry = useCallback(() => {
    clearError();
  }, [clearError]);

  const handleSendMessage = useCallback(async (
    content: string,
    model?: string,
    referencedImage?: { id: string; url: string; filename: string }
  ) => {
    try {
      clearError();
      
      // Create user message
      const userMessage = await createUserMessage(content, referencedImage ? { referencedImage } : undefined);
      const userMessageId = userMessage.id;

      // Start generation phase
      startGeneration();
      
      // Add pending message
      const pendingMessageId = `pending-${Date.now()}`;
      const currentModel = model || (chatMode === 'agent' ? selectedAgentModel : selectedModel);
      const currentModelName =
        selectableModels.find(m => m.value === currentModel)?.displayName
        || models.find(m => m.name === currentModel)?.display_name
        || currentModel;
      
      addMessage({
        id: pendingMessageId,
        conversation_id: conversationId,
        role: 'assistant',
        content: t('status.generating'),
        created_at: new Date().toISOString(),
        metadata: { isPending: true, modelName: currentModelName, mode: chatMode },
      });

      // Notify canvas about generation start
      onGeneratingChange?.(true, currentModelName);
      
      // Cleanup function for failures
      const cleanup = async () => {
        removeMessage(pendingMessageId);
        try {
          await deleteMessageById(userMessageId);
        } catch (e) {
          console.error('[ChatPanel] Failed to delete user message:', e);
        }
      };

      // Determine model type and start appropriate generation from the unified model list.
      const isImageModel = isSelectableImageModel(currentModel, selectableModels);
      
      const ctx = {
        content,
        model: currentModel,
        imageModel: chatMode === 'agent' ? selectedAgentImageModel : undefined,
        referencedImage,
        pendingMessageId,
        userMessageId,
        onMessageCreated: addMessage,
        onPendingUpdated: updateMessage,
        onPendingReplaced: replaceMessage,
        onCleanup: cleanup,
      };

      if (chatMode === 'agent') {
        await startAgentGeneration(ctx);
        return;
      }

      if (isImageModel) {
        await startImageGeneration(ctx);
      } else {
        await startOpsGeneration(ctx);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        clearPendingMessages();
        return;
      }

      failGeneration(err instanceof Error ? err.message : 'Failed to send message');
      onGeneratingChange?.(false);
      clearPendingMessages();
    }
  }, [
    conversationId, selectedModel, selectedAgentModel, selectedAgentImageModel, models, selectableModels, t, chatMode,
    createUserMessage, addMessage, updateMessage, removeMessage, replaceMessage, deleteMessageById, clearPendingMessages,
    startGeneration, startAgentGeneration, startImageGeneration, startOpsGeneration, clearError, failGeneration, onGeneratingChange,
  ]);

  // Auto-send initial prompt if provided (must be after handleSendMessage definition)
  useEffect(() => {
    if (initialPrompt && !initialPromptSentRef.current && !isLoading && models.length > 0) {
      initialPromptSentRef.current = true;
      console.log('[ChatPanel] Auto-sending initial prompt:', initialPrompt);
      setTimeout(() => {
        console.log('[ChatPanel] setTimeout executing, ref value:', initialPromptSentRef.current);
        handleSendMessage(initialPrompt);
        window.history.replaceState({}, '', window.location.pathname);
      }, 500);
    }
  }, [initialPrompt, isLoading, models.length, handleSendMessage]);

  const handleImageClick = useCallback((_imageUrl: string, _layerId?: string) => {
    // Keep chat image click behavior local to chat preview dialog.
    // Do not auto-locate/camera-jump on canvas.
  }, []);

  const handleLocateInputImage = useCallback((imageUrl: string) => {
    if (onLocateImageByUrl) {
      onLocateImageByUrl(imageUrl);
    }
  }, [onLocateImageByUrl]);

  const handleAddToCanvas = useCallback(async (imageUrl: string) => {
    if (onOpsGenerated) {
      const op: Op = {
        type: 'addImage',
        payload: {
          id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          src: imageUrl,
          x: 100 + Math.floor(Math.random() * 200),
          y: 100 + Math.floor(Math.random() * 200),
        },
      };
      onOpsGenerated([op]);
    }
  }, [onOpsGenerated]);

  // Combine errors
  const error = chatError || generationError;

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleToggleCollapse}
            className="fixed right-8 top-7 z-50 text-[#888] hover:text-[#1A1A1A] dark:hover:text-white transition-colors animate-fade-in"
          >
            <ChevronLeft className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">{t('panel.expand')}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div 
      className={`fixed top-4 right-4 bottom-4 w-[420px] max-w-[calc(100vw-2rem)] z-40 flex flex-col rounded-xl overflow-hidden bg-white dark:bg-[#1A1028] shadow-xl border border-black/10 dark:border-white/10 ${isAnimating ? 'animate-slide-out-right pointer-events-none' : 'animate-slide-in-right'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt={t('panel.title')} width={20} height={20} className="size-5" />
          <h2 className="text-sm font-medium text-[#1A1A1A] dark:text-white">{t('panel.title')}</h2>
        </div>
        <div className="flex items-center gap-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                onClick={() => setIsShareOpen(true)}
                aria-label="Share"
              >
                <Share2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>分享</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all" onClick={handleToggleCollapse}>
                <ChevronRight className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('panel.collapse')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <Skeleton variant="image" className="w-12 h-12 rounded-xl" />
              <Skeleton variant="text" className="w-24 h-4" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in-slow">
            <Image src="/logo.png" alt={t('panel.title')} width={64} height={64} className="size-16 rounded-2xl mb-4" />
            <h3 className="font-semibold mb-2">{t('empty_state.title')}</h3>
            <p className="text-sm text-muted-foreground max-w-[240px]">{t('empty_state.description')}</p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const metadata = message.metadata as MessageMetadata | undefined;
              const isPending = metadata?.isPending;
              const isAgentPending = metadata?.mode === 'agent';
              
              if (isPending && !isAgentPending && (generationPhase === 'phase-a' || generationPhase === 'phase-b')) {
                return (
                  <div key={message.id} className="mb-4">
                    <GeneratingPlaceholderBox className="mb-3" />
                    <GeneratingPlaceholder />
                  </div>
                );
              }
              
              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onImageClick={handleImageClick}
                  onAddToCanvas={handleAddToCanvas}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2">
          <InlineError
            message={error}
            onRetry={handleRetry}
            onDismiss={() => {
              clearError();
            }}
            autoDismiss={false}
          />
        </div>
      )}

      {/* Input area */}
      <ChatInput
        ref={chatInputRef}
        onSend={handleSendMessage}
        onCancel={isGenerating ? handleStopGeneration : undefined}
        onLocateImage={handleLocateInputImage}
        disabled={isLoading}
        isLoading={isGenerating}
        isBusy={isGenerating}
        chatMode={chatMode}
        onChatModeChange={setChatMode}
        selectedModel={selectedModel}
        selectedAgentModel={selectedAgentModel}
        selectedAgentImageModel={selectedAgentImageModel}
        onModelChange={setSelectedModel}
        onAgentModelChange={setSelectedAgentModel}
        onAgentImageModelChange={setSelectedAgentImageModel}
        selectedResolution={selectedResolution}
        onResolutionChange={setSelectedResolution}
        selectedAspectRatio={selectedAspectRatio}
        onAspectRatioChange={setSelectedAspectRatio}
        membershipLevel={membershipLevel}
        projectId={projectId}
        resolutionModelName={chatMode === 'agent' ? selectedAgentImageModel : selectedModel}
      />

      <ShareDialog
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        conversationId={conversationId}
        projectId={projectId}
        documentId={documentId}
      />

      {/* Insufficient Points Dialog */}
      <InsufficientPointsDialog
        open={insufficientPointsError !== null}
        onClose={clearInsufficientPointsError}
        currentBalance={insufficientPointsError?.current_balance ?? 0}
        requiredPoints={insufficientPointsError?.required_points ?? 0}
        modelName={insufficientPointsError?.model_name}
        membershipLevel={insufficientPointsError?.membership_level}
      />

      {/* Invalid Provider Config Dialog */}
      <InvalidProviderConfigDialog
        open={userProviderConfigError !== null}
        onClose={clearUserProviderConfigError}
        message={userProviderConfigError?.message}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
});

export default ChatPanel;

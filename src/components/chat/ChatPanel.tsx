/**
 * ChatPanel Component - Right side panel
 * Requirements: 11.1-11.9 - Chat panel with message history, AI responses, and input
 * Requirements: 4.1-4.5 - Three-phase generation feedback with animations
 */

'use client';

import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
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
import { fetchModels, type AIModel } from '@/lib/supabase/queries/models';
import type { Op } from '@/lib/canvas/ops.types';
import { InsufficientPointsDialog } from '@/components/points/InsufficientPointsDialog';
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
  onLocateImage,
  onLocateImageByUrl,
  initialCollapsed = false,
  initialPrompt,
}, ref) {
  const t = useTranslations('chat');
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [isAnimating, setIsAnimating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);

  // Use chat hook for message management
  const {
    messages,
    isLoading,
    error: chatError,
    addMessage,
    removeMessage,
    replaceMessage,
    createUserMessage,
    deleteMessageById,
    clearPendingMessages,
  } = useChat({ conversationId });

  // Use store for shared state
  const {
    selectedModel,
    models,
    generationPhase,
    error: generationError,
    insufficientPointsError,
    setSelectedModel,
    setModels,
    setError,
    clearError,
    setInsufficientPointsError,
    clearInsufficientPointsError,
    startGeneration,
  } = useChatStore();

  const isGenerating = useIsGenerating();

  // Use generation hook
  const {
    startImageGeneration,
    startOpsGeneration,
    stop: stopGeneration,
  } = useGeneration({
    projectId,
    documentId,
    conversationId,
    models,
    onOpsGenerated,
    onGeneratingChange,
    onAddPlaceholder,
    onRemovePlaceholder,
    onGetPlaceholderPosition,
  });

  // Expose focusInput method via ref
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      chatInputRef.current?.focus();
    },
  }), []);

  // Load models on mount
  useEffect(() => {
    fetchModels().then((data) => {
      setModels(data);
    });
  }, [setModels]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-send initial prompt if provided
  const initialPromptSentRef = useRef(false);
  useEffect(() => {
    if (initialPrompt && !initialPromptSentRef.current && !isLoading && models.length > 0) {
      initialPromptSentRef.current = true;
      setTimeout(() => {
        handleSendMessage(initialPrompt);
        window.history.replaceState({}, '', window.location.pathname);
      }, 500);
    }
  }, [initialPrompt, isLoading, models.length]);

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
      const currentModel = model || selectedModel;
      const currentModelName = models.find(m => m.name === currentModel)?.display_name || currentModel;
      
      addMessage({
        id: pendingMessageId,
        conversation_id: conversationId,
        role: 'assistant',
        content: t('status.generating'),
        created_at: new Date().toISOString(),
        metadata: { isPending: true, modelName: currentModelName },
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

      // Determine model type and start appropriate generation
      const modelConfig = models.find(m => m.name === currentModel);
      const isImageModel = modelConfig?.type === 'image' || 
        modelConfig?.name.includes('seedream') || 
        modelConfig?.name.includes('dall-e') ||
        (modelConfig?.name.includes('gemini') && modelConfig?.name.includes('image'));
      
      const ctx = {
        content,
        model: currentModel,
        referencedImage,
        pendingMessageId,
        userMessageId,
        onMessageCreated: addMessage,
        onPendingReplaced: replaceMessage,
        onCleanup: cleanup,
      };

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
      
      setError(err instanceof Error ? err.message : 'Failed to send message');
      onGeneratingChange?.(false);
      clearPendingMessages();
    }
  }, [
    conversationId, selectedModel, models, t,
    createUserMessage, addMessage, removeMessage, replaceMessage, deleteMessageById, clearPendingMessages,
    startGeneration, startImageGeneration, startOpsGeneration, clearError, setError, onGeneratingChange,
  ]);

  const handleImageClick = useCallback((imageUrl: string, layerId?: string) => {
    if (layerId && onLocateImage) {
      onLocateImage(layerId);
    } else {
      window.open(imageUrl, '_blank');
    }
  }, [onLocateImage]);

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
      className={`fixed top-4 right-4 bottom-4 w-[360px] z-40 flex flex-col rounded-xl overflow-hidden bg-white dark:bg-[#1A1028] shadow-xl border border-black/10 dark:border-white/10 ${isAnimating ? 'animate-slide-out-right pointer-events-none' : 'animate-slide-in-right'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt={t('panel.title')} className="size-5" />
          <h2 className="text-sm font-medium text-[#1A1A1A] dark:text-white">{t('panel.title')}</h2>
        </div>
        <div className="flex items-center gap-0">
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
            <img src="/logo.png" alt={t('panel.title')} className="size-16 rounded-2xl mb-4" />
            <h3 className="font-semibold mb-2">{t('empty_state.title')}</h3>
            <p className="text-sm text-muted-foreground max-w-[240px]">{t('empty_state.description')}</p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const isPending = (message.metadata as MessageMetadata | undefined)?.isPending;
              
              if (isPending && (generationPhase === 'phase-a' || generationPhase === 'phase-b')) {
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
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        projectId={projectId}
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
    </div>
  );
});

export default ChatPanel;

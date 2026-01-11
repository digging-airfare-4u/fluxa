/**
 * ChatPanel Component - Right side panel
 * Requirements: 11.1-11.9 - Chat panel with message history, AI responses, and input
 * Requirements: 4.1-4.5 - Three-phase generation feedback with animations
 */

'use client';

import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput, ChatInputRef } from './ChatInput';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { GeneratingPlaceholder, GeneratingPlaceholderBox } from '@/components/ui/GeneratingPlaceholder';
import { InlineError } from '@/components/ui/InlineError';
import { 
  fetchMessages, 
  createMessage,
  deleteMessage,
  subscribeToMessages,
  type Message,
  type MessageMetadata,
} from '@/lib/supabase/queries/messages';
import { fetchModels, type AIModel } from '@/lib/supabase/queries/models';
import { subscribeToJob, fetchJob, type Job } from '@/lib/realtime/subscribeJobs';
import { supabase } from '@/lib/supabase/client';
import type { Op } from '@/lib/canvas/ops.types';
import { InsufficientPointsDialog } from '@/components/points/InsufficientPointsDialog';
import type { InsufficientPointsError } from '@/lib/supabase/types/points';

/**
 * Generation phase states for three-phase feedback
 * - idle: No generation in progress
 * - phase-a: Initial state (0-150ms) - Button shows "Generating...", pending message added
 * - phase-b: Waiting for generation - Skeleton placeholder visible
 * - success: Generation completed - Transition to ImageCard
 * - failed: Generation failed - Show inline error
 * - stopped: User cancelled generation
 */
type GenerationPhase = 'idle' | 'phase-a' | 'phase-b' | 'success' | 'failed' | 'stopped';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle');
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('doubao-seedream-4-5-251128');
  const [models, setModels] = useState<AIModel[]>([]);
  const [insufficientPointsError, setInsufficientPointsError] = useState<InsufficientPointsError | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const phaseATimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Expose focusInput method via ref
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      chatInputRef.current?.focus();
    },
  }), []);

  // Computed states for backward compatibility
  const isGenerating = generationPhase !== 'idle' && generationPhase !== 'success' && generationPhase !== 'failed' && generationPhase !== 'stopped';

  useEffect(() => {
    async function loadMessages() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchMessages(conversationId);
        setMessages(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    }
    loadMessages();
  }, [conversationId]);

  // Load models and set default
  useEffect(() => {
    fetchModels().then((data) => {
      setModels(data);
      const defaultModel = data.find(m => m.is_default) || data[0];
      if (defaultModel) {
        setSelectedModel(defaultModel.name);
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToMessages(conversationId, (newMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    });
    return unsubscribe;
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-send initial prompt if provided
  const initialPromptSentRef = useRef(false);
  useEffect(() => {
    if (initialPrompt && !initialPromptSentRef.current && !isLoading && models.length > 0) {
      initialPromptSentRef.current = true;
      // Small delay to ensure everything is ready
      setTimeout(() => {
        handleSendMessage(initialPrompt);
        // Clear the prompt from URL to prevent re-sending on refresh
        window.history.replaceState({}, '', window.location.pathname);
      }, 500);
    }
  }, [initialPrompt, isLoading, models.length]);

  const handleToggleCollapse = useCallback(() => {
    if (isAnimating) return;
    
    if (!isCollapsed) {
      // Collapsing: start animation, then set collapsed after animation
      setIsAnimating(true);
      setTimeout(() => {
        setIsCollapsed(true);
        setIsAnimating(false);
        onCollapse?.(true);
      }, 200);
    } else {
      // Expanding: set collapsed false immediately, animation handled by CSS
      setIsCollapsed(false);
      onCollapse?.(false);
    }
  }, [isCollapsed, isAnimating, onCollapse]);

  /**
   * Stop the current generation
   * Requirements: 4.4 - Stop button during generation
   */
  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (phaseATimeoutRef.current) {
      clearTimeout(phaseATimeoutRef.current);
      phaseATimeoutRef.current = null;
    }
    setGenerationPhase('stopped');
    // Reset to idle after a brief moment
    setTimeout(() => setGenerationPhase('idle'), 100);
  }, []);

  /**
   * Retry the last failed generation
   * Requirements: 4.5 - Retry option on failure
   */
  const handleRetry = useCallback(() => {
    setError(null);
    setGenerationPhase('idle');
  }, []);

  const handleSendMessage = useCallback(async (content: string, model?: string, referencedImage?: { id: string; url: string; filename: string }) => {
    try {
      setError(null);
      
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        id: tempId,
        conversation_id: conversationId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
        metadata: referencedImage ? { referencedImage } : undefined,
      };
      setMessages((prev) => [...prev, optimisticMessage]);

      const userMessage = await createMessage({
        conversation_id: conversationId,
        role: 'user',
        content,
        metadata: referencedImage ? { referencedImage } : undefined,
      });

      // Store user message ID for potential rollback on failure
      const userMessageId = userMessage.id;

      setMessages((prev) => 
        prev.map((m) => (m.id === tempId ? userMessage : m))
      );

      /**
       * Phase A (0-150ms): Immediate feedback
       * Requirements: 4.1 - Switch button to "Generating...", add pending message
       */
      setGenerationPhase('phase-a');
      
      // Add pending "正在生成" message
      const pendingMessageId = `pending-${Date.now()}`;
      const currentModelName = models.find(m => m.name === (model || selectedModel))?.display_name || selectedModel;
      const pendingMessage: Message = {
        id: pendingMessageId,
        conversation_id: conversationId,
        role: 'assistant',
        content: '正在生成...',
        created_at: new Date().toISOString(),
        metadata: { isPending: true, modelName: currentModelName },
      };
      setMessages((prev) => [...prev, pendingMessage]);

      // Helper to clean up messages on failure
      const cleanupOnFailure = async () => {
        // Remove both messages from UI
        setMessages((prev) => prev.filter((m) => m.id !== pendingMessageId && m.id !== userMessageId));
        // Delete user message from database
        try {
          await deleteMessage(userMessageId);
        } catch (e) {
          console.error('Failed to delete user message:', e);
        }
      };
      
      // Notify canvas about generation start
      onGeneratingChange?.(true, currentModelName);
      
      /**
       * Phase B: After 150ms, show Skeleton placeholder
       * Requirements: 4.2 - Display Skeleton with breathe animation
       */
      phaseATimeoutRef.current = setTimeout(() => {
        setGenerationPhase('phase-b');
      }, 150);
      
      // Refresh session to ensure we have a valid token
      // getSession() may return cached/expired tokens
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session) {
        console.error('Failed to refresh session:', sessionError);
        throw new Error('请重新登录后再试');
      }
      
      // Determine which API to call based on model type
      const currentModel = models.find(m => m.name === (model || selectedModel));
      const isImageModel = currentModel?.name.includes('seedream') || currentModel?.name.includes('dall-e');
      
      if (isImageModel) {
        // Generate placeholder ID and position
        const placeholderId = `placeholder-${Date.now()}`;
        const placeholderX = 100 + Math.floor(Math.random() * 200);
        const placeholderY = 100 + Math.floor(Math.random() * 200);
        const placeholderSize = 400;

        // Add placeholder to canvas
        onAddPlaceholder?.(placeholderId, placeholderX, placeholderY, placeholderSize, placeholderSize);

        // Call generate-image API for image generation models
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            projectId,
            documentId,
            conversationId,
            prompt: content,
            model: model || selectedModel,
            width: 1024,
            height: 1024,
            // Pass placeholder position to backend
            placeholderX,
            placeholderY,
            // Pass referenced image URL for image-to-image generation
            imageUrl: referencedImage?.url,
          }),
          signal: abortControllerRef.current.signal,
        });

        // Clear phase A timeout if still pending
        if (phaseATimeoutRef.current) {
          clearTimeout(phaseATimeoutRef.current);
          phaseATimeoutRef.current = null;
        }

        if (!response.ok) {
          onRemovePlaceholder?.(placeholderId);
          // Check for INSUFFICIENT_POINTS error
          const errorData = await response.json().catch(() => null);
          if (errorData?.error?.code === 'INSUFFICIENT_POINTS') {
            setInsufficientPointsError({
              code: 'INSUFFICIENT_POINTS',
              current_balance: errorData.error.current_balance,
              required_points: errorData.error.required_points,
              model_name: errorData.error.model_name || currentModelName,
              membership_level: errorData.error.membership_level || 'free',
            });
            // Remove user message and pending message
            await cleanupOnFailure();
            setGenerationPhase('idle');
            onGeneratingChange?.(false);
            return;
          }
          throw new Error(errorData?.error?.message || 'Failed to generate image');
        }

        const result = await response.json();
        
        // Subscribe to job status updates
        if (result.jobId) {
          const { unsubscribe } = subscribeToJob(result.jobId, {
            onDone: async (job: Job) => {
              // Get placeholder's final position (user may have dragged it)
              const finalPosition = onGetPlaceholderPosition?.(placeholderId);
              
              // Remove placeholder when image is ready
              onRemovePlaceholder?.(placeholderId);

              // Fetch full job data to ensure we have complete output
              const fullJob = await fetchJob(result.jobId);
              const output = (fullJob?.output || job.output) as { op?: Op; layerId?: string; publicUrl?: string; signedUrl?: string } | undefined;
              const imageUrl = output?.publicUrl || output?.signedUrl;
              const layerId = output?.layerId;
              
              console.log('[ChatPanel] Job done, output:', output, 'imageUrl:', imageUrl, 'finalPosition:', finalPosition);
              
              // If user dragged the placeholder, update the image position
              if (finalPosition && layerId && (finalPosition.x !== placeholderX || finalPosition.y !== placeholderY)) {
                console.log('[ChatPanel] Placeholder was moved, updating image position to:', finalPosition);
                // The image will be added at the original position via realtime,
                // then we send an updateLayer op to move it to the final position
                setTimeout(async () => {
                  try {
                    const updateOp: Op = {
                      type: 'updateLayer',
                      payload: {
                        id: layerId,
                        properties: {
                          left: finalPosition.x,
                          top: finalPosition.y,
                        },
                      },
                    };
                    onOpsGenerated?.([updateOp]);
                  } catch (err) {
                    console.error('[ChatPanel] Failed to update image position:', err);
                  }
                }, 500); // Small delay to ensure image is added first
              }
              
              try {
                const assistantMessage = await createMessage({
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: '图片已生成并添加到画布',
                  metadata: {
                    jobId: result.jobId,
                    imageUrl: imageUrl,
                    op: output?.op,
                    modelName: currentModelName,
                  },
                });
                
                // Smooth transition: replace pending with real message in one update
                setMessages((prev) => 
                  prev.map((m) => m.id === pendingMessageId ? assistantMessage : m)
                );
                
                // Set success phase after message is updated
                setGenerationPhase('success');
                
                // Notify canvas generation complete
                onGeneratingChange?.(false);
                
                // Note: ops are already saved to DB by the Edge Function
                // and will be received via Realtime subscription, so we don't
                // need to call onOpsGenerated here (would cause duplicate execution)
              } catch (err) {
                console.error('Failed to create message:', err);
                setMessages((prev) => prev.filter((m) => m.id !== pendingMessageId));
              }
              
              unsubscribe();
              setTimeout(() => setGenerationPhase('idle'), 100);
            },
            onFailed: (job: Job) => {
              // Remove placeholder on failure
              onRemovePlaceholder?.(placeholderId);
              
              setGenerationPhase('failed');
              setError(job.error || 'Image generation failed');
              setMessages((prev) => prev.filter((m) => m.id !== pendingMessageId));
              onGeneratingChange?.(false);
              unsubscribe();
            },
          });
        }
      } else {
        // Call generate-ops API for text generation models
        const response = await fetch('/api/generate-ops', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            projectId,
            documentId,
            conversationId,
            prompt: content,
            model: model || selectedModel,
          }),
          signal: abortControllerRef.current.signal,
        });

        // Clear phase A timeout if still pending
        if (phaseATimeoutRef.current) {
          clearTimeout(phaseATimeoutRef.current);
          phaseATimeoutRef.current = null;
        }

        if (!response.ok) {
          // Check for INSUFFICIENT_POINTS error
          const errorData = await response.json().catch(() => null);
          if (errorData?.error?.code === 'INSUFFICIENT_POINTS') {
            setInsufficientPointsError({
              code: 'INSUFFICIENT_POINTS',
              current_balance: errorData.error.current_balance,
              required_points: errorData.error.required_points,
              model_name: errorData.error.model_name || currentModelName,
              membership_level: errorData.error.membership_level || 'free',
            });
            // Remove user message and pending message
            await cleanupOnFailure();
            setGenerationPhase('idle');
            onGeneratingChange?.(false);
            return;
          }
          throw new Error(errorData?.error?.message || 'Failed to generate design');
        }

        const result = await response.json();
        
        /**
         * Phase C: Generation complete
         * Requirements: 4.3 - Transition to ImageCard with fadeScaleIn
         */
        setGenerationPhase('success');
        
        const assistantMessage = await createMessage({
          conversation_id: conversationId,
          role: 'assistant',
          content: result.plan || 'Design generated successfully.',
          metadata: {
            plan: result.plan,
            ops: result.ops,
            modelName: currentModelName,
          },
        });

        // Replace pending message with actual assistant message
        setMessages((prev) => 
          prev.filter((m) => m.id !== pendingMessageId).concat(assistantMessage)
        );

        // Note: ops are already saved to DB by the Edge Function
        // and will be received via Realtime subscription, so we don't
        // need to call onOpsGenerated here (would cause duplicate execution)
        
        // Notify canvas generation complete
        onGeneratingChange?.(false);
        
        // Reset to idle after success
        setTimeout(() => setGenerationPhase('idle'), 100);
      }
    } catch (err) {
      // Clear phase A timeout if still pending
      if (phaseATimeoutRef.current) {
        clearTimeout(phaseATimeoutRef.current);
        phaseATimeoutRef.current = null;
      }
      
      // Handle abort (user stopped generation)
      if (err instanceof Error && err.name === 'AbortError') {
        // Remove pending message on abort
        setMessages((prev) => prev.filter((m) => !(m.metadata as MessageMetadata | undefined)?.isPending));
        return;
      }
      
      /**
       * Requirements: 4.5 - Display inline error on failure
       */
      setGenerationPhase('failed');
      setError(err instanceof Error ? err.message : 'Failed to send message');
      
      // Notify canvas generation complete (on error)
      onGeneratingChange?.(false);
      
      // Remove pending message on error
      setMessages((prev) => prev.filter((m) => !(m.metadata as MessageMetadata | undefined)?.isPending));
    } finally {
      abortControllerRef.current = null;
    }
  }, [conversationId, projectId, documentId, onOpsGenerated, selectedModel, models]);

  const handleImageClick = useCallback((imageUrl: string, layerId?: string) => {
    console.log('[ChatPanel] handleImageClick called', { imageUrl, layerId, hasOnLocateImage: !!onLocateImage });
    if (layerId && onLocateImage) {
      onLocateImage(layerId);
    } else {
      window.open(imageUrl, '_blank');
    }
  }, [onLocateImage]);

  // Handle locating image from chat input (referenced image thumbnail click)
  const handleLocateInputImage = useCallback((imageUrl: string) => {
    console.log('[ChatPanel] handleLocateInputImage called', { imageUrl });
    if (onLocateImageByUrl) {
      onLocateImageByUrl(imageUrl);
    }
  }, [onLocateImageByUrl]);

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
        <TooltipContent side="left">展开聊天面板</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div 
      className={`fixed top-4 right-4 bottom-4 w-[360px] z-40 flex flex-col rounded-xl overflow-hidden bg-white dark:bg-[#1A1028] shadow-xl border border-black/10 dark:border-white/10 ${isAnimating ? 'animate-slide-out-right pointer-events-none' : 'animate-slide-in-right'}`}
    >
      {/* Header - no border */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Fluxa" className="size-5" />
          <h2 className="text-sm font-medium text-[#1A1A1A] dark:text-white">Fluxa</h2>
        </div>
        <div className="flex items-center gap-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded text-[#888] hover:text-[#1A1A1A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all" onClick={handleToggleCollapse}>
                <ChevronRight className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>收起面板</TooltipContent>
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
            <img 
              src="/logo.png" 
              alt="Fluxa" 
              className="size-16 rounded-2xl mb-4"
            />
            <h3 className="font-semibold mb-2">开始设计</h3>
            <p className="text-sm text-muted-foreground max-w-[240px]">
              描述你想要的设计，AI 将为你生成可编辑的画布
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              // Check if this is a pending message during generation
              const isPending = (message.metadata as MessageMetadata | undefined)?.isPending;
              // const pendingModel = (message.metadata as MessageMetadata & { modelName?: string } | undefined)?.modelName;
              
              if (isPending && (generationPhase === 'phase-a' || generationPhase === 'phase-b')) {
                // Show shimmer placeholder box with timer
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
                />
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error message - Requirements: 4.5, 7.2, 7.3 */}
      {error && (
        <div className="px-4 py-2">
          <InlineError
            message={error}
            onRetry={handleRetry}
            onDismiss={() => {
              setError(null);
              setGenerationPhase('idle');
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

      {/* Insufficient Points Dialog - Requirements: 4.1, 4.2, 4.3, 4.4 */}
      <InsufficientPointsDialog
        open={insufficientPointsError !== null}
        onClose={() => setInsufficientPointsError(null)}
        currentBalance={insufficientPointsError?.current_balance ?? 0}
        requiredPoints={insufficientPointsError?.required_points ?? 0}
        modelName={insufficientPointsError?.model_name}
        membershipLevel={insufficientPointsError?.membership_level}
      />
    </div>
  );
});

export default ChatPanel;

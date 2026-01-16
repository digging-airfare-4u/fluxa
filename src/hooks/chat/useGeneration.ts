/**
 * useGeneration - Manages AI generation flow (image and ops)
 * Requirements: Three-phase generation feedback with abort support
 */

import { useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase/client';
import { generateImage, generateOps, GenerationApiError } from '@/lib/api';
import { subscribeToJob, fetchJob, type Job } from '@/lib/realtime/subscribeJobs';
import { createMessage, type Message } from '@/lib/supabase/queries/messages';
import { useChatStore, type GenerationPhase } from '@/lib/store/useChatStore';
import { useErrorMessages } from '@/lib/i18n';
import type { Op } from '@/lib/canvas/ops.types';
import type { AIModel } from '@/lib/supabase/queries/models';

export interface UseGenerationOptions {
  projectId: string;
  documentId: string;
  conversationId: string;
  models: AIModel[];
  onOpsGenerated?: (ops: Op[]) => void;
  onGeneratingChange?: (isGenerating: boolean, modelName?: string) => void;
  onAddPlaceholder?: (id: string, x: number, y: number, width: number, height: number) => void;
  onRemovePlaceholder?: (id: string) => void;
  onGetPlaceholderPosition?: (id: string) => { x: number; y: number } | null;
}

export interface GenerationContext {
  content: string;
  model: string;
  referencedImage?: { id: string; url: string; filename: string };
  pendingMessageId: string;
  userMessageId: string;
  onMessageCreated: (message: Message) => void;
  onPendingReplaced: (pendingId: string, message: Message) => void;
  onCleanup: () => Promise<void>;
}

export interface UseGenerationReturn {
  phase: GenerationPhase;
  isGenerating: boolean;
  startImageGeneration: (ctx: GenerationContext) => Promise<void>;
  startOpsGeneration: (ctx: GenerationContext) => Promise<void>;
  stop: () => void;
}

export function useGeneration({
  projectId,
  documentId,
  conversationId,
  models,
  onOpsGenerated,
  onGeneratingChange,
  onAddPlaceholder,
  onRemovePlaceholder,
  onGetPlaceholderPosition,
}: UseGenerationOptions): UseGenerationReturn {
  const t = useTranslations('chat');
  const { getApiError } = useErrorMessages();
  
  const {
    generationPhase,
    selectedModel,
    setGenerationPhase,
    completeGeneration,
    failGeneration,
    stopGeneration,
    setInsufficientPointsError,
  } = useChatStore();

  const abortControllerRef = useRef<AbortController | null>(null);
  const phaseATimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isGenerating = generationPhase !== 'idle' && 
                       generationPhase !== 'success' && 
                       generationPhase !== 'failed' && 
                       generationPhase !== 'stopped';

  const clearPhaseATimeout = useCallback(() => {
    if (phaseATimeoutRef.current) {
      clearTimeout(phaseATimeoutRef.current);
      phaseATimeoutRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    clearPhaseATimeout();
    stopGeneration();
  }, [clearPhaseATimeout, stopGeneration]);

  const handleApiError = useCallback((
    err: unknown,
    currentModelName: string,
    cleanup: () => Promise<void>
  ): boolean => {
    if (err instanceof GenerationApiError && err.isInsufficientPoints()) {
      const details = err.getInsufficientPointsDetails();
      if (details) {
        setInsufficientPointsError({
          code: 'INSUFFICIENT_POINTS',
          current_balance: details.current_balance,
          required_points: details.required_points,
          model_name: details.model_name || currentModelName,
          membership_level: (details.membership_level as 'free' | 'pro' | 'team') || 'free',
        });
        cleanup();
        setGenerationPhase('idle');
        onGeneratingChange?.(false);
        return true;
      }
    }
    return false;
  }, [setInsufficientPointsError, setGenerationPhase, onGeneratingChange]);

  const startImageGeneration = useCallback(async (ctx: GenerationContext) => {
    const { content, model, referencedImage, pendingMessageId, onPendingReplaced, onCleanup } = ctx;
    
    abortControllerRef.current = new AbortController();
    
    const currentModelName = models.find(m => m.name === model)?.display_name || model;
    
    // Phase A: Start with placeholder
    const placeholderId = `placeholder-${Date.now()}`;
    const placeholderX = 100 + Math.floor(Math.random() * 200);
    const placeholderY = 100 + Math.floor(Math.random() * 200);
    const placeholderSize = 400;

    onAddPlaceholder?.(placeholderId, placeholderX, placeholderY, placeholderSize, placeholderSize);

    // Phase B timer
    phaseATimeoutRef.current = setTimeout(() => {
      setGenerationPhase('phase-b');
    }, 150);

    try {
      // Refresh session
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session) {
        throw new Error(getApiError('SESSION_EXPIRED'));
      }

      const result = await generateImage(
        {
          projectId,
          documentId,
          conversationId,
          prompt: content,
          model,
          width: 1024,
          height: 1024,
          placeholderX,
          placeholderY,
          imageUrl: referencedImage?.url,
        },
        session.access_token,
        abortControllerRef.current?.signal
      );

      clearPhaseATimeout();

      if (result.jobId) {
        const { unsubscribe } = subscribeToJob(result.jobId, {
          onDone: async (job: Job) => {
            const finalPosition = onGetPlaceholderPosition?.(placeholderId);
            onRemovePlaceholder?.(placeholderId);

            const fullJob = await fetchJob(result.jobId);
            const output = (fullJob?.output || job.output) as { 
              op?: Op; 
              layerId?: string; 
              publicUrl?: string; 
              signedUrl?: string;
            } | undefined;
            const imageUrl = output?.publicUrl || output?.signedUrl;
            const layerId = output?.layerId;

            // Update position if placeholder was moved
            if (finalPosition && layerId && 
                (finalPosition.x !== placeholderX || finalPosition.y !== placeholderY)) {
              setTimeout(() => {
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
              }, 500);
            }

            try {
              const assistantMessage = await createMessage({
                conversation_id: conversationId,
                role: 'assistant',
                content: '',
                metadata: {
                  jobId: result.jobId,
                  imageUrl,
                  op: output?.op,
                  modelName: currentModelName,
                },
              });

              onPendingReplaced(pendingMessageId, assistantMessage);
              completeGeneration();
              onGeneratingChange?.(false);
            } catch (err) {
              console.error('[useGeneration] Failed to create message:', err);
            }

            unsubscribe();
          },
          onFailed: (job: Job) => {
            onRemovePlaceholder?.(placeholderId);
            failGeneration(job.error || 'Image generation failed');
            onGeneratingChange?.(false);
            unsubscribe();
          },
        });
      }
    } catch (err) {
      clearPhaseATimeout();
      onRemovePlaceholder?.(placeholderId);

      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      if (!handleApiError(err, currentModelName, onCleanup)) {
        throw err;
      }
    }
  }, [
    projectId, documentId, conversationId, models,
    onAddPlaceholder, onRemovePlaceholder, onGetPlaceholderPosition,
    onOpsGenerated, onGeneratingChange,
    setGenerationPhase, completeGeneration, failGeneration,
    clearPhaseATimeout, handleApiError, getApiError,
  ]);

  const startOpsGeneration = useCallback(async (ctx: GenerationContext) => {
    const { content, model, pendingMessageId, onPendingReplaced, onCleanup } = ctx;
    
    abortControllerRef.current = new AbortController();
    
    const currentModelName = models.find(m => m.name === model)?.display_name || model;

    // Phase B timer
    phaseATimeoutRef.current = setTimeout(() => {
      setGenerationPhase('phase-b');
    }, 150);

    try {
      // Refresh session
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session) {
        throw new Error(getApiError('SESSION_EXPIRED'));
      }

      const result = await generateOps(
        {
          projectId,
          documentId,
          conversationId,
          prompt: content,
          model,
        },
        session.access_token,
        abortControllerRef.current?.signal
      );

      clearPhaseATimeout();

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

      onPendingReplaced(pendingMessageId, assistantMessage);
      completeGeneration();
      onGeneratingChange?.(false);
    } catch (err) {
      clearPhaseATimeout();

      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      if (!handleApiError(err, currentModelName, onCleanup)) {
        throw err;
      }
    }
  }, [
    projectId, documentId, conversationId, models,
    onGeneratingChange, setGenerationPhase, completeGeneration,
    clearPhaseATimeout, handleApiError, getApiError,
  ]);

  return {
    phase: generationPhase,
    isGenerating,
    startImageGeneration,
    startOpsGeneration,
    stop,
  };
}

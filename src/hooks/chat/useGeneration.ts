/**
 * useGeneration - Manages AI generation flow (image and ops)
 * Requirements: Three-phase generation feedback with abort support
 */

import { useCallback, useRef } from 'react';
import {
  generateAgentStream,
  generateImage,
  generateOps,
  GenerationApiError,
  type AgentSSEEvent,
} from '@/lib/api';
import { subscribeToJob, fetchJob, type Job } from '@/lib/realtime/subscribeJobs';
import { pendingGenerationTracker } from '@/lib/realtime/pendingGenerationTracker';
import {
  createMessage,
  type Message,
} from '@/lib/supabase/queries/messages';
import { saveOp } from '@/lib/supabase/queries/ops';
import { useChatStore, type GenerationPhase } from '@/lib/store/useChatStore';
import type { Op, AddImageOp } from '@/lib/canvas/ops.types';
import type { AIModel } from '@/lib/supabase/queries/models';
import type { SelectableModel } from '@/lib/models/resolve-selectable-models';
import {
  buildAgentPendingMetadata,
  createInitialAgentPendingState,
  mergeAgentFinalMessage,
  reduceAgentPendingState,
} from './agent-process';

const RESOLUTION_PIXELS: Record<string, number> = {
  '1K': 1024,
  '2K': 2048,
  '4K': 4096,
};

function calculateDimensions(aspectRatio: string, baseSize: number) {
  const [w, h] = aspectRatio.split(':').map(Number);
  if (!w || !h) {
    return { width: baseSize, height: baseSize };
  }
  if (w >= h) {
    return { width: baseSize, height: Math.round((baseSize * h) / w) };
  }
  return { width: Math.round((baseSize * w) / h), height: baseSize };
}

export interface UseGenerationOptions {
  projectId: string;
  documentId: string;
  conversationId: string;
  models: AIModel[];
  /** Unified selectable model list for display name resolution */
  selectableModels?: SelectableModel[];
  selectedResolution?: string;
  selectedAspectRatio?: string;
  onOpsGenerated?: (ops: Op[]) => void;
  onGeneratingChange?: (isGenerating: boolean, modelName?: string) => void;
  onAddPlaceholder?: (id: string, x: number, y: number, width: number, height: number) => void;
  onRemovePlaceholder?: (id: string) => void;
  onGetPlaceholderPosition?: (id: string) => { x: number; y: number } | null;
  /** Get a free position for placing an object without overlapping existing objects */
  onGetFreePosition?: (width: number, height: number) => { x: number; y: number };
}

export interface GenerationContext {
  content: string;
  model?: string;
  imageModel?: string;
  referencedImage?: { id: string; url: string; filename: string };
  pendingMessageId: string;
  userMessageId: string;
  onMessageCreated: (message: Message) => void;
  onPendingUpdated: (id: string, updates: Partial<Message>) => void;
  onPendingReplaced: (pendingId: string, message: Message) => void;
  onCleanup: () => Promise<void>;
}

export interface UseGenerationReturn {
  phase: GenerationPhase;
  isGenerating: boolean;
  startAgentGeneration: (ctx: GenerationContext) => Promise<void>;
  startImageGeneration: (ctx: GenerationContext) => Promise<void>;
  startOpsGeneration: (ctx: GenerationContext) => Promise<void>;
  stop: () => void;
}

export function useGeneration({
  projectId,
  documentId,
  conversationId,
  models,
  selectableModels = [],
  selectedResolution = '1K',
  selectedAspectRatio = '1:1',
  onOpsGenerated,
  onGeneratingChange,
  onAddPlaceholder,
  onRemovePlaceholder,
  onGetPlaceholderPosition,
  onGetFreePosition,
}: UseGenerationOptions): UseGenerationReturn {
  const {
    generationPhase,
    setGenerationPhase,
    completeGeneration,
    failGeneration,
    stopGeneration,
    setInsufficientPointsError,
    setUserProviderConfigError,
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

    if (err instanceof GenerationApiError && err.isUserProviderConfigInvalid()) {
      const details = err.getUserProviderConfigInvalidDetails();
      if (details) {
        setUserProviderConfigError({
          code: details.code,
          message: details.message,
        });
        cleanup();
        setGenerationPhase('idle');
        onGeneratingChange?.(false);
        return true;
      }
    }

    return false;
  }, [setInsufficientPointsError, setUserProviderConfigError, setGenerationPhase, onGeneratingChange]);

  const startImageGeneration = useCallback(async (ctx: GenerationContext) => {
    const { content, model, referencedImage, pendingMessageId, onPendingReplaced, onCleanup } = ctx;

    if (!model) {
      throw new Error('Image generation requires a selected model');
    }
    
    console.log('[useGeneration] startImageGeneration called', { content, model });
    
    abortControllerRef.current = new AbortController();
    
    const currentModelName = selectableModels.find(m => m.value === model)?.displayName
      || models.find(m => m.name === model)?.display_name
      || model;
    
    // Phase A: Start with placeholder
    const placeholderId = `placeholder-${Date.now()}`;
    const targetResolution = RESOLUTION_PIXELS[selectedResolution] ?? 1024;
    const placeholderDimensions = calculateDimensions(selectedAspectRatio, targetResolution);

    // Use smart placement if available, otherwise fall back to random position
    const freePosition = onGetFreePosition?.(
      placeholderDimensions.width,
      placeholderDimensions.height
    );
    const placeholderX = freePosition?.x ?? (100 + Math.floor(Math.random() * 200));
    const placeholderY = freePosition?.y ?? (100 + Math.floor(Math.random() * 200));

    onAddPlaceholder?.(
      placeholderId,
      placeholderX,
      placeholderY,
      placeholderDimensions.width,
      placeholderDimensions.height
    );
    
    console.log('[useGeneration] Placeholder added', { placeholderId, placeholderX, placeholderY });

    // Register this generation's original position so Realtime ops can skip it
    pendingGenerationTracker.registerGeneration(placeholderX, placeholderY);

    // Phase B timer
    phaseATimeoutRef.current = setTimeout(() => {
      setGenerationPhase('phase-b');
    }, 150);

    try {
      // supabase.functions.invoke handles auth automatically, no need to refresh session here

      const { width, height } = calculateDimensions(selectedAspectRatio, targetResolution);

      const result = await generateImage(
        {
          projectId,
          documentId,
          conversationId,
          prompt: content,
          model,
          width,
          height,
          placeholderX,
          placeholderY,
          imageUrl: referencedImage?.url,
          aspectRatio: selectedAspectRatio,
          resolution: selectedResolution,
        },
        undefined, // accessToken not needed
        abortControllerRef.current?.signal
      );

      clearPhaseATimeout();

      if (result.jobId) {
        // Track if we've already handled the job completion to avoid double-processing
        let handled = false;

        const handleJobDone = async (job: Job) => {
          if (handled) return;
          handled = true;

          console.log('[useGeneration] handleJobDone triggered, job:', job.id);

          const finalPosition = onGetPlaceholderPosition?.(placeholderId);
          console.log('[useGeneration] finalPosition:', finalPosition);

          const fullJob = await fetchJob(result.jobId);
          console.log('[useGeneration] fullJob:', fullJob?.id, 'output:', fullJob?.output);
          
          const output = (fullJob?.output || job.output) as { 
            op?: Op; 
            layerId?: string; 
            publicUrl?: string; 
            signedUrl?: string;
            textResponse?: string;
            thoughtSummary?: string;
          } | undefined;
          const imageUrl =
            output?.publicUrl ||
            output?.signedUrl ||
            ((output?.op as AddImageOp | undefined)?.payload?.src);
          const assistantContent = output?.textResponse || '';
          console.log('[useGeneration] output?.op:', output?.op);

          const fallbackImageOp: AddImageOp | undefined =
            !output?.op && imageUrl
              ? {
                  type: 'addImage',
                  payload: {
                    id:
                      (typeof output?.layerId === 'string' && output.layerId) ||
                      `layer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                    src: imageUrl,
                    x: finalPosition?.x ?? placeholderX,
                    y: finalPosition?.y ?? placeholderY,
                    width: placeholderDimensions.width,
                    height: placeholderDimensions.height,
                  },
                }
              : undefined;

          const effectiveImageOp = (output?.op as AddImageOp | undefined) || fallbackImageOp;

          // Execute the addImage op to render the image on canvas
          if (effectiveImageOp) {
            if (!output?.op && fallbackImageOp) {
              console.warn('[useGeneration] job output missing op, using fallback addImage op', {
                jobId: result.jobId,
                layerId: fallbackImageOp.payload.id,
              });
            }
            const imageOp = effectiveImageOp;
            
            // Register layer ID so Realtime knows to skip this op
            pendingGenerationTracker.registerLayerId(imageOp.payload.id);
            
            // Build the op to execute (with fadeIn and potentially updated position)
            const opToExecute: AddImageOp = finalPosition
              ? {
                  ...imageOp,
                  payload: {
                    ...imageOp.payload,
                    x: finalPosition.x,
                    y: finalPosition.y,
                    fadeIn: true,
                  },
                }
              : {
                  ...imageOp,
                  payload: {
                    ...imageOp.payload,
                    fadeIn: true,
                  },
                };

            console.log('[useGeneration] Executing addImage op:', opToExecute.payload.id);
            await onOpsGenerated?.([opToExecute]);
            console.log('[useGeneration] Op executed successfully');
            
            // Unregister after execution - Realtime can now process this layer normally
            pendingGenerationTracker.unregisterLayerId(imageOp.payload.id);
            pendingGenerationTracker.unregisterGeneration(placeholderX, placeholderY);

            // Save the addImage op to persist across page refresh
            // We save with the final position (after user may have dragged placeholder)
            try {
              const opToSave: Op = {
                type: 'addImage',
                payload: {
                  id: imageOp.payload.id,
                  src: imageOp.payload.src,
                  x: finalPosition?.x ?? imageOp.payload.x,
                  y: finalPosition?.y ?? imageOp.payload.y,
                  width: imageOp.payload.width,
                  height: imageOp.payload.height,
                },
              };
              await saveOp({ documentId, op: opToSave });
              console.log('[useGeneration] addImage op saved to database');
            } catch (error) {
              console.error('[useGeneration] Failed to save addImage op:', error);
            }

            setTimeout(() => {
              onRemovePlaceholder?.(placeholderId);
            }, 400);
          } else {
            // No op in output, just cleanup
            pendingGenerationTracker.unregisterGeneration(placeholderX, placeholderY);
            onRemovePlaceholder?.(placeholderId);
          }

          try {
            const assistantMessage = await createMessage({
              conversation_id: conversationId,
              role: 'assistant',
              content: assistantContent,
              metadata: {
                jobId: result.jobId,
                imageUrl,
                op: effectiveImageOp,
                modelName: currentModelName,
                thinking: output?.thoughtSummary,
              },
            });

            onPendingReplaced(pendingMessageId, assistantMessage);
            completeGeneration();
            onGeneratingChange?.(false);
          } catch (err) {
            console.error('[useGeneration] Failed to create message:', err);
          }

          unsubscribe();
        };

        const handleJobFailed = async (job: Job) => {
          if (handled) return;
          handled = true;

          // Clean up pending generation tracking
          pendingGenerationTracker.unregisterGeneration(placeholderX, placeholderY);
          
          onRemovePlaceholder?.(placeholderId);

          const failedOutput = job.output as {
            textResponse?: string;
            thoughtSummary?: string;
          } | undefined;
          const fallbackContent = failedOutput?.textResponse || job.error || 'Image generation failed';

          try {
            const assistantMessage = await createMessage({
              conversation_id: conversationId,
              role: 'assistant',
              content: fallbackContent,
              metadata: {
                jobId: result.jobId,
                modelName: currentModelName,
                thinking: failedOutput?.thoughtSummary,
              },
            });
            onPendingReplaced(pendingMessageId, assistantMessage);
          } catch (error) {
            console.error('[useGeneration] Failed to create assistant message for failed job:', error);
          }

          if (failedOutput?.textResponse) {
            completeGeneration();
          } else {
            failGeneration(job.error || 'Image generation failed');
          }
          onGeneratingChange?.(false);
          await unsubscribe();
        };

        const { unsubscribe } = subscribeToJob(result.jobId, {
          onDone: handleJobDone,
          onFailed: handleJobFailed,
        });

        // CRITICAL: Check if job is already done (race condition fix)
        // The Edge Function may complete synchronously before we subscribe
        const existingJob = await fetchJob(result.jobId);
        if (existingJob) {
          if (existingJob.status === 'done') {
            await handleJobDone(existingJob);
          } else if (existingJob.status === 'failed') {
            await handleJobFailed(existingJob);
          }
        }
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
    projectId, documentId, conversationId, models, selectableModels,
    selectedResolution, selectedAspectRatio,
    onAddPlaceholder, onRemovePlaceholder, onGetPlaceholderPosition, onGetFreePosition,
    onOpsGenerated, onGeneratingChange,
    setGenerationPhase, completeGeneration, failGeneration,
    clearPhaseATimeout, handleApiError,
  ]);

  const startOpsGeneration = useCallback(async (ctx: GenerationContext) => {
    const { content, model, pendingMessageId, onPendingReplaced, onCleanup } = ctx;

    if (!model) {
      throw new Error('Ops generation requires a selected model');
    }
    
    abortControllerRef.current = new AbortController();
    
    const currentModelName = selectableModels.find(m => m.value === model)?.displayName
      || models.find(m => m.name === model)?.display_name
      || model;

    // Phase B timer
    phaseATimeoutRef.current = setTimeout(() => {
      setGenerationPhase('phase-b');
    }, 150);

    try {
      // supabase.functions.invoke handles auth automatically, no need to refresh session here

      const result = await generateOps(
        {
          projectId,
          documentId,
          conversationId,
          prompt: content,
          model,
        },
        undefined, // accessToken not needed
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
    projectId, documentId, conversationId, models, selectableModels,
    onGeneratingChange, setGenerationPhase, completeGeneration,
    clearPhaseATimeout, handleApiError,
  ]);

  const startAgentGeneration = useCallback(async (ctx: GenerationContext) => {
    const {
      content,
      model,
      imageModel,
      referencedImage,
      pendingMessageId,
      onPendingUpdated,
      onPendingReplaced,
      onCleanup,
    } = ctx;

    abortControllerRef.current = new AbortController();

    const currentModelName =
      selectableModels.find((entry) => entry.value === model)?.displayName
      || models.find((entry) => entry.name === model)?.display_name
      || model
      || 'Fluxa Agent';
    let pendingState = createInitialAgentPendingState();

    const targetResolution = RESOLUTION_PIXELS[selectedResolution] ?? 1024;
    const placeholderDimensions = calculateDimensions(selectedAspectRatio, targetResolution);
    const activePlaceholders: Array<{ id: string; x: number; y: number }> = [];

    const syncPendingMessage = () => {
      const updates: Partial<Message> = {
        content: pendingState.content,
        metadata: buildAgentPendingMetadata(pendingState, currentModelName, pendingMessageId),
      };

      onPendingUpdated(pendingMessageId, updates);
    };

    const handleAgentEvent = (event: AgentSSEEvent) => {
      if (event.type === 'tool_start' && event.tool === 'generate_image') {
        const placeholderId = `agent-ph-${Date.now()}`;
        const freePosition = onGetFreePosition?.(
          placeholderDimensions.width,
          placeholderDimensions.height,
        );
        const phX = freePosition?.x ?? (100 + Math.floor(Math.random() * 200));
        const phY = freePosition?.y ?? (100 + Math.floor(Math.random() * 200));
        onAddPlaceholder?.(placeholderId, phX, phY, placeholderDimensions.width, placeholderDimensions.height);
        pendingGenerationTracker.registerGeneration(phX, phY);
        activePlaceholders.push({ id: placeholderId, x: phX, y: phY });
      }

      if (event.type === 'tool_result' && event.tool === 'generate_image' && event.imageUrl) {
        const placeholder = activePlaceholders.shift();
        if (placeholder) {
          const imageUrl = event.imageUrl;
          void (async () => {
            const finalPosition = onGetPlaceholderPosition?.(placeholder.id);
            const layerId = `agent-img-${Date.now()}`;
            pendingGenerationTracker.registerLayerId(layerId);

            const addImageOp: AddImageOp = {
              type: 'addImage',
              payload: {
                id: layerId,
                src: imageUrl,
                x: finalPosition?.x ?? placeholder.x,
                y: finalPosition?.y ?? placeholder.y,
                width: placeholderDimensions.width,
                height: placeholderDimensions.height,
                fadeIn: true,
              },
            };

            try {
              console.log('[useGeneration] Executing agent addImage op:', addImageOp.payload.id);
              await onOpsGenerated?.([addImageOp]);
              console.log('[useGeneration] Agent addImage op executed successfully');

              pendingGenerationTracker.unregisterLayerId(layerId);
              pendingGenerationTracker.unregisterGeneration(placeholder.x, placeholder.y);

              await saveOp({
                documentId,
                op: {
                  ...addImageOp,
                  payload: { ...addImageOp.payload, fadeIn: undefined },
                } as Op,
              });

              setTimeout(() => onRemovePlaceholder?.(placeholder.id), 400);
            } catch (error) {
              console.error('[useGeneration] Failed to execute agent addImage flow:', error);
              pendingGenerationTracker.unregisterLayerId(layerId);
              pendingGenerationTracker.unregisterGeneration(placeholder.x, placeholder.y);
              onRemovePlaceholder?.(placeholder.id);
            }
          })();
        }
      }

      pendingState = reduceAgentPendingState(pendingState, event);

      if (event.type !== 'done') {
        syncPendingMessage();
      }
    };

    phaseATimeoutRef.current = setTimeout(() => {
      setGenerationPhase('phase-b');
    }, 150);

    try {
      syncPendingMessage();

      const doneEvent = await generateAgentStream(
        {
          projectId,
          documentId,
          conversationId,
          prompt: content,
          model,
          imageModel,
          aspectRatio: selectedAspectRatio,
          resolution: selectedResolution,
          referenceImageUrl: referencedImage?.url,
        },
        {
          signal: abortControllerRef.current?.signal,
          onEvent: handleAgentEvent,
        },
      );

      clearPhaseATimeout();

      for (const ph of activePlaceholders) {
        pendingGenerationTracker.unregisterGeneration(ph.x, ph.y);
        onRemovePlaceholder?.(ph.id);
      }

      if (!doneEvent?.message) {
        throw new Error('Agent stream ended without a final message');
      }

      onPendingReplaced(
        pendingMessageId,
        mergeAgentFinalMessage(doneEvent.message, pendingState, currentModelName, pendingMessageId),
      );
      completeGeneration();
      onGeneratingChange?.(false);
    } catch (err) {
      clearPhaseATimeout();

      for (const ph of activePlaceholders) {
        pendingGenerationTracker.unregisterGeneration(ph.x, ph.y);
        onRemovePlaceholder?.(ph.id);
      }

      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      if (!handleApiError(err, currentModelName, onCleanup)) {
        throw err;
      }
    }
  }, [
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
    setGenerationPhase,
    completeGeneration,
    clearPhaseATimeout,
    handleApiError,
  ]);

  return {
    phase: generationPhase,
    isGenerating,
    startAgentGeneration,
    startImageGeneration,
    startOpsGeneration,
    stop,
  };
}

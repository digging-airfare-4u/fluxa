/**
 * useOpsExecution Hook
 * Manages OpsExecutor initialization and ops execution
 * Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { OpsExecutor, createOpsExecutor } from '@/lib/canvas/opsExecutor';
import { useLayerStore } from '@/lib/store/useLayerStore';
import type { CanvasStageRef } from '@/components/canvas';
import type { Op } from '@/lib/canvas/ops.types';

export interface UseOpsExecutionOptions {
  documentId: string;
  canvasRef: React.RefObject<CanvasStageRef | null>;
  onOpExecuted?: (op: Op, index: number) => void;
  onError?: (error: Error, op: Op) => void;
}

export interface UseOpsExecutionReturn {
  executeOps: (ops: Op[]) => Promise<void>;
  isReady: boolean;
}

/**
 * Hook for managing ops execution on canvas
 * Handles OpsExecutor initialization and layer store synchronization
 */
export function useOpsExecution({
  documentId,
  canvasRef,
  onOpExecuted,
  onError,
}: UseOpsExecutionOptions): UseOpsExecutionReturn {
  const opsExecutorRef = useRef<OpsExecutor | null>(null);
  const initialOpsLoadedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  
  // Get Layer Store actions
  const { initializeFromOps } = useLayerStore();

  // Initialize OpsExecutor when canvas is ready
  useEffect(() => {
    const checkCanvas = () => {
      if (opsExecutorRef.current) {
        setIsReady(true);
        return true;
      }

      const canvas = canvasRef.current?.getCanvas();
      if (canvas) {
        opsExecutorRef.current = createOpsExecutor({
          canvas,
          onOpExecuted: (op, index) => {
            console.log(`[useOpsExecution] Op executed: ${op.type} at index ${index}`);
            onOpExecuted?.(op, index);
          },
          onError: (error, op) => {
            console.error(`[useOpsExecution] Op error:`, error, op);
            onError?.(error, op);
          },
        });
        setIsReady(true);
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
  }, [canvasRef, onOpExecuted, onError]);

  // Reset when document changes
  useEffect(() => {
    initialOpsLoadedRef.current = false;
  }, [documentId]);

  // Execute ops with synchronizer coordination
  const executeOps = useCallback(async (ops: Op[]) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) {
      console.warn('[useOpsExecution] Canvas not ready');
      return;
    }

    // Ensure executor is initialized with current canvas
    if (!opsExecutorRef.current || opsExecutorRef.current.getCanvas() !== canvas) {
      opsExecutorRef.current = createOpsExecutor({
        canvas,
        onOpExecuted: (op, index) => {
          console.log(`[useOpsExecution] Op executed: ${op.type} at index ${index}`);
          onOpExecuted?.(op, index);
        },
        onError: (error, op) => {
          console.error(`[useOpsExecution] Op error:`, error, op);
          onError?.(error, op);
        },
      });
      setIsReady(true);
    }

    try {
      // Only suppress Canvas->Layer sync during the first replay initialization.
      // After initialization, new ops must flow through synchronizer events
      // so LayerPanel receives newly added/removed objects in real time.
      const synchronizer = canvasRef.current?.getSynchronizer();
      const shouldSuppressSync = !initialOpsLoadedRef.current;
      if (synchronizer && shouldSuppressSync) {
        synchronizer.setUpdating(true);
      }
      
      await opsExecutorRef.current.execute(ops, documentId);
      
      // Reset synchronizer updating mode only if we changed it above
      if (synchronizer && shouldSuppressSync) {
        synchronizer.setUpdating(false);
      }
      
      // Initialize layers from ops on first load
      if (!initialOpsLoadedRef.current && ops.length > 0) {
        initializeFromOps(ops);
        initialOpsLoadedRef.current = true;
        console.log('[useOpsExecution] Layers initialized from ops');
      }
    } catch (error) {
      // Reset synchronizer updating mode on error (safe no-op if already false)
      const synchronizer = canvasRef.current?.getSynchronizer();
      if (synchronizer) {
        synchronizer.setUpdating(false);
      }
      console.error('[useOpsExecution] Failed to execute ops:', error);
      throw error;
    }
  }, [documentId, initializeFromOps, onOpExecuted, onError, canvasRef]);

  return {
    executeOps,
    isReady,
  };
}

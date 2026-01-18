/**
 * Ops Queries
 * Functions for saving canvas operations to the database
 */

import { supabase } from '../client';
import { localOpTracker } from '../../realtime/localOpTracker';
import type { Op, OpType } from '../../canvas/ops.types';

export interface SaveOpParams {
  documentId: string;
  op: Op;
  conversationId?: string;
  /** If true, skip tracking for self-echo prevention (for ops from AI generation) */
  skipLocalTracking?: boolean;
}

/**
 * Save a single op to the database
 */
export async function saveOp({ documentId, op, conversationId, skipLocalTracking }: SaveOpParams): Promise<void> {
  // Mark as locally saved to prevent self-echo from realtime
  if (!skipLocalTracking) {
    localOpTracker.markAsSaved(op);
  }

  const { error } = await supabase
    .from('ops')
    .insert({
      document_id: documentId,
      conversation_id: conversationId || null,
      op_type: op.type as OpType,
      payload: op.payload,
    });

  if (error) {
    console.error('[Ops] Failed to save op:', error);
    throw error;
  }
}

/**
 * Save multiple ops to the database
 */
export async function saveOps(
  documentId: string,
  ops: Op[],
  conversationId?: string,
  skipLocalTracking?: boolean
): Promise<void> {
  // Mark as locally saved to prevent self-echo from realtime
  if (!skipLocalTracking) {
    ops.forEach(op => localOpTracker.markAsSaved(op));
  }

  const records = ops.map(op => ({
    document_id: documentId,
    conversation_id: conversationId || null,
    op_type: op.type as OpType,
    payload: op.payload,
  }));

  const { error } = await supabase
    .from('ops')
    .insert(records);

  if (error) {
    console.error('[Ops] Failed to save ops:', error);
    throw error;
  }
}

/**
 * Create an updateLayer op for position/scale changes
 */
export function createUpdateLayerOp(
  layerId: string,
  properties: {
    left?: number;
    top?: number;
    scaleX?: number;
    scaleY?: number;
    angle?: number;
    width?: number;
    height?: number;
  }
): Op {
  return {
    type: 'updateLayer',
    payload: {
      id: layerId,
      properties,
    },
  };
}

/**
 * Ops Queries
 * Functions for saving canvas operations to the database
 */

import { supabase } from '../client';
import type { Op, OpType } from '../../canvas/ops.types';

export interface SaveOpParams {
  documentId: string;
  op: Op;
  conversationId?: string;
}

/**
 * Save a single op to the database
 */
export async function saveOp({ documentId, op, conversationId }: SaveOpParams): Promise<void> {
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
  conversationId?: string
): Promise<void> {
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

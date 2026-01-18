/**
 * Ops Service Module
 * Handles saving canvas operations to the database
 * Requirements: 9.1 - Ops persistence
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';

/**
 * Op type definition for Edge Functions
 */
export interface Op {
  type: string;
  payload: Record<string, unknown>;
}

/**
 * Ops Service
 * Manages saving canvas operations to the ops table
 */
export class OpsService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Save a single op to the database
   * 
   * @param documentId - Document ID the op belongs to
   * @param op - The operation to save
   * @param conversationId - Optional conversation ID
   * @throws Error if op saving fails
   */
  async saveOp(
    documentId: string,
    op: Op,
    conversationId?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('ops')
      .insert({
        document_id: documentId,
        conversation_id: conversationId || null,
        op_type: op.type,
        payload: op.payload,
      });

    if (error) {
      console.error('[OpsService] Failed to save op:', error);
      throw new Error(`Failed to save op: ${error.message}`);
    }

    console.log(`[OpsService] Op saved: type=${op.type}, documentId=${documentId}`);
  }

  /**
   * Save multiple ops to the database
   * 
   * @param documentId - Document ID the ops belong to
   * @param ops - Array of operations to save
   * @param conversationId - Optional conversation ID
   * @throws Error if ops saving fails
   */
  async saveOps(
    documentId: string,
    ops: Op[],
    conversationId?: string
  ): Promise<void> {
    if (ops.length === 0) return;

    const records = ops.map(op => ({
      document_id: documentId,
      conversation_id: conversationId || null,
      op_type: op.type,
      payload: op.payload,
    }));

    const { error } = await this.supabase
      .from('ops')
      .insert(records);

    if (error) {
      console.error('[OpsService] Failed to save ops:', error);
      throw new Error(`Failed to save ops: ${error.message}`);
    }

    console.log(`[OpsService] ${ops.length} ops saved for documentId=${documentId}`);
  }
}

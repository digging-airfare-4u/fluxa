/**
 * Ops Realtime Subscription
 * Requirements: 14.5, 14.6, 19.1, 19.2
 * 
 * Subscribes to ops table for real-time canvas updates.
 * Implements idempotent execution using seq-based deduplication.
 */

import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { Op, OpType, OpsRecord } from '../canvas/ops.types';

/**
 * Database ops record structure
 */
export interface OpsDbRecord {
  id: string;
  document_id: string;
  conversation_id?: string;
  message_id?: string;
  seq: number;
  op_type: OpType;
  payload: Record<string, unknown>;
  created_at: string;
}

/**
 * Callback types for ops changes
 */
export interface OpsSubscriptionCallbacks {
  onNewOps?: (ops: Op[], records: OpsDbRecord[]) => void;
  onError?: (error: Error) => void;
}

/**
 * Subscription result with cleanup function
 */
export interface OpsSubscription {
  channel: RealtimeChannel;
  unsubscribe: () => Promise<void>;
  getLastSeq: () => number;
  resetSeq: (seq: number) => void;
}

/**
 * Ops deduplication tracker
 * Tracks executed seq numbers to prevent duplicate execution
 * Requirements: 19.1, 19.2
 */
class OpsDeduplicator {
  private executedSeqs: Set<number> = new Set();
  private lastSeq: number = 0;

  /**
   * Check if an op with given seq has already been executed
   */
  hasExecuted(seq: number): boolean {
    return this.executedSeqs.has(seq);
  }

  /**
   * Mark a seq as executed
   */
  markExecuted(seq: number): void {
    this.executedSeqs.add(seq);
    if (seq > this.lastSeq) {
      this.lastSeq = seq;
    }
  }

  /**
   * Get the last executed seq number
   */
  getLastSeq(): number {
    return this.lastSeq;
  }

  /**
   * Reset the deduplicator with a new starting seq
   * Used when reconnecting or loading initial state
   */
  reset(lastSeq: number): void {
    this.executedSeqs.clear();
    this.lastSeq = lastSeq;
    // Mark all seqs up to lastSeq as executed
    for (let i = 1; i <= lastSeq; i++) {
      this.executedSeqs.add(i);
    }
  }

  /**
   * Filter out already executed ops
   */
  filterNew(records: OpsDbRecord[]): OpsDbRecord[] {
    return records.filter(record => !this.hasExecuted(record.seq));
  }
}

/**
 * Convert database record to Op type
 */
function recordToOp(record: OpsDbRecord): Op {
  return {
    type: record.op_type,
    payload: record.payload,
  } as Op;
}

/**
 * Subscribe to ops changes for a specific document
 * 
 * Requirements:
 * - 14.5: Subscribe to ops:document_id=eq.{documentId} for new ops
 * - 14.6: Handle reconnection gracefully
 * - 19.1: Treat ops.seq as idempotent key
 * - 19.2: Deduplicate on reconnect/replay
 * 
 * @param documentId - The document ID to subscribe to
 * @param callbacks - Callback functions for ops events
 * @param initialSeq - Optional initial seq to start from (for reconnection)
 * @returns Subscription object with unsubscribe function
 */
export function subscribeToOps(
  documentId: string,
  callbacks: OpsSubscriptionCallbacks,
  initialSeq: number = 0
): OpsSubscription {
  const channelName = `ops:document_id=eq.${documentId}`;
  const deduplicator = new OpsDeduplicator();
  
  // Initialize with the provided seq
  if (initialSeq > 0) {
    deduplicator.reset(initialSeq);
  }

  // Remove any existing channel with the same name first
  const existingChannel = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
  if (existingChannel) {
    console.log(`[Ops] Removing existing channel: ${channelName}`);
    supabase.removeChannel(existingChannel);
  }

  const channel = supabase
    .channel(channelName)
    .on<OpsDbRecord>(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ops',
        filter: `document_id=eq.${documentId}`,
      },
      (payload: RealtimePostgresChangesPayload<OpsDbRecord>) => {
        handleOpsInsert(payload, deduplicator, callbacks);
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Ops] Subscribed to channel: ${channelName}`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`[Ops] Subscription error:`, err);
        callbacks.onError?.(new Error(`Subscription failed: ${status}`));
      }
    });

  const unsubscribe = async () => {
    console.log(`[Ops] Unsubscribing from channel: ${channelName}`);
    await supabase.removeChannel(channel);
  };

  return {
    channel,
    unsubscribe,
    getLastSeq: () => deduplicator.getLastSeq(),
    resetSeq: (seq: number) => deduplicator.reset(seq),
  };
}

/**
 * Handle ops insert events with deduplication
 */
function handleOpsInsert(
  payload: RealtimePostgresChangesPayload<OpsDbRecord>,
  deduplicator: OpsDeduplicator,
  callbacks: OpsSubscriptionCallbacks
): void {
  const record = payload.new as OpsDbRecord;
  
  if (!record || !record.seq) {
    console.warn('[Ops] Received invalid ops payload:', payload);
    return;
  }

  // Check for duplicate (idempotency)
  if (deduplicator.hasExecuted(record.seq)) {
    console.log(`[Ops] Skipping duplicate op seq=${record.seq}`);
    return;
  }

  // Mark as executed
  deduplicator.markExecuted(record.seq);

  console.log(`[Ops] New op received: seq=${record.seq}, type=${record.op_type}`);

  // Convert to Op and notify
  const op = recordToOp(record);
  callbacks.onNewOps?.([op], [record]);
}

/**
 * Fetch ops for a document, optionally after a specific seq
 * Used for initial load or catching up after reconnection
 * 
 * @param documentId - The document ID
 * @param afterSeq - Optional seq to fetch ops after (exclusive)
 * @returns Array of ops records ordered by seq
 */
export async function fetchOps(
  documentId: string,
  afterSeq?: number
): Promise<OpsDbRecord[]> {
  let query = supabase
    .from('ops')
    .select('*')
    .eq('document_id', documentId)
    .order('seq', { ascending: true });

  if (afterSeq !== undefined && afterSeq > 0) {
    query = query.gt('seq', afterSeq);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Ops] Error fetching ops:', error);
    return [];
  }

  return data as OpsDbRecord[];
}

/**
 * Fetch the latest seq number for a document
 * Used to initialize deduplicator on reconnection
 */
export async function fetchLatestSeq(documentId: string): Promise<number> {
  const { data, error } = await supabase
    .from('ops')
    .select('seq')
    .eq('document_id', documentId)
    .order('seq', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    // No ops yet or error
    if (error.code === 'PGRST116') {
      // No rows found
      return 0;
    }
    console.error('[Ops] Error fetching latest seq:', error);
    return 0;
  }

  return data?.seq ?? 0;
}

/**
 * Convert array of database records to Op array
 */
export function recordsToOps(records: OpsDbRecord[]): Op[] {
  return records.map(recordToOp);
}

/**
 * Create an ops subscription manager that handles reconnection
 * and ensures idempotent execution
 */
export function createOpsSubscriptionManager(
  documentId: string,
  onOpsReceived: (ops: Op[]) => Promise<void>
): {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isConnected: () => boolean;
} {
  let subscription: OpsSubscription | null = null;
  let connected = false;

  const start = async () => {
    // Fetch initial ops and get latest seq
    const latestSeq = await fetchLatestSeq(documentId);
    
    subscription = subscribeToOps(
      documentId,
      {
        onNewOps: async (ops) => {
          try {
            await onOpsReceived(ops);
          } catch (error) {
            console.error('[Ops] Error executing ops:', error);
          }
        },
        onError: (error) => {
          console.error('[Ops] Subscription error:', error);
          connected = false;
          // Attempt reconnection after delay
          setTimeout(() => {
            if (!connected) {
              console.log('[Ops] Attempting reconnection...');
              start();
            }
          }, 5000);
        },
      },
      latestSeq
    );
    
    connected = true;
  };

  const stop = async () => {
    if (subscription) {
      await subscription.unsubscribe();
      subscription = null;
    }
    connected = false;
  };

  const isConnected = () => connected;

  return { start, stop, isConnected };
}

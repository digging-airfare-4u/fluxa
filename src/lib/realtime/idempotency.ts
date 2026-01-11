/**
 * Idempotency and Deduplication Utilities
 * Requirements: 19.1, 19.2, 19.3
 * 
 * Provides utilities for ensuring idempotent execution of ops and jobs.
 */

import { Op } from '../canvas/ops.types';
import { OpsDbRecord } from './subscribeOps';

/**
 * Configuration for retry behavior
 * Requirement 19.3: Job retry boundaries
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Calculate delay for exponential backoff
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, config.maxDelayMs);
}

/**
 * Ops execution tracker for idempotent canvas updates
 * Requirement 19.1: ops.seq as idempotent key
 * Requirement 19.2: Deduplication on reconnect/replay
 */
export class OpsExecutionTracker {
  private documentId: string;
  private executedSeqs: Set<number> = new Set();
  private lastExecutedSeq: number = 0;
  private pendingOps: Map<number, Op> = new Map();

  constructor(documentId: string) {
    this.documentId = documentId;
  }

  /**
   * Initialize tracker with existing ops
   * Call this when loading a document to mark all existing ops as executed
   */
  initializeFromRecords(records: OpsDbRecord[]): void {
    this.executedSeqs.clear();
    this.lastExecutedSeq = 0;

    for (const record of records) {
      this.executedSeqs.add(record.seq);
      if (record.seq > this.lastExecutedSeq) {
        this.lastExecutedSeq = record.seq;
      }
    }

    console.log(`[IdempotencyTracker] Initialized for document ${this.documentId} with ${records.length} ops, lastSeq=${this.lastExecutedSeq}`);
  }

  /**
   * Check if an op should be executed (not a duplicate)
   */
  shouldExecute(seq: number): boolean {
    return !this.executedSeqs.has(seq);
  }

  /**
   * Mark an op as executed
   */
  markExecuted(seq: number): void {
    this.executedSeqs.add(seq);
    if (seq > this.lastExecutedSeq) {
      this.lastExecutedSeq = seq;
    }
    // Remove from pending if present
    this.pendingOps.delete(seq);
  }

  /**
   * Get the last executed seq number
   */
  getLastExecutedSeq(): number {
    return this.lastExecutedSeq;
  }

  /**
   * Filter ops to only include those that haven't been executed
   */
  filterUnexecuted(records: OpsDbRecord[]): OpsDbRecord[] {
    return records.filter(record => this.shouldExecute(record.seq));
  }

  /**
   * Handle out-of-order ops by buffering
   * Returns ops that can be executed in order
   */
  bufferAndGetExecutable(record: OpsDbRecord, op: Op): Op[] {
    const expectedSeq = this.lastExecutedSeq + 1;

    if (record.seq === expectedSeq) {
      // This is the next expected op, execute it and any buffered ops
      const result: Op[] = [op];
      this.markExecuted(record.seq);

      // Check for buffered ops that can now be executed
      let nextSeq = record.seq + 1;
      while (this.pendingOps.has(nextSeq)) {
        const pendingOp = this.pendingOps.get(nextSeq)!;
        result.push(pendingOp);
        this.markExecuted(nextSeq);
        nextSeq++;
      }

      return result;
    } else if (record.seq > expectedSeq) {
      // Out of order, buffer it
      this.pendingOps.set(record.seq, op);
      console.log(`[IdempotencyTracker] Buffered out-of-order op seq=${record.seq}, expected=${expectedSeq}`);
      return [];
    } else {
      // Already executed (duplicate)
      console.log(`[IdempotencyTracker] Skipping duplicate op seq=${record.seq}`);
      return [];
    }
  }

  /**
   * Get count of pending (buffered) ops
   */
  getPendingCount(): number {
    return this.pendingOps.size;
  }

  /**
   * Clear all state
   */
  reset(): void {
    this.executedSeqs.clear();
    this.pendingOps.clear();
    this.lastExecutedSeq = 0;
  }
}

/**
 * Job execution tracker for bounded retries
 * Requirement 19.3: Bounded retries, no duplicate assets/ops
 */
export class JobRetryTracker {
  private jobAttempts: Map<string, number> = new Map();
  private completedJobs: Set<string> = new Set();
  private config: RetryConfig;

  constructor(config: RetryConfig = DEFAULT_RETRY_CONFIG) {
    this.config = config;
  }

  /**
   * Check if a job can be retried
   */
  canRetry(jobId: string): boolean {
    if (this.completedJobs.has(jobId)) {
      return false;
    }
    const attempts = this.jobAttempts.get(jobId) ?? 0;
    return attempts < this.config.maxAttempts;
  }

  /**
   * Record a retry attempt
   * Returns the attempt number (1-based)
   */
  recordAttempt(jobId: string): number {
    const attempts = (this.jobAttempts.get(jobId) ?? 0) + 1;
    this.jobAttempts.set(jobId, attempts);
    return attempts;
  }

  /**
   * Mark a job as completed (success or permanent failure)
   */
  markCompleted(jobId: string): void {
    this.completedJobs.add(jobId);
  }

  /**
   * Check if a job is completed
   */
  isCompleted(jobId: string): boolean {
    return this.completedJobs.has(jobId);
  }

  /**
   * Get the number of attempts for a job
   */
  getAttempts(jobId: string): number {
    return this.jobAttempts.get(jobId) ?? 0;
  }

  /**
   * Get delay before next retry
   */
  getRetryDelay(jobId: string): number {
    const attempts = this.getAttempts(jobId);
    return calculateBackoffDelay(attempts, this.config);
  }

  /**
   * Clear tracking for a specific job
   */
  clearJob(jobId: string): void {
    this.jobAttempts.delete(jobId);
    this.completedJobs.delete(jobId);
  }

  /**
   * Clear all tracking
   */
  reset(): void {
    this.jobAttempts.clear();
    this.completedJobs.clear();
  }
}

/**
 * Idempotency key generator for operations
 */
export function generateIdempotencyKey(
  documentId: string,
  operationType: string,
  uniqueIdentifier: string
): string {
  return `${documentId}:${operationType}:${uniqueIdentifier}`;
}

/**
 * Check if two ops are equivalent (for deduplication)
 */
export function areOpsEquivalent(op1: Op, op2: Op): boolean {
  if (op1.type !== op2.type) {
    return false;
  }
  return JSON.stringify(op1.payload) === JSON.stringify(op2.payload);
}

/**
 * Create a session-scoped idempotency tracker
 * Tracks ops executed in the current session to avoid re-execution
 */
export function createSessionTracker(): {
  hasExecuted: (key: string) => boolean;
  markExecuted: (key: string) => void;
  clear: () => void;
} {
  const executed = new Set<string>();

  return {
    hasExecuted: (key: string) => executed.has(key),
    markExecuted: (key: string) => executed.add(key),
    clear: () => executed.clear(),
  };
}

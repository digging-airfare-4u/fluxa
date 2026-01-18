/**
 * Local Op Tracker
 * Tracks ops saved by this client to prevent self-echo from realtime subscription.
 * 
 * When we save an op, we generate a fingerprint and store it.
 * When we receive an op via realtime, we check if it matches a local fingerprint.
 * If yes, we skip execution since we already applied the change locally.
 */

import type { Op } from '../canvas/ops.types';

/**
 * Generate a fingerprint for an op based on its type and key payload fields.
 * The fingerprint is used to identify ops we've recently saved.
 */
function generateOpFingerprint(op: Op): string {
  const payload = op.payload as Record<string, unknown>;
  
  // For updateLayer ops, use layerId as identifier
  // We only track the layer being updated, not the specific values
  // (since the values might differ slightly due to floating point)
  if (op.type === 'updateLayer' && payload.id) {
    const fingerprint = `updateLayer:${payload.id}`;
    console.log(`[LocalOpTracker] Generated fingerprint for updateLayer: ${fingerprint}`);
    return fingerprint;
  }
  
  // For other ops, use type + id
  if (payload.id) {
    return `${op.type}:${payload.id}`;
  }
  
  // Fallback to JSON stringification for ops without id
  return `${op.type}:${JSON.stringify(payload)}`;
}

/**
 * Local op tracker singleton
 * Tracks ops that this client has recently saved to prevent self-echo.
 */
class LocalOpTracker {
  // Map of fingerprint -> timestamp when it was added
  private pendingOps: Map<string, number> = new Map();
  
  // Time in ms after which a pending op expires (should be longer than typical RTT)
  private static readonly EXPIRY_MS = 5000;
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval to remove expired entries
    if (typeof window !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 2000);
    }
  }

  /**
   * Mark an op as locally saved.
   * Call this when saving an op to the database.
   */
  markAsSaved(op: Op): void {
    const fingerprint = generateOpFingerprint(op);
    this.pendingOps.set(fingerprint, Date.now());
    console.log(`[LocalOpTracker] Marked as saved: ${fingerprint}`);
  }

  /**
   * Check if an op was recently saved by this client.
   * Returns true if this op should be skipped (was locally saved).
   * Note: We don't delete the fingerprint here because multiple realtime
   * events might arrive for the same logical operation.
   */
  wasLocallySaved(op: Op): boolean {
    const fingerprint = generateOpFingerprint(op);
    
    if (this.pendingOps.has(fingerprint)) {
      console.log(`[LocalOpTracker] Skipping self-echo: ${fingerprint}`);
      return true;
    }
    
    return false;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.pendingOps.forEach((timestamp, key) => {
      if (now - timestamp > LocalOpTracker.EXPIRY_MS) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => {
      this.pendingOps.delete(key);
      console.log(`[LocalOpTracker] Expired: ${key}`);
    });
  }

  /**
   * Stop the cleanup interval (for testing/cleanup)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.pendingOps.clear();
  }
}

// Singleton instance
export const localOpTracker = new LocalOpTracker();

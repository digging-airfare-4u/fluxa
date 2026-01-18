/**
 * Pending Generation Tracker
 * Tracks active image generations to prevent Realtime ops from executing
 * before handleJobDone can process them with the correct position.
 * 
 * Flow:
 * 1. When generation starts, register the original position
 * 2. When Realtime receives addImage op, check if position matches a pending generation
 * 3. If yes, skip execution (let handleJobDone handle it with correct position)
 * 4. When handleJobDone completes, unregister the generation
 */

interface PendingGeneration {
  originalX: number;
  originalY: number;
  timestamp: number;
}

/**
 * Pending generation tracker singleton
 * Tracks active generations by their original position
 */
class PendingGenerationTracker {
  // Map of "x,y" -> PendingGeneration
  private pendingByPosition: Map<string, PendingGeneration> = new Map();
  
  // Set of known layer IDs that are being handled by handleJobDone
  private pendingLayerIds: Set<string> = new Set();
  
  // Expiry time for pending generations (5 minutes should be enough for any generation)
  private static readonly EXPIRY_MS = 5 * 60 * 1000;

  /**
   * Register a new pending generation
   * Call this when starting image generation
   */
  registerGeneration(originalX: number, originalY: number): void {
    const key = this.positionKey(originalX, originalY);
    this.pendingByPosition.set(key, {
      originalX,
      originalY,
      timestamp: Date.now(),
    });
    console.log(`[PendingGenerationTracker] Registered: ${key}`);
    this.cleanup();
  }

  /**
   * Register a pending layer ID
   * Call this when handleJobDone starts processing
   */
  registerLayerId(layerId: string): void {
    this.pendingLayerIds.add(layerId);
    console.log(`[PendingGenerationTracker] Registered layer ID: ${layerId}`);
  }

  /**
   * Unregister a generation by position
   * Call this when handleJobDone completes
   */
  unregisterGeneration(originalX: number, originalY: number): void {
    const key = this.positionKey(originalX, originalY);
    this.pendingByPosition.delete(key);
    console.log(`[PendingGenerationTracker] Unregistered: ${key}`);
  }

  /**
   * Unregister a layer ID
   * Call this when handleJobDone completes
   */
  unregisterLayerId(layerId: string): void {
    this.pendingLayerIds.delete(layerId);
    console.log(`[PendingGenerationTracker] Unregistered layer ID: ${layerId}`);
  }

  /**
   * Check if an addImage op should be skipped because it's being handled by handleJobDone
   * Returns true if the op should be skipped
   */
  shouldSkipOp(x: number, y: number, layerId: string): boolean {
    // Check by layer ID first
    if (this.pendingLayerIds.has(layerId)) {
      console.log(`[PendingGenerationTracker] Skipping op for pending layer ID: ${layerId}`);
      return true;
    }

    // Check by position
    const key = this.positionKey(x, y);
    if (this.pendingByPosition.has(key)) {
      console.log(`[PendingGenerationTracker] Skipping op for pending position: ${key}`);
      return true;
    }

    return false;
  }

  /**
   * Check if there are any pending generations
   */
  hasPendingGenerations(): boolean {
    return this.pendingByPosition.size > 0 || this.pendingLayerIds.size > 0;
  }

  /**
   * Create position key for map lookup
   */
  private positionKey(x: number, y: number): string {
    // Round to handle floating point issues
    return `${Math.round(x)},${Math.round(y)}`;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.pendingByPosition.forEach((generation, key) => {
      if (now - generation.timestamp > PendingGenerationTracker.EXPIRY_MS) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => {
      this.pendingByPosition.delete(key);
      console.log(`[PendingGenerationTracker] Expired: ${key}`);
    });
  }

  /**
   * Clear all pending generations (for testing/cleanup)
   */
  clear(): void {
    this.pendingByPosition.clear();
    this.pendingLayerIds.clear();
  }
}

// Singleton instance
export const pendingGenerationTracker = new PendingGenerationTracker();

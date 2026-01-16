/**
 * Points Service Module
 * Handles points calculation, deduction, and balance checking
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import { InsufficientPointsError, PointsError } from '../errors/index.ts';
import type { ResolutionPreset, DeductPointsResult } from '../types/index.ts';

// Re-export types for convenience
export type { DeductPointsResult };

/**
 * Resolution multipliers for points calculation
 * Requirements: 4.6
 */
const RESOLUTION_MULTIPLIERS: Record<ResolutionPreset, number> = {
  '1K': 1.0,
  '2K': 1.5,
  '4K': 2.0,
};

/**
 * Points Service
 * Manages points calculation, deduction, and balance operations
 * Requirements: 4.1
 */
export class PointsService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Calculate points cost for a model and resolution
   * Requirements: 4.2, 4.6
   * 
   * @param modelName - The model name to get base cost for
   * @param resolution - Optional resolution preset (defaults to 1K)
   * @returns Total points cost with resolution multiplier applied
   */
  async calculateCost(
    modelName: string,
    resolution?: ResolutionPreset
  ): Promise<number> {
    const baseCost = await this.getModelBaseCost(modelName);
    const multiplier = this.getResolutionMultiplier(resolution || '1K');
    return Math.ceil(baseCost * multiplier);
  }


  /**
   * Check if user has sufficient balance
   * Requirements: 4.4
   * 
   * @param userId - User ID to check balance for
   * @param requiredAmount - Amount of points required
   * @returns true if user has sufficient balance
   */
  async checkBalance(userId: string, requiredAmount: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('point_balances')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.balance >= requiredAmount;
  }

  /**
   * Deduct points from user balance
   * Requirements: 4.3, 4.5
   * 
   * @param userId - User ID to deduct points from
   * @param amount - Amount of points to deduct
   * @param source - Source of the deduction (e.g., 'generate_image')
   * @param modelName - Model name for tracking
   * @returns Deduction result with transaction details
   * @throws InsufficientPointsError if balance is too low
   * @throws PointsError for other deduction failures
   */
  async deductPoints(
    userId: string,
    amount: number,
    source: string,
    modelName: string
  ): Promise<DeductPointsResult> {
    const { data, error } = await this.supabase.rpc('deduct_points', {
      p_user_id: userId,
      p_amount: amount,
      p_source: source,
      p_reference_id: null,
      p_model_name: modelName,
    });

    if (error) {
      // Check if it's an insufficient points error
      // Requirements: 4.5
      if (error.message?.includes('Insufficient points')) {
        const match = error.message.match(/current_balance=(\d+), required=(\d+)/);
        const currentBalance = match ? parseInt(match[1], 10) : 0;
        const requiredPoints = match ? parseInt(match[2], 10) : amount;

        throw new InsufficientPointsError(
          currentBalance,
          requiredPoints,
          modelName
        );
      }

      throw new PointsError(
        `Points deduction failed: ${error.message}`,
        'DEDUCTION_FAILED'
      );
    }

    return {
      success: true,
      pointsDeducted: data.points_deducted,
      balanceAfter: data.balance_after,
      transactionId: data.transaction_id,
    };
  }

  /**
   * Get model display name for error messages
   * Requirements: 4.3
   * 
   * @param modelName - Internal model name
   * @returns Human-readable display name
   */
  async getModelDisplayName(modelName: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('ai_models')
      .select('display_name')
      .eq('name', modelName)
      .single();

    if (error || !data) {
      return modelName;
    }

    return data.display_name || modelName;
  }

  /**
   * Get base points cost for a model from database
   * 
   * @param modelName - Model name to get cost for
   * @returns Base points cost (defaults to 30 if not found)
   */
  private async getModelBaseCost(modelName: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('get_model_points_cost', {
      p_model_name: modelName,
    });

    if (error) {
      console.error('[PointsService] Error getting model points cost:', error);
      return 30; // Default for image generation models
    }

    return data ?? 30;
  }

  /**
   * Get resolution multiplier for points calculation
   * Requirements: 4.6
   * 
   * @param resolution - Resolution preset
   * @returns Multiplier value (1.0 for 1K, 1.5 for 2K, 2.0 for 4K)
   */
  private getResolutionMultiplier(resolution: ResolutionPreset): number {
    return RESOLUTION_MULTIPLIERS[resolution] || 1.0;
  }
}

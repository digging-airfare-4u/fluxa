/**
 * Points System Type Definitions
 * Requirements: 1.1, 1.3, 1.4 - User points data storage and membership configuration
 */

/**
 * Membership level types
 */
export type MembershipLevel = 'free' | 'pro' | 'team';

/**
 * Transaction type - earn (positive), spend (negative), or adjust (admin correction)
 */
export type TransactionType = 'earn' | 'spend' | 'adjust';

/**
 * Transaction source - where the points change originated
 */
export type TransactionSource =
  | 'registration'
  | 'generate_ops'
  | 'generate_image'
  | 'export'
  | 'admin';

/**
 * User profile with membership and points information
 * Maps to user_profiles table
 */
export interface UserProfile {
  id: string;
  membership_level: MembershipLevel;
  points: number;
  created_at: string;
  updated_at: string;
}

/**
 * Point transaction record
 * Maps to point_transactions table
 */
export interface PointTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  source: TransactionSource;
  reference_id: string | null;
  model_name: string | null;
  balance_after: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Membership configuration
 * Maps to membership_configs table
 */
export interface MembershipConfig {
  level: MembershipLevel;
  display_name: string;
  initial_points: number;
  perks: {
    no_watermark?: boolean;
    priority_queue?: boolean;
  };
}

/**
 * AI model with points cost configuration
 * Extends existing AIModel with points_cost field
 */
export interface AIModelWithCost {
  id: string;
  name: string;
  display_name: string;
  provider: string;
  points_cost: number;
  is_enabled: boolean;
}

/**
 * Points summary returned by get_user_points_summary RPC
 */
export interface PointsSummary {
  points: number;
  membership_level: MembershipLevel;
  today_spent: number;
  today_earned: number;
}

/**
 * Result from deduct_points RPC function
 */
export interface DeductPointsResult {
  success: boolean;
  points_deducted: number;
  balance_after: number;
  transaction_id: string;
}

/**
 * Error response when user has insufficient points
 */
export interface InsufficientPointsError {
  code: 'INSUFFICIENT_POINTS';
  current_balance: number;
  required_points: number;
  model_name: string;
  membership_level: MembershipLevel;
}

/**
 * Response from get-points Edge Function
 */
export interface GetPointsResponse {
  points: number;
  membership_level: MembershipLevel;
  today_spent: number;
  transactions: PointTransaction[];
}

/**
 * Input for creating a point transaction
 */
export interface CreateTransactionInput {
  user_id: string;
  type: TransactionType;
  amount: number;
  source: TransactionSource;
  reference_id?: string;
  model_name?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Pagination parameters for transaction history
 */
export interface TransactionQueryParams {
  page?: number;
  pageSize?: number;
  type?: TransactionType | 'all';
}

/**
 * Paginated transaction history response
 */
export interface PaginatedTransactions {
  transactions: PointTransaction[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

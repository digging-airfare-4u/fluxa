/**
 * Get Points Edge Function
 * Returns user's points balance, membership level, and recent transactions
 * Requirements: 3.1, 3.4
 *
 * GET /functions/v1/get-points
 */

import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Error codes
const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Points summary from RPC
 */
interface PointsSummary {
  points: number;
  membership_level: string;
  today_spent: number;
  today_earned: number;
}

/**
 * Transaction record
 */
interface PointTransaction {
  id: string;
  type: 'earn' | 'spend' | 'adjust';
  amount: number;
  source: string;
  model_name: string | null;
  balance_after: number;
  created_at: string;
}

/**
 * Response format
 */
interface GetPointsResponse {
  points: number;
  membership_level: string;
  today_spent: number;
  today_earned: number;
  transactions: PointTransaction[];
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow GET
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({
          error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Method not allowed' },
        }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: { code: ERROR_CODES.UNAUTHORIZED, message: 'Missing authorization header' },
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: { code: ERROR_CODES.UNAUTHORIZED, message: 'Invalid authorization' },
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call get_user_points_summary RPC
    const { data: summaryData, error: summaryError } = await supabase.rpc(
      'get_user_points_summary',
      { p_user_id: user.id }
    );

    if (summaryError) {
      // Check if it's a profile not found error
      if (summaryError.message?.includes('User profile not found')) {
        return new Response(
          JSON.stringify({
            error: {
              code: ERROR_CODES.PROFILE_NOT_FOUND,
              message: '用户信息未找到，请重新登录',
            },
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Failed to get points summary: ${summaryError.message}`);
    }

    const summary = summaryData as PointsSummary;

    // Fetch recent transactions (last 10)
    const { data: transactionsData, error: transactionsError } = await supabase
      .from('point_transactions')
      .select('id, type, amount, source, model_name, balance_after, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (transactionsError) {
      throw new Error(`Failed to fetch transactions: ${transactionsError.message}`);
    }

    const transactions = (transactionsData || []) as PointTransaction[];

    // Build response
    const response: GetPointsResponse = {
      points: summary.points,
      membership_level: summary.membership_level,
      today_spent: summary.today_spent,
      today_earned: summary.today_earned,
      transactions,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-points:', error);
    return new Response(
      JSON.stringify({
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

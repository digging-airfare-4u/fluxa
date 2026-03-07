import { createServiceClient } from '@/lib/supabase/server';

async function main() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('payment_orders')
    .select('order_no, provider, status, amount_fen, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`Failed to export reconciliation data: ${error.message}`);
  }

  process.stdout.write(`${JSON.stringify({ generated_at: new Date().toISOString(), orders: data || [] }, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

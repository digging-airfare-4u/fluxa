import { createServiceClient } from '@/lib/supabase/server';

async function main() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('payment_orders')
    .select('order_no, status, expires_at')
    .in('status', ['created', 'pending'])
    .order('created_at', { ascending: true })
    .limit(300);

  if (error) {
    throw new Error(`Failed to query pending orders: ${error.message}`);
  }

  let expired = 0;
  for (const order of data || []) {
    const { data: changed, error: rpcError } = await supabase.rpc('payment_mark_order_expired', {
      p_order_no: order.order_no,
    });

    if (rpcError) {
      throw new Error(`Failed to expire order ${order.order_no}: ${rpcError.message}`);
    }

    if (changed === true) expired += 1;
  }

  process.stdout.write(`${JSON.stringify({ checked: (data || []).length, expired }, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

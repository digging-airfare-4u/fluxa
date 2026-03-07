import { createServiceClient } from '@/lib/supabase/server';

interface CliArgs {
  orderNo: string;
  reason: string;
  amountFen?: number;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    map.set(argv[i], argv[i + 1] || '');
  }

  const orderNo = map.get('--order-no') || '';
  const reason = map.get('--reason') || 'manual_refund';
  const amountFenRaw = map.get('--amount-fen');
  const amountFen = amountFenRaw ? Number(amountFenRaw) : undefined;

  if (!orderNo) {
    throw new Error('Usage: tsx scripts/payments/refund-order.ts --order-no <ORDER_NO> [--reason <reason>] [--amount-fen <amount>]');
  }

  return { orderNo, reason, amountFen };
}

async function main() {
  const { orderNo, reason, amountFen } = parseArgs();
  const supabase = createServiceClient();

  const { data: order, error: orderError } = await supabase
    .from('payment_orders')
    .select('id, order_no, provider, provider_transaction_id, amount_fen, status')
    .eq('order_no', orderNo)
    .single();

  if (orderError || !order) {
    throw new Error(`Order not found: ${orderNo}`);
  }
  if (order.status !== 'paid') {
    throw new Error(`Only paid orders can be refunded. Current status: ${order.status}`);
  }

  const refundNo = `RF${Date.now().toString(36).toUpperCase()}`;
  const finalAmount = amountFen ?? Number(order.amount_fen || 0);

  const { error: insertError } = await supabase.from('payment_refunds').insert({
    order_id: order.id,
    refund_no: refundNo,
    amount_fen: finalAmount,
    status: 'requested',
    reason,
    metadata: {
      provider: order.provider,
      provider_transaction_id: order.provider_transaction_id,
      manual: true,
    },
  });

  if (insertError) {
    throw new Error(`Failed to create refund record: ${insertError.message}`);
  }

  process.stdout.write(`${JSON.stringify({ refund_no: refundNo, order_no: order.order_no, amount_fen: finalAmount, status: 'requested' }, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

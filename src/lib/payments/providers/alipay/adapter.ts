import type {
  PaymentProviderAdapter,
  ProviderCreateOrderInput,
  ProviderCreateOrderResult,
  ProviderVerifyWebhookInput,
  VerifiedWebhookPayload,
} from '@/lib/payments/types';

function getAlipayConfig(mode: 'sandbox' | 'production') {
  const prefix = mode === 'production' ? 'ALIPAY_PROD' : 'ALIPAY_SANDBOX';
  return {
    appId: process.env[`${prefix}_APP_ID`] || '',
    gateway: process.env[`${prefix}_GATEWAY`] || '',
    notifyPublicKey: process.env[`${prefix}_PUBLIC_KEY`] || '',
    privateKey: process.env[`${prefix}_PRIVATE_KEY`] || '',
  };
}

function requireAlipayConfig(mode: 'sandbox' | 'production') {
  const cfg = getAlipayConfig(mode);
  if (!cfg.appId || !cfg.gateway || !cfg.privateKey || !cfg.notifyPublicKey) {
    throw new Error(`ALIPAY_CONFIG_MISSING:${mode}`);
  }
  return cfg;
}

export const alipayAdapter: PaymentProviderAdapter = {
  name: 'alipay',

  async createOrder(input: ProviderCreateOrderInput): Promise<ProviderCreateOrderResult> {
    requireAlipayConfig(input.mode);

    const mockedOrderId = `ali_${input.orderNo}`;
    const paymentUrl = `${input.mode === 'production' ? 'https://openapi.alipay.com' : 'https://openapi.alipaydev.com'}/gateway.do?out_trade_no=${encodeURIComponent(input.orderNo)}`;

    return {
      providerOrderId: mockedOrderId,
      paymentUrl,
      formHtml: undefined,
      channelType: 'redirect',
      raw: {
        mocked: true,
        subject: input.subject,
      },
    };
  },

  async verifyWebhook(input: ProviderVerifyWebhookInput): Promise<VerifiedWebhookPayload> {
    requireAlipayConfig(input.mode);

    const params = new URLSearchParams(input.body);
    const eventId = params.get('notify_id') || `ali_notify_${Date.now()}`;
    const orderNo = params.get('out_trade_no') || '';
    const transactionId = params.get('trade_no') || undefined;
    const amountStr = params.get('total_amount') || '0';

    if (!orderNo) throw new Error('ALIPAY_INVALID_PAYLOAD:missing_order_no');

    const amountFen = Math.round(Number(amountStr) * 100);
    if (!Number.isFinite(amountFen) || amountFen <= 0) {
      throw new Error('ALIPAY_INVALID_PAYLOAD:invalid_amount');
    }

    return {
      providerEventId: eventId,
      orderNo,
      transactionId,
      amountFen,
      paidAt: params.get('gmt_payment') || undefined,
      raw: Object.fromEntries(params.entries()),
    };
  },
};

import type {
  PaymentProviderAdapter,
  ProviderCreateOrderInput,
  ProviderCreateOrderResult,
  ProviderVerifyWebhookInput,
  VerifiedWebhookPayload,
} from '@/lib/payments/types';

function getWechatConfig(mode: 'sandbox' | 'production') {
  const prefix = mode === 'production' ? 'WECHAT_PROD' : 'WECHAT_SANDBOX';
  return {
    mchId: process.env[`${prefix}_MCH_ID`] || '',
    appId: process.env[`${prefix}_APP_ID`] || '',
    apiV3Key: process.env[`${prefix}_API_V3_KEY`] || '',
    privateKey: process.env[`${prefix}_PRIVATE_KEY`] || '',
    certSerialNo: process.env[`${prefix}_CERT_SERIAL_NO`] || '',
  };
}

function requireWechatConfig(mode: 'sandbox' | 'production') {
  const cfg = getWechatConfig(mode);
  if (!cfg.mchId || !cfg.apiV3Key || !cfg.privateKey || !cfg.certSerialNo) {
    throw new Error(`WECHAT_CONFIG_MISSING:${mode}`);
  }
  return cfg;
}

export const wechatAdapter: PaymentProviderAdapter = {
  name: 'wechat',

  async createOrder(input: ProviderCreateOrderInput): Promise<ProviderCreateOrderResult> {
    requireWechatConfig(input.mode);

    const mockedOrderId = `wx_${input.orderNo}`;
    const scene = (input.metadata?.scene as string | undefined) || 'web';

    if (scene === 'wechat_in_app') {
      const nonceStr = Math.random().toString(36).slice(2, 12);
      const timeStamp = Math.floor(Date.now() / 1000).toString();
      const prepayId = `prepay_${input.orderNo}`;

      return {
        providerOrderId: mockedOrderId,
        channelType: 'jsapi',
        jsapiPayload: {
          appId: getWechatConfig(input.mode).appId,
          timeStamp,
          nonceStr,
          package: `prepay_id=${prepayId}`,
          signType: 'RSA',
          paySign: `mock_sign_${input.orderNo}`,
        },
        raw: {
          mocked: true,
          subject: input.subject,
          jsapi: true,
          prepay_id: prepayId,
        },
      };
    }

    const qrCodeUrl = `weixin://wxpay/bizpayurl?pr=${encodeURIComponent(input.orderNo)}`;

    return {
      providerOrderId: mockedOrderId,
      qrCodeUrl,
      channelType: 'native_qr',
      raw: {
        mocked: true,
        subject: input.subject,
      },
    };
  },

  async verifyWebhook(input: ProviderVerifyWebhookInput): Promise<VerifiedWebhookPayload> {
    requireWechatConfig(input.mode);

    const parsed = JSON.parse(input.body || '{}') as Record<string, unknown>;
    const eventId = (parsed.id as string) || `wx_notify_${Date.now()}`;
    const resource = (parsed.resource as Record<string, unknown>) || {};
    const mocked = (resource.mocked as Record<string, unknown>) || parsed;

    const orderNo = (mocked.out_trade_no as string) || '';
    const transactionId = (mocked.transaction_id as string) || undefined;
    const amountFen = Number(
      (mocked.amount as Record<string, unknown> | undefined)?.total ?? mocked.total ?? 0,
    );

    if (!orderNo) throw new Error('WECHAT_INVALID_PAYLOAD:missing_order_no');
    if (!Number.isFinite(amountFen) || amountFen <= 0) throw new Error('WECHAT_INVALID_PAYLOAD:invalid_amount');

    return {
      providerEventId: eventId,
      orderNo,
      transactionId,
      amountFen,
      paidAt: (mocked.success_time as string) || undefined,
      raw: parsed,
    };
  },
};

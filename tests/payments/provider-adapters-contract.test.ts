import { describe, expect, it, vi } from 'vitest';
import { alipayAdapter } from '@/lib/payments/providers/alipay/adapter';
import { wechatAdapter } from '@/lib/payments/providers/wechat/adapter';

describe('cn-web-payments provider adapters contract', () => {
  it('parses alipay webhook payload into normalized fields', async () => {
    vi.stubEnv('ALIPAY_SANDBOX_APP_ID', 'sandbox-app');
    vi.stubEnv('ALIPAY_SANDBOX_GATEWAY', 'https://openapi.alipaydev.com/gateway.do');
    vi.stubEnv('ALIPAY_SANDBOX_PUBLIC_KEY', 'public-key');
    vi.stubEnv('ALIPAY_SANDBOX_PRIVATE_KEY', 'private-key');

    const payload = await alipayAdapter.verifyWebhook({
      mode: 'sandbox',
      headers: {},
      body: 'notify_id=evt-1&out_trade_no=PO123&trade_no=ALI_TXN_1&total_amount=12.34',
    });

    expect(payload.providerEventId).toBe('evt-1');
    expect(payload.orderNo).toBe('PO123');
    expect(payload.transactionId).toBe('ALI_TXN_1');
    expect(payload.amountFen).toBe(1234);

    vi.unstubAllEnvs();
  });

  it('parses wechat webhook payload into normalized fields', async () => {
    vi.stubEnv('WECHAT_SANDBOX_MCH_ID', 'mch-id');
    vi.stubEnv('WECHAT_SANDBOX_APP_ID', 'app-id');
    vi.stubEnv('WECHAT_SANDBOX_API_V3_KEY', 'api-v3-key');
    vi.stubEnv('WECHAT_SANDBOX_PRIVATE_KEY', 'private-key');
    vi.stubEnv('WECHAT_SANDBOX_CERT_SERIAL_NO', 'serial-no');

    const payload = await wechatAdapter.verifyWebhook({
      mode: 'sandbox',
      headers: {},
      body: JSON.stringify({
        id: 'wx-evt-1',
        resource: {
          mocked: {
            out_trade_no: 'PO456',
            transaction_id: 'WX_TXN_1',
            amount: { total: 2000 },
          },
        },
      }),
    });

    expect(payload.providerEventId).toBe('wx-evt-1');
    expect(payload.orderNo).toBe('PO456');
    expect(payload.transactionId).toBe('WX_TXN_1');
    expect(payload.amountFen).toBe(2000);

    const jsapiOrder = await wechatAdapter.createOrder({
      orderNo: 'POJSAPI',
      amountFen: 100,
      subject: 'Pro',
      notifyUrl: '/api/payments/notify/wechat',
      mode: 'sandbox',
      metadata: { scene: 'wechat_in_app' },
    });

    expect(jsapiOrder.channelType).toBe('jsapi');
    expect(jsapiOrder.jsapiPayload).toMatchObject({
      appId: 'app-id',
      signType: 'RSA',
    });
    expect(jsapiOrder.jsapiPayload?.package).toContain('prepay_id=');
    expect(jsapiOrder.raw).toMatchObject({ jsapi: true });

    vi.unstubAllEnvs();
  });
});

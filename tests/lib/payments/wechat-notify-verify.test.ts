import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WechatNativeAdapter } from '@/lib/payments/adapters/wechat';

const MINIMAL_CONFIG = {
  appId: 'wx-app-id',
  mchId: 'mch-id',
  apiV3Key: '0123456789abcdef0123456789abcdef',
  privateKey: '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----',
  serialNo: 'serial-no',
  platformPublicKey: '-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----',
  notifyUrl: 'https://example.com/api/payments/notify/wechat',
};

describe('wechat notification verification hardening', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns invalid when required WeChat headers are missing', async () => {
    const adapter = new WechatNativeAdapter(MINIMAL_CONFIG);
    const result = await adapter.verifyNotification('{}', {});

    expect(result.valid).toBe(false);
    expect(result.order_no).toBeNull();
  });

  it('returns invalid when timestamp is outside replay window', async () => {
    const adapter = new WechatNativeAdapter(MINIMAL_CONFIG);
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 60 * 60);

    const result = await adapter.verifyNotification(
      '{}',
      {
        'wechatpay-timestamp': oldTimestamp,
        'wechatpay-nonce': 'nonce',
        'wechatpay-signature': 'sig',
        'wechatpay-serial': 'serial',
      },
    );

    expect(result.valid).toBe(false);
    expect(result.order_no).toBeNull();
  });

  it('returns invalid when signature verification fails', async () => {
    const adapter = new WechatNativeAdapter(MINIMAL_CONFIG);

    const verifySpy = vi.spyOn(crypto, 'createVerify');
    verifySpy.mockReturnValue({
      update: vi.fn(),
      verify: vi.fn(() => false),
    } as never);

    const result = await adapter.verifyNotification(
      '{}',
      {
        'wechatpay-timestamp': String(Math.floor(Date.now() / 1000)),
        'wechatpay-nonce': 'nonce',
        'wechatpay-signature': 'sig',
        'wechatpay-serial': 'serial',
      },
    );

    expect(result.valid).toBe(false);
    expect(result.order_no).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { getAvailableChannels } from '@/lib/payments/channels';
import type { CheckoutScene } from '@/lib/payments/types';

function createServiceClientWithSetting(value: unknown) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { value }, error: null }),
        }),
      }),
    }),
  } as never;
}

describe('payment channels config compatibility', () => {
  it('filters enabled channel config by checkout scene', async () => {
    const sc = createServiceClientWithSetting({
      alipay_page: {
        enabled: true,
        label: '支付宝',
        label_en: 'Alipay',
        scenes: ['desktop', 'mobile_browser'],
      },
      wechat_native: {
        enabled: true,
        label: '微信支付',
        label_en: 'WeChat Pay',
        scenes: ['desktop'],
      },
      wechat_jsapi: {
        enabled: false,
        label: '微信支付(公众号)',
        label_en: 'WeChat JSAPI',
        scenes: ['wechat_browser'],
      },
      unionpay: {
        enabled: false,
        label: '银联支付',
        label_en: 'UnionPay',
        scenes: ['desktop', 'mobile_browser'],
      },
    });

    const result = await getAvailableChannels(sc, 'desktop');

    expect(result.scene).toBe('desktop');
    expect(result.channels.map((c) => c.channel)).toEqual(['alipay_page', 'wechat_native']);
  });

  it('maps legacy provider-level config into channel-level availability', async () => {
    const sc = createServiceClientWithSetting({
      alipay: { enabled: true, mode: 'sandbox' },
      wechat: { enabled: true, mode: 'sandbox' },
      unionpay: { enabled: false },
    });

    const run = async (scene: CheckoutScene) => getAvailableChannels(sc, scene);

    await expect(run('desktop')).resolves.toEqual({
      scene: 'desktop',
      channels: [
        { channel: 'alipay_page', label: '支付宝', label_en: 'Alipay' },
        { channel: 'wechat_native', label: '微信支付', label_en: 'WeChat Pay' },
      ],
    });

    await expect(run('mobile_browser')).resolves.toEqual({
      scene: 'mobile_browser',
      channels: [{ channel: 'alipay_page', label: '支付宝', label_en: 'Alipay' }],
    });

    await expect(run('wechat_browser')).resolves.toEqual({
      scene: 'wechat_browser',
      channels: [{ channel: 'wechat_jsapi', label: '微信支付(公众号)', label_en: 'WeChat JSAPI' }],
    });
  });
});

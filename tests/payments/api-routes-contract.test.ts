import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('cn-web-payments api route contracts', () => {
  it('defines checkout route auth, scene resolution, and error mapping', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/payments/checkout/route.ts'),
      'utf8',
    );

    expect(source).toContain("getUserFromAuthHeader(request.headers.get('authorization'))");
    expect(source).toContain('resolveScene(body.scene, ua)');
    expect(source).toContain("code: 'INVALID_REQUEST'");
    expect(source).toContain("code: 'UNAUTHORIZED'");
    expect(source).toContain("code: 'INTERNAL_ERROR'");
    expect(source).toContain('if (err instanceof PaymentOrderError)');
  });

  it('defines order status route auth and ownership guard', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/payments/orders/[orderNo]/route.ts'),
      'utf8',
    );

    expect(source).toContain("getUserFromAuthHeader(request.headers.get('authorization'))");
    expect(source).toContain('getOrderByNo(sc, orderNo)');
    expect(source).toContain("code: 'INVALID_REQUEST'");
    expect(source).toContain("code: 'UNAUTHORIZED'");
    expect(source).toContain("code: 'ORDER_NOT_FOUND'");
    expect(source).toContain("code: 'INTERNAL_ERROR'");
  });

  it('defines channels route scene-aware contract', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/payments/channels/route.ts'),
      'utf8',
    );

    expect(source).toContain("request.nextUrl.searchParams.get('scene')");
    expect(source).toContain('resolveScene(sceneHint, ua)');
    expect(source).toContain('getAvailableChannels(sc, scene)');
  });

  it('defines notify routes that delegate dedupe and persistence to RPC', () => {
    const alipay = readFileSync(
      resolve(process.cwd(), 'src/app/api/payments/notify/alipay/route.ts'),
      'utf8',
    );
    const wechat = readFileSync(
      resolve(process.cwd(), 'src/app/api/payments/notify/wechat/route.ts'),
      'utf8',
    );

    expect(alipay).toContain('const providerEventId = String(verification.parsed_data.notify_id ?? correlationId)');
    expect(alipay).toContain('fulfillOrder(sc, order, providerEventId, {');
    expect(alipay).toContain('verified: verification.valid');

    expect(wechat).toContain("const providerEventId = String(verification.parsed_data.transaction_id ?? correlationId)");
    expect(wechat).toContain('fulfillOrder(sc, order, providerEventId, {');
    expect(wechat).toContain("signature: request.headers.get('wechatpay-signature')");
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('checkout dialog contract', () => {
  it('loads channels from backend and renders dynamic options', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/pricing/CheckoutDialog.tsx'),
      'utf8',
    );

    expect(source).toContain("fetch('/api/payments/channels')");
    expect(source).toContain('setChannels(data.channels ?? [])');
    expect(source).toContain('channels.map((ch) =>');
  });

  it('submits checkout payload and handles jsapi channel flow', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/pricing/CheckoutDialog.tsx'),
      'utf8',
    );

    expect(source).toContain("fetch('/api/payments/checkout', {");
    expect(source).toContain('body: JSON.stringify({ product_code: productCode, channel })');
    expect(source).toContain("data.channel_data?.type === 'jsapi'");
    expect(source).toContain('startPolling(data.order_no)');
  });
});

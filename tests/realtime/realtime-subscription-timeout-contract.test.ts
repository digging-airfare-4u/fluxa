import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('realtime subscription timeout contract', () => {
  it('handles ops timeouts separately from channel errors', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/realtime/subscribeOps.ts'),
      'utf8',
    );

    expect(source).toContain("} else if (status === 'TIMED_OUT') {");
    expect(source).toContain("console.warn('[Ops] Subscription timed out for channel:', channelName);");
    expect(source).toContain("callbacks.onError?.(new Error('Subscription timed out'));");
    expect(source).toContain("} else if (status === 'CHANNEL_ERROR') {");
    expect(source).toContain("callbacks.onError?.(err ?? new Error(`Subscription failed: ${status}`));");
    expect(source).not.toContain("status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'");
  });

  it('handles jobs timeouts separately for project and single-job subscriptions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/realtime/subscribeJobs.ts'),
      'utf8',
    );

    expect(source).toContain("} else if (status === 'TIMED_OUT') {");
    expect(source).toContain("console.warn('[Jobs] Subscription timed out for channel:', channelName);");
    expect(source).toContain("console.warn('[Jobs] Job subscription timed out:', jobId);");
    expect(source).toContain("callbacks.onError?.(new Error('Subscription timed out'));");
    expect(source).toContain("callbacks.onError?.(new Error('Job subscription timed out'));");
    expect(source).toContain("} else if (status === 'CHANNEL_ERROR') {");
    expect(source).toContain("callbacks.onError?.(err ?? new Error(`Subscription failed: ${status}`));");
    expect(source).toContain("callbacks.onError?.(err ?? new Error(`Job subscription failed: ${status}`));");
    expect(source).not.toContain("status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'");
  });
});

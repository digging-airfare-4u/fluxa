import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/payments/cron/route';
import { getServiceClient } from '@/lib/supabase/server';
import { expirePendingOrders } from '@/lib/payments/jobs/expire-orders';
import { queryPendingOrders } from '@/lib/payments/jobs/query-pending';

vi.mock('@/lib/supabase/server', () => ({
  getServiceClient: vi.fn(),
}));

vi.mock('@/lib/payments/jobs/expire-orders', () => ({
  expirePendingOrders: vi.fn(),
}));

vi.mock('@/lib/payments/jobs/query-pending', () => ({
  queryPendingOrders: vi.fn(),
}));

const getServiceClientMock = vi.mocked(getServiceClient);
const expirePendingOrdersMock = vi.mocked(expirePendingOrders);
const queryPendingOrdersMock = vi.mocked(queryPendingOrders);

describe('POST /api/payments/cron auth behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    getServiceClientMock.mockReturnValue({} as never);
    expirePendingOrdersMock.mockResolvedValue({ expired: 0 } as never);
    queryPendingOrdersMock.mockResolvedValue({ queried: 0, settled: 0 } as never);
  });

  it('rejects query param secret and only accepts x-cron-secret header', async () => {
    const request = new NextRequest('http://localhost/api/payments/cron?secret=test-secret', {
      method: 'POST',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid cron secret',
      },
    });
    expect(expirePendingOrdersMock).not.toHaveBeenCalled();
    expect(queryPendingOrdersMock).not.toHaveBeenCalled();
  });
});

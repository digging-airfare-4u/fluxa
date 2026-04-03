import { beforeEach, describe, expect, it, vi } from 'vitest';

type SubscribeStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT';

let subscribeCallback: ((status: SubscribeStatus, err?: Error) => void) | null = null;

const channelMock = vi.fn();
const removeChannelMock = vi.fn();
const getSessionMock = vi.fn();
const invokeMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    channel: channelMock,
    removeChannel: removeChannelMock,
    auth: {
      getSession: getSessionMock,
    },
    functions: {
      invoke: invokeMock,
    },
  },
}));

describe('points store realtime subscription', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    subscribeCallback = null;

    const mockChannel = {
      on: vi.fn(() => mockChannel),
      subscribe: vi.fn((callback: (status: SubscribeStatus, err?: Error) => void) => {
        subscribeCallback = callback;
        return mockChannel;
      }),
    };

    channelMock.mockReturnValue(mockChannel);
    removeChannelMock.mockResolvedValue(undefined);
  });

  it('treats timed out subscriptions as warnings without logging an undefined error object', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { usePointsStore } = await import('@/lib/store/usePointsStore');

    usePointsStore.getState().reset();
    usePointsStore.getState().subscribeToChanges('user-1');
    subscribeCallback?.('TIMED_OUT');

    expect(warnSpy).toHaveBeenCalledWith(
      '[PointsStore] Subscription timed out for channel:',
      'user_profiles:id=eq.user-1',
    );
    expect(errorSpy).not.toHaveBeenCalledWith('[PointsStore] Subscription error:', undefined);
    expect(usePointsStore.getState().error).toBeNull();
  });

  it('keeps channel errors actionable when Supabase provides an error object', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { usePointsStore } = await import('@/lib/store/usePointsStore');
    const realtimeError = new Error('socket join failed');

    usePointsStore.getState().reset();
    usePointsStore.getState().subscribeToChanges('user-1');
    subscribeCallback?.('CHANNEL_ERROR', realtimeError);

    expect(errorSpy).toHaveBeenCalledWith('[PointsStore] Subscription error:', realtimeError);
    expect(usePointsStore.getState().error).toBe('Failed to subscribe to points updates');
  });
});

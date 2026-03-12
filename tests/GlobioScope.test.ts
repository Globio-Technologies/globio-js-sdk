import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobioClient } from '../src/GlobioClient';
import { GlobioScope } from '../src/modules/GlobioScope';

function mockJsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): void {
  vi.mocked(fetch).mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe('GlobioScope', () => {
  let scope: GlobioScope;

  beforeEach(() => {
    vi.useFakeTimers();
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    scope = new GlobioScope(client);
  });

  it('track() queues an event without sending a request', () => {
    scope.track('session_start', { platform: 'ios' });

    expect(scope.getQueueLength()).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('flush() sends POST /scope/track/batch with event payloads only', async () => {
    mockJsonResponse({ success: true, tracked: 1 });

    scope.track('session_start', { platform: 'ios' });
    await scope.flush();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/scope/scope/track/batch',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          events: [
            {
              event_name: 'session_start',
              properties: { platform: 'ios' },
              user_id: undefined,
            },
          ],
        }),
      }),
    );
  });

  it('createFunnel() sends steps as a string array', async () => {
    mockJsonResponse({
      data: {
        id: 'funnel-1',
        name: 'Onboarding',
        steps: '["session_start","tutorial_complete"]',
        conversion_window_hours: 24,
        created_at: 1700000000,
      },
    });

    await scope.createFunnel('Onboarding', ['session_start', 'tutorial_complete'], 24);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/scope/scope/funnels',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Onboarding',
          steps: ['session_start', 'tutorial_complete'],
          conversion_window_hours: 24,
        }),
      }),
    );
  });

  it('createFunnel() returns steps as a parsed array, not a string', async () => {
    mockJsonResponse({
      data: {
        id: 'funnel-1',
        name: 'Onboarding',
        steps: '["session_start","tutorial_complete"]',
        conversion_window_hours: 24,
        created_at: 1700000000,
      },
    });

    const result = await scope.createFunnel('Onboarding', ['session_start', 'tutorial_complete'], 24);

    expect(result).toEqual({
      success: true,
      data: {
        id: 'funnel-1',
        name: 'Onboarding',
        steps: ['session_start', 'tutorial_complete'],
        conversion_window_hours: 24,
        created_at: 1700000000,
      },
    });
  });

  it('getFunnelData() returns array of step objects', async () => {
    mockJsonResponse({
      data: [
        { step: 'session_start', users: 100, conversion_rate: 100 },
        { step: 'tutorial_complete', users: 42, conversion_rate: 42 },
      ],
    });

    const result = await scope.getFunnelData('funnel-1');

    expect(result).toEqual({
      success: true,
      data: [
        { step: 'session_start', users: 100, conversion_rate: 100 },
        { step: 'tutorial_complete', users: 42, conversion_rate: 42 },
      ],
    });
  });

  it('createDashboard() returns widgets as a parsed array, not a string', async () => {
    mockJsonResponse({
      data: {
        id: 'dashboard-1',
        name: 'Live Ops',
        widgets: '[]',
        created_at: 1700000000,
        updated_at: 1700000001,
      },
    });

    const result = await scope.createDashboard('Live Ops');

    expect(result).toEqual({
      success: true,
      data: {
        id: 'dashboard-1',
        name: 'Live Ops',
        widgets: [],
        created_at: 1700000000,
        updated_at: 1700000001,
      },
    });
  });

  it('flush() failure requeues events and schedules retry', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockJsonResponse({ error: 'temporary failure', code: 'BAD_REQUEST' }, false, 400);

    scope.track('session_start', { platform: 'ios' });
    await scope.flush();

    expect(scope.getQueueLength()).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith('GlobalScope flush failed:', 'temporary failure');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it('getMetrics() calls GET /scope/metrics/dau', async () => {
    mockJsonResponse({
      data: { dau: 10, wau: 50, mau: 100 },
    });

    await scope.getMetrics();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/scope/scope/metrics/dau',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('listFunnels() calls GET /scope/funnels', async () => {
    mockJsonResponse({
      data: [
        {
          id: 'funnel-1',
          name: 'Onboarding',
          steps: ['session_start', 'tutorial_complete'],
          conversion_window_hours: 24,
          created_at: 1700000000,
        },
      ],
    });

    await scope.listFunnels();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/scope/scope/funnels',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });
});

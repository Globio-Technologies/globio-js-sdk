import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobioClient } from '../src/GlobioClient';
import { GlobioPulse } from '../src/modules/GlobioPulse';

function response(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('GlobioPulse', () => {
  let pulse: GlobioPulse;

  beforeEach(() => {
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    pulse = new GlobioPulse(client);
  });

  it('getAll() calls GET /pulse/:env/configs and GET /pulse/:env/flags', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({
        data: [
          { key: 'max-lives', value: 3, value_type: 'number', version: 4, description: 'Cap' },
        ],
      }))
      .mockResolvedValueOnce(response({
        data: [
          { key: 'new-ui', enabled: true, rollout_type: 'percentage', rollout_percentage: 25, version: 7 },
        ],
      }));

    await pulse.getAll('production');

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/pulse/pulse/production/configs',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.example.com/pulse/pulse/production/flags',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getAll() returns PulseConfig and PulseFlag maps with full fields', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({
        data: [
          { key: 'max-lives', value: 3, value_type: 'number', version: 4, description: 'Cap' },
        ],
      }))
      .mockResolvedValueOnce(response({
        data: [
          { key: 'new-ui', enabled: true, rollout_type: 'percentage', rollout_percentage: 25, version: 7 },
        ],
      }));

    const result = await pulse.getAll('production');

    expect(result).toEqual({
      success: true,
      data: {
        configs: {
          'max-lives': {
            key: 'max-lives',
            value: 3,
            value_type: 'number',
            version: 4,
            description: 'Cap',
          },
        },
        flags: {
          'new-ui': {
            key: 'new-ui',
            enabled: true,
            rollout_type: 'percentage',
            rollout_percentage: 25,
            version: 7,
          },
        },
      },
    });
  });

  it('getAll() result is cached and second call does not refetch', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({
        data: [
          { key: 'max-lives', value: 3, value_type: 'number', version: 4, description: null },
        ],
      }))
      .mockResolvedValueOnce(response({
        data: [
          { key: 'new-ui', enabled: true, rollout_type: 'all', rollout_percentage: 100, version: 1 },
        ],
      }));

    await pulse.getAll('production');
    await pulse.getAll('production');

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('getAll() with different environments uses separate cache entries', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({
        data: [
          { key: 'mode', value: 'prod', value_type: 'string', version: 1, description: null },
        ],
      }))
      .mockResolvedValueOnce(response({
        data: [
          { key: 'new-ui', enabled: true, rollout_type: 'all', rollout_percentage: 100, version: 1 },
        ],
      }))
      .mockResolvedValueOnce(response({
        data: [
          { key: 'mode', value: 'staging', value_type: 'string', version: 2, description: null },
        ],
      }))
      .mockResolvedValueOnce(response({
        data: [
          { key: 'new-ui', enabled: false, rollout_type: 'all', rollout_percentage: 100, version: 2 },
        ],
      }));

    const production = await pulse.getAll('production');
    const staging = await pulse.getAll('staging');

    expect(production.success && production.data.configs.mode.value).toBe('prod');
    expect(staging.success && staging.data.configs.mode.value).toBe('staging');
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('clearCache() causes next getAll() to refetch', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({
        data: [
          { key: 'difficulty', value: 'easy', value_type: 'string', version: 1, description: null },
        ],
      }))
      .mockResolvedValueOnce(response({
        data: [
          { key: 'new-ui', enabled: true, rollout_type: 'all', rollout_percentage: 100, version: 1 },
        ],
      }))
      .mockResolvedValueOnce(response({
        data: [
          { key: 'difficulty', value: 'hard', value_type: 'string', version: 2, description: null },
        ],
      }))
      .mockResolvedValueOnce(response({
        data: [
          { key: 'new-ui', enabled: false, rollout_type: 'all', rollout_percentage: 100, version: 2 },
        ],
      }));

    await pulse.getAll('production');
    pulse.clearCache('production');
    const refetched = await pulse.getAll('production');

    expect(refetched.success && refetched.data.configs.difficulty.value).toBe('hard');
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('getConfig() reads from cache after getAll()', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({
        data: [
          { key: 'welcome-copy', value: 'hello', value_type: 'string', version: 1, description: null },
        ],
      }))
      .mockResolvedValueOnce(response({
        data: [
          { key: 'new-ui', enabled: true, rollout_type: 'all', rollout_percentage: 100, version: 1 },
        ],
      }));

    await pulse.getAll('production');
    const value = await pulse.getConfig<string>('welcome-copy', 'production');

    expect(value).toBe('hello');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('isEnabled() without userId returns flat enabled from cache', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({
        data: [
          { key: 'welcome-copy', value: 'hello', value_type: 'string', version: 1, description: null },
        ],
      }))
      .mockResolvedValueOnce(response({
        data: [
          { key: 'new-ui', enabled: false, rollout_type: 'all', rollout_percentage: 100, version: 1 },
        ],
      }));

    const enabled = await pulse.isEnabled('new-ui');

    expect(enabled).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('isEnabled() with userId calls evaluate endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: { key: 'new-ui', enabled: true },
    }));

    await pulse.isEnabled('new-ui', 'production', 'user-42');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/pulse/pulse/production/flags/new-ui/evaluate?user_id=user-42',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('isEnabled() with userId returns evaluated enabled value, not flat cache value', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({
        data: { key: 'new-ui', enabled: false },
      }));

    const enabled = await pulse.isEnabled('new-ui', 'production', 'user-99');

    expect(enabled).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('setConfig() sends PUT /pulse/:env/configs/:key with correct body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        key: 'max-lives',
        value: '3',
        value_type: 'number',
        version: 1,
        description: 'Cap',
      },
    }));

    await pulse.setConfig('production', 'max-lives', 3, 'number', 'Cap');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/pulse/pulse/production/configs/max-lives',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          value: 3,
          value_type: 'number',
          description: 'Cap',
        }),
      }),
    );
  });

  it('setConfig() with value 0 still sends the request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        key: 'max-lives',
        value: '0',
        value_type: 'number',
        version: 2,
        description: null,
      },
    }));

    await pulse.setConfig('production', 'max-lives', 0, 'number');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/pulse/pulse/production/configs/max-lives',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          value: 0,
          value_type: 'number',
          description: undefined,
        }),
      }),
    );
  });

  it('setFlag() sends raw array for target_user_ids, not a JSON string', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        key: 'new-ui',
        enabled: true,
        rollout_type: 'user_list',
        rollout_percentage: 100,
        version: 1,
      },
    }));

    await pulse.setFlag('production', 'new-ui', true, {
      rollout_type: 'user_list',
      target_user_ids: ['user-1', 'user-2'],
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/pulse/pulse/production/flags/new-ui',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          enabled: true,
          rollout_type: 'user_list',
          rollout_percentage: 100,
          target_user_ids: ['user-1', 'user-2'],
          conditions: {},
        }),
      }),
    );
  });
});

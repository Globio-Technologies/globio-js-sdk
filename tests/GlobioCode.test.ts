import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobioClient } from '../src/GlobioClient';
import { GlobioCode } from '../src/modules/GlobioCode';

function response(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('GlobioCode', () => {
  let code: GlobioCode;

  beforeEach(() => {
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    client.session.set({
      user_id: 'user-1',
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
    code = new GlobioCode(client);
  });

  it('listFunctions() calls GET /code/functions', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: [
        { slug: 'matchmaking', type: 'function' },
        { slug: 'init-player', type: 'hook' },
      ],
    }));

    const result = await code.listFunctions();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual({
      success: true,
      data: [{ slug: 'matchmaking', type: 'function' }],
    });
  });

  it("createFunction() calls POST /code/functions with type 'function'", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        id: 'fn-1',
        name: 'Matchmaking',
        slug: 'matchmaking',
        type: 'function',
        trigger_event: null,
        code: 'async function handler() {}',
        runtime: 'js',
        active: true,
        description: null,
        created_at: 1,
        updated_at: 1,
      },
    }));

    await code.createFunction({
      name: 'Matchmaking',
      slug: 'matchmaking',
      type: 'function',
      code: 'async function handler() {}',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Matchmaking',
          slug: 'matchmaking',
          type: 'function',
          code: 'async function handler() {}',
        }),
      }),
    );
  });

  it("createFunction() with type 'hook' sends trigger_event", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        id: 'fn-2',
        name: 'Init Player',
        slug: 'init-player',
        type: 'hook',
        trigger_event: 'id.onSignup',
        code: 'async function handler() {}',
        runtime: 'js',
        active: true,
        description: null,
        created_at: 1,
        updated_at: 1,
      },
    }));

    await code.createFunction({
      name: 'Init Player',
      slug: 'init-player',
      type: 'hook',
      trigger_event: 'id.onSignup',
      code: 'async function handler() {}',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions',
      expect.objectContaining({
        body: JSON.stringify({
          name: 'Init Player',
          slug: 'init-player',
          type: 'hook',
          trigger_event: 'id.onSignup',
          code: 'async function handler() {}',
        }),
      }),
    );
  });

  it("createHook() calls POST /code/functions with type 'hook'", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        id: 'fn-3',
        name: 'Init Player',
        slug: 'init-player',
        type: 'hook',
        trigger_event: 'id.onSignup',
        code: 'async function handler() {}',
        runtime: 'js',
        active: true,
        description: null,
        created_at: 1,
        updated_at: 1,
      },
    }));

    await code.createHook({
      name: 'Init Player',
      slug: 'init-player',
      trigger: 'id.onSignup',
      code: 'async function handler() {}',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Init Player',
          slug: 'init-player',
          type: 'hook',
          trigger_event: 'id.onSignup',
          code: 'async function handler() {}',
        }),
      }),
    );
  });

  it('listHooks() returns only hook entries', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: [
        { slug: 'matchmaking', type: 'function' },
        { slug: 'init-player', type: 'hook' },
      ],
    }));

    const result = await code.listHooks();

    expect(result).toEqual({
      success: true,
      data: [{ slug: 'init-player', type: 'hook' }],
    });
  });

  it('getFunction() calls GET /code/functions/:slug', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: {} }));

    await code.getFunction('matchmaking');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions/matchmaking',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('updateFunction() calls PATCH /code/functions/:slug', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await code.updateFunction('matchmaking', { code: 'updated' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions/matchmaking',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ code: 'updated' }),
      }),
    );
  });

  it('deleteFunction() calls DELETE /code/functions/:slug', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await code.deleteFunction('matchmaking');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions/matchmaking',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('deleteHook() calls DELETE /code/functions/:slug', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await code.deleteHook('init-player');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions/init-player',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('toggleFunction() calls PATCH /code/functions/:slug/toggle with { active: true }', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await code.toggleFunction('matchmaking', true);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions/matchmaking/toggle',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ active: true }),
      }),
    );
  });

  it('toggleFunction() calls PATCH /code/functions/:slug/toggle with { active: false }', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await code.toggleFunction('matchmaking', false);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions/matchmaking/toggle',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ active: false }),
      }),
    );
  });

  it('toggleHook() calls PATCH /code/functions/:slug/toggle', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await code.toggleHook('init-player', true);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions/init-player/toggle',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ active: true }),
      }),
    );
  });

  it('invoke() calls POST /code/invoke/:slug with input payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: { result: { matched: true }, duration_ms: 12 },
    }));

    await code.invoke('matchmaking', { region: 'africa' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/invoke/matchmaking',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ region: 'africa' }),
      }),
    );
  });

  it('invoke() returns { result, duration_ms }', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: { result: { matched: true }, duration_ms: 12 },
    }));

    const result = await code.invoke('matchmaking', { region: 'africa' });

    expect(result).toEqual({
      success: true,
      data: {
        result: { matched: true },
        duration_ms: 12,
      },
    });
  });

  it('getInvocations() calls GET /code/functions/:slug/invocations', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: [] }));

    await code.getInvocations('matchmaking');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions/matchmaking/invocations',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getInvocations(slug, 25) sends ?limit=25', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: [] }));

    await code.getInvocations('matchmaking', 25);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions/matchmaking/invocations?limit=25',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('updateHook() maps trigger to trigger_event', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await code.updateHook('init-player', {
      trigger: 'id.onSignin',
      code: 'updated',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions/init-player',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          code: 'updated',
          trigger_event: 'id.onSignin',
        }),
      }),
    );
  });

  it('getHookInvocations() delegates to hook invocation history', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: [] }));

    await code.getHookInvocations('init-player', 10);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions/init-player/invocations?limit=10',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

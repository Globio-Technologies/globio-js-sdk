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
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: [] }));

    await code.listFunctions();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/code/functions',
      expect.objectContaining({ method: 'GET' }),
    );
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
});

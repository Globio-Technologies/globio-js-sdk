import { describe, expect, it, vi } from 'vitest';
import { GlobioClient } from '../src/GlobioClient';

function mockJsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): void {
  vi.mocked(fetch).mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe('GlobioClient', () => {
  it('builds the correct URL from service and path', async () => {
    mockJsonResponse({ data: { ok: true } });
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });

    await client.request({ service: 'id', path: '/auth/me' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/id/auth/me',
      expect.any(Object),
    );
  });

  it('always sends X-Globio-Key', async () => {
    mockJsonResponse({ data: { ok: true } });
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });

    await client.request({ service: 'doc', path: '/collections/scores/documents/player-1' });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Globio-Key': 'test-key',
        }),
      }),
    );
  });

  it('adds Authorization when auth is true and a session exists', async () => {
    mockJsonResponse({ data: { ok: true } });
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    client.session.set({
      user_id: 'user-1',
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    await client.request({ service: 'id', path: '/auth/me', auth: true });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-123',
        }),
      }),
    );
  });

  it('passes FormData through without JSON stringifying it', async () => {
    mockJsonResponse({ data: { ok: true } });
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    const formData = new FormData();
    formData.append('file', new Blob(['hello']), 'hello.txt');

    await client.request({
      service: 'vault',
      path: '/vault/files',
      method: 'POST',
      body: formData,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: formData,
        headers: expect.not.objectContaining({
          'Content-Type': expect.any(String),
        }),
      }),
    );
  });

  it('stringifies JSON bodies and sets Content-Type', async () => {
    mockJsonResponse({ data: { ok: true } });
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });

    await client.request({
      service: 'doc',
      path: '/collections/scores/documents/player-1',
      method: 'PUT',
      body: { score: 100 },
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ score: 100 }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('returns success false on non-2xx responses', async () => {
    mockJsonResponse({ error: 'Bad request', code: 'BAD_REQUEST' }, false, 400);
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });

    const result = await client.request({ service: 'id', path: '/auth/me' });

    expect(result).toEqual({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Bad request',
        status: 400,
      },
    });
  });

  it('returns success true with data on 2xx responses', async () => {
    mockJsonResponse({ data: { user: 'player-1' } }, true, 200);
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });

    const result = await client.request<{ user: string }>({ service: 'id', path: '/auth/me' });

    expect(result).toEqual({
      success: true,
      data: { user: 'player-1' },
    });
  });
});

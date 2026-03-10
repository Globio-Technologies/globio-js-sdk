import { describe, expect, it, vi } from 'vitest';
import { GlobioClient } from '../src/GlobioClient';
import { GlobioId } from '../src/modules/GlobioId';
import { SessionManager } from '../src/session';

function mockJsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): void {
  vi.mocked(fetch).mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe('SessionManager', () => {
  it('stores the session after signIn', async () => {
    mockJsonResponse({
      data: {
        user: {
          id: 'user-1',
          email: 'player@example.com',
          display_name: 'Player One',
          avatar_url: null,
          role: 'user',
          metadata: {},
          created_at: 1,
        },
        session: {
          user_id: 'user-1',
          access_token: 'access-123',
          refresh_token: 'refresh-123',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
    });

    const client = new GlobioClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.example.com',
      storage: 'localStorage',
    });
    const id = new GlobioId(client);

    await id.signIn({ email: 'player@example.com', password: 'secret' });

    expect(client.session.get()).toEqual({
      user_id: 'user-1',
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_at: expect.any(Number),
    });
    expect(localStorage.setItem).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('globio_session') as string)).toEqual({
      user_id: 'user-1',
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_at: expect.any(Number),
    });
  });

  it('isExpired() returns true when expires_at is in the past', () => {
    const session = new SessionManager('memory');
    session.set({
      user_id: 'user-1',
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_at: Math.floor(Date.now() / 1000) - 120,
    });

    expect(session.isExpired()).toBe(true);
  });

  it('isExpired() returns false when expires_at is in the future', () => {
    const session = new SessionManager('memory');
    session.set({
      user_id: 'user-1',
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(session.isExpired()).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { GlobioClient } from '../src/GlobioClient';
import { GlobioId } from '../src/modules/GlobioId';

function mockJsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): void {
  vi.mocked(fetch).mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe('GlobioId', () => {
  it('signInAnonymously() calls POST /auth/anonymous/login', async () => {
    mockJsonResponse({
      data: {
        user: {
          id: 'user-1',
          email: null,
          display_name: null,
          avatar_url: null,
          role: 'player',
          email_verified: false,
          metadata: {},
          created_at: 1,
        },
        session: {
          user_id: 'user-1',
          access_token: 'access-123',
          refresh_token: 'refresh-123',
          expires_at: Math.floor(Date.now() / 1000) + 900,
        },
      },
    });

    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    const id = new GlobioId(client);

    await id.signInAnonymously();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/id/auth/anonymous/login',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('sendEmailVerification() calls POST /auth/email-verification/send', async () => {
    mockJsonResponse({ data: { ok: true } });
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    client.session.set({
      user_id: 'user-1',
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_at: Math.floor(Date.now() / 1000) + 900,
    });
    const id = new GlobioId(client);

    await id.sendEmailVerification();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/id/auth/email-verification/send',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('verifyEmail() calls POST /auth/email-verification/verify with token body', async () => {
    mockJsonResponse({ data: { ok: true } });
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    const id = new GlobioId(client);

    await id.verifyEmail('verify-token');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/id/auth/email-verification/verify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'verify-token' }),
      }),
    );
  });

  it('requestPasswordReset() calls POST /auth/password-reset with email body', async () => {
    mockJsonResponse({ data: { ok: true } });
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    const id = new GlobioId(client);

    await id.requestPasswordReset('player@example.com');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/id/auth/password-reset',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'player@example.com' }),
      }),
    );
  });

  it('confirmPasswordReset() calls POST /auth/password-reset/confirm with token and new_password body', async () => {
    mockJsonResponse({ data: { ok: true } });
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    const id = new GlobioId(client);

    await id.confirmPasswordReset('reset-token', 'new-password-123');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/id/auth/password-reset/confirm',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'reset-token', new_password: 'new-password-123' }),
      }),
    );
  });

  it('validateToken() returns the backend data shape', async () => {
    mockJsonResponse({
      valid: true,
      data: {
        user_id: 'user-1',
        project_id: 'project-1',
      },
    });

    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    const id = new GlobioId(client);

    const result = await id.validateToken('access-123');

    expect(result).toEqual({
      success: true,
      data: {
        valid: true,
        data: {
          user_id: 'user-1',
          project_id: 'project-1',
        },
      },
    });
  });

  it('updateProfile() sends PATCH /auth/me with all fields', async () => {
    mockJsonResponse({
      data: {
        id: 'user-1',
        email: 'player@example.com',
        display_name: 'New Name',
        avatar_url: 'https://x.com/a.png',
        role: 'player',
        email_verified: true,
        metadata: { level: 5 },
        created_at: 1,
      },
    });

    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    client.session.set({
      user_id: 'user-1',
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_at: Math.floor(Date.now() / 1000) + 900,
    });
    const id = new GlobioId(client);

    await id.updateProfile({
      display_name: 'New Name',
      avatar_url: 'https://x.com/a.png',
      metadata: { level: 5 },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/id/auth/me',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          display_name: 'New Name',
          avatar_url: 'https://x.com/a.png',
          metadata: { level: 5 },
        }),
      }),
    );
  });

  it('updateProfile() only sends the fields provided by the developer', async () => {
    mockJsonResponse({
      data: {
        id: 'user-1',
        email: 'player@example.com',
        display_name: 'New Name',
        avatar_url: null,
        role: 'player',
        email_verified: true,
        metadata: {},
        created_at: 1,
      },
    });

    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    client.session.set({
      user_id: 'user-1',
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_at: Math.floor(Date.now() / 1000) + 900,
    });
    const id = new GlobioId(client);

    await id.updateProfile({ display_name: 'New Name' });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>;

    expect(body).toEqual({ display_name: 'New Name' });
    expect(body).not.toHaveProperty('avatar_url');
    expect(body).not.toHaveProperty('metadata');
  });

  it('signOut() does not clear the local session when backend logout fails', async () => {
    mockJsonResponse({ error: 'server unavailable' }, false, 500);

    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    client.session.set({
      user_id: 'user-1',
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_at: Math.floor(Date.now() / 1000) + 900,
    });
    const id = new GlobioId(client);

    const result = await id.signOut();

    expect(result.success).toBe(false);
    expect(client.session.get()).toEqual({
      user_id: 'user-1',
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_at: expect.any(Number),
    });
  });
});

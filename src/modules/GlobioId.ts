import { GlobioClient } from '../GlobioClient';
import { GlobioResult, GlobioUser, GlobioSession } from '../types';

export interface ValidateTokenResponse {
  valid: boolean;
  data?: {
    user_id: string;
    project_id: string;
  };
}

export class GlobioId {
  constructor(private client: GlobioClient) {}

  async signUp(data: { email: string; password: string; display_name?: string }): Promise<GlobioResult<{ user: GlobioUser; session: GlobioSession }>> {
    const result = await this.client.request<{ user: GlobioUser; session: GlobioSession }>({
      service: 'id',
      path: '/auth/email/register',
      method: 'POST',
      body: data,
    });
    if (result.success) this.client.session.set(result.data.session);
    return result;
  }

  async signIn(data: { email: string; password: string }): Promise<GlobioResult<{ user: GlobioUser; session: GlobioSession }>> {
    const result = await this.client.request<{ user: GlobioUser; session: GlobioSession }>({
      service: 'id',
      path: '/auth/email/login',
      method: 'POST',
      body: data,
    });
    if (result.success) this.client.session.set(result.data.session);
    return result;
  }

  async signInAnonymously(): Promise<GlobioResult<{ user: GlobioUser; session: GlobioSession }>> {
    const result = await this.client.request<{ user: GlobioUser; session: GlobioSession }>({
      service: 'id',
      path: '/auth/anonymous/login',
      method: 'POST',
    });
    if (result.success) this.client.session.set(result.data.session);
    return result;
  }

  async signInWithOAuth(provider: 'google' | 'apple' | 'discord' | 'facebook' | 'twitter' | 'github' | 'microsoft' | 'twitch' | 'linkedin' | 'slack'): Promise<GlobioResult<{ url: string; state: string }>> {
    return this.client.request<{ url: string; state: string }>({
      service: 'id',
      path: `/auth/oauth/${provider}`,
      method: 'GET',
    });
  }

  async handleOAuthCallback(provider: 'google' | 'apple' | 'discord' | 'facebook' | 'twitter' | 'github' | 'microsoft' | 'twitch' | 'linkedin' | 'slack', code: string, state?: string): Promise<GlobioResult<{ user: GlobioUser; session: GlobioSession }>> {
    const result = await this.client.request<{ user: GlobioUser; session: GlobioSession }>({
      service: 'id',
      path: `/auth/oauth/${provider}/callback`,
      method: 'POST',
      body: { code, state },
    });
    if (result.success) this.client.session.set(result.data.session);
    return result;
  }

  async signInWithTelegram(botToken: string, initData: string): Promise<GlobioResult<{ user: GlobioUser; session: GlobioSession }>> {
    const result = await this.client.request<{ user: GlobioUser; session: GlobioSession }>({
      service: 'id',
      path: '/auth/bot/telegram/login',
      method: 'POST',
      body: { bot_token: botToken, init_data: initData },
    });
    if (result.success) this.client.session.set(result.data.session);
    return result;
  }

  async signInWithWhatsApp(phoneNumber: string, verificationCode: string): Promise<GlobioResult<{ user: GlobioUser; session: GlobioSession }>> {
    const result = await this.client.request<{ user: GlobioUser; session: GlobioSession }>({
      service: 'id',
      path: '/auth/bot/whatsapp/login',
      method: 'POST',
      body: { phone_number: phoneNumber, verification_code: verificationCode },
    });
    if (result.success) this.client.session.set(result.data.session);
    return result;
  }

  async signInWithSMS(phoneNumber: string, verificationCode: string): Promise<GlobioResult<{ user: GlobioUser; session: GlobioSession }>> {
    const result = await this.client.request<{ user: GlobioUser; session: GlobioSession }>({
      service: 'id',
      path: '/auth/bot/sms/login',
      method: 'POST',
      body: { phone_number: phoneNumber, verification_code: verificationCode },
    });
    if (result.success) this.client.session.set(result.data.session);
    return result;
  }

  async sendSMSCode(phoneNumber: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'id',
      path: '/auth/sms/send',
      method: 'POST',
      body: { phone_number: phoneNumber },
    });
  }

  async verifySMSCode(phoneNumber: string, code: string): Promise<GlobioResult<{ valid: boolean }>> {
    return this.client.request<{ valid: boolean }>({
      service: 'id',
      path: '/auth/sms/verify',
      method: 'POST',
      body: { phone_number: phoneNumber, code },
    });
  }

  async sendWhatsAppCode(phoneNumber: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'id',
      path: '/auth/whatsapp/send',
      method: 'POST',
      body: { phone_number: phoneNumber },
    });
  }

  async verifyWhatsAppCode(phoneNumber: string, code: string): Promise<GlobioResult<{ valid: boolean }>> {
    return this.client.request<{ valid: boolean }>({
      service: 'id',
      path: '/auth/whatsapp/verify',
      method: 'POST',
      body: { phone_number: phoneNumber, code },
    });
  }

  async sendEmailVerification(): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'id',
      path: '/auth/email-verification/send',
      method: 'POST',
      auth: true,
    });
  }

  async verifyEmail(token: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'id',
      path: '/auth/email-verification/verify',
      method: 'POST',
      body: { token },
    });
  }

  async requestPasswordReset(email: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'id',
      path: '/auth/password-reset',
      method: 'POST',
      body: { email },
    });
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'id',
      path: '/auth/password-reset/confirm',
      method: 'POST',
      body: { token, new_password: newPassword },
    });
  }

  async signOut(): Promise<GlobioResult<void>> {
    const result = await this.client.request<void>({
      service: 'id',
      path: '/auth/logout',
      method: 'POST',
      auth: true,
    });
    if (result.success) {
      this.client.session.clear();
    }
    return result;
  }

  async getUser(): Promise<GlobioResult<GlobioUser>> {
    return this.client.request<GlobioUser>({
      service: 'id',
      path: '/auth/me',
      auth: true,
    });
  }

  async updateProfile(data: { display_name?: string; avatar_url?: string; metadata?: Record<string, unknown> }): Promise<GlobioResult<GlobioUser>> {
    return this.client.request<GlobioUser>({
      service: 'id',
      path: '/auth/me',
      method: 'PATCH',
      body: data,
      auth: true,
    });
  }

  async validateToken(accessToken: string): Promise<GlobioResult<ValidateTokenResponse>> {
    const result = await this.client.request<{ user_id: string; project_id: string }>({
      service: 'id',
      path: '/auth/validate',
      method: 'POST',
      body: { access_token: accessToken },
    });

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: {
        valid: true,
        data: result.data,
      },
    };
  }

  async refreshToken(): Promise<GlobioResult<{ access_token: string; expires_at: number }>> {
    const session = this.client.session.get();
    if (!session?.refresh_token) {
      return { success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token available', status: 401 } };
    }

    return this.client.request<{ access_token: string; expires_at: number }>({
      service: 'id',
      path: '/auth/refresh',
      method: 'POST',
      body: { refresh_token: session.refresh_token },
    });
  }

  getSession(): GlobioSession | null {
    return this.client.session.get();
  }

  isSignedIn(): boolean {
    return !this.client.session.isExpired();
  }
}

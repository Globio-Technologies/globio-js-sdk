import { GlobioClient } from '../GlobioClient';
import { GlobioResult } from '../types';

export class GlobioCode {
  constructor(private client: GlobioClient) {}

  async invoke(functionSlug: string, payload?: Record<string, unknown>): Promise<GlobioResult<{ result: unknown; logs?: string[]; error?: string }>> {
    return this.client.request<{ result: unknown; logs?: string[]; error?: string }>({
      service: 'code',
      path: `/invoke/${functionSlug}`,
      method: 'POST',
      body: payload,
      auth: true,
    });
  }

  async list(): Promise<GlobioResult<Array<{ slug: string; name: string; runtime: string; active: boolean }>>> {
    return this.client.request<Array<{ slug: string; name: string; runtime: string; active: boolean }>>({
      service: 'code',
      path: '/list',
      auth: true,
    });
  }

  async getLogs(functionSlug: string, limit = 100): Promise<GlobioResult<Array<{ timestamp: number; level: string; message: string }>>> {
    return this.client.request<Array<{ timestamp: number; level: string; message: string }>>({
      service: 'code',
      path: `/logs/${functionSlug}?limit=${limit}`,
      auth: true,
    });
  }
}

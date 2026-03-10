import { GlobioClient } from '../GlobioClient';
import { GlobioResult } from '../types';

export class GlobioSignal {
  constructor(private client: GlobioClient) {}

  async subscribe(topic: string, pushToken?: string, platform?: 'ios' | 'android' | 'web' | 'unity'): Promise<GlobioResult<{ id: string }>> {
    return this.client.request<{ id: string }>({
      service: 'signal',
      path: `/topics/${encodeURIComponent(topic)}/subscribe`,
      method: 'POST',
      body: { push_token: pushToken, platform },
      auth: true,
    });
  }

  async unsubscribe(topic: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'signal',
      path: `/topics/${encodeURIComponent(topic)}/unsubscribe`,
      method: 'POST',
      auth: true,
    });
  }

  async send(topic: string, title: string, body: string, data?: Record<string, unknown>): Promise<GlobioResult<{ message_id: string }>> {
    return this.client.request<{ message_id: string }>({
      service: 'signal',
      path: `/topics/${encodeURIComponent(topic)}/send`,
      method: 'POST',
      body: { title, body, data },
      auth: true,
    });
  }

  async listTopics(): Promise<GlobioResult<Array<{ topic: string; subscriber_count: number }>>> {
    return this.client.request<Array<{ topic: string; subscriber_count: number }>>({
      service: 'signal',
      path: '/topics',
      auth: true,
    });
  }
}

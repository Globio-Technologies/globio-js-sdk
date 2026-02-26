import { GlobioClient } from '../GlobioClient';

interface QueuedEvent {
  event_name: string;
  properties?: Record<string, unknown>;
  user_id?: string;
}

export class GlobioScope {
  private queue: QueuedEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private client: GlobioClient;

  constructor(client: GlobioClient) {
    this.client = client;
  }

  track(eventName: string, properties?: Record<string, unknown>): void {
    const session = this.client.session.get();
    this.queue.push({
      event_name: eventName,
      properties,
      user_id: session?.user_id,
    });

    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (this.queue.length >= 20) {
      this.flush();
    } else {
      this.flushTimer = setTimeout(() => this.flush(), 2000);
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const events = this.queue.splice(0, this.queue.length);
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    try {
      await this.client.request({
        service: 'scope',
        path: '/track/batch',
        method: 'POST',
        body: { events },
        auth: true,
      });
    } catch {
      this.queue.unshift(...events);
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

import { GlobioClient } from '../GlobioClient';
import {
  GlobioResult,
  SignalNotificationPayload,
  SignalSendOptions,
  SignalSubscription,
  SignalTopic,
} from '../types';

type SignalEventMap = {
  notification: SignalNotificationPayload;
  connected: { user_id: string; device_id: string };
  disconnected: { code: number; reason: string };
  error: Error;
};

export class GlobioSignal {
  private ws: WebSocket | null = null;
  private handlers = new Map<keyof SignalEventMap, Array<(value: unknown) => void>>();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private renderer: ((notification: SignalNotificationPayload) => void) | null = null;

  constructor(private client: GlobioClient) {}

  private toVoidResult(result: GlobioResult<void>): GlobioResult<void> {
    return result.success ? { success: true, data: undefined } : result;
  }

  private async getConnectTicket(): Promise<string> {
    const result = await this.client.request<{
      ticket: string;
      expires_in: number;
    }>({
      service: 'signal',
      path: '/connect-ticket',
      method: 'POST',
      auth: true,
    });

    if (!result.success) {
      throw new Error(`Failed to get signal connect ticket: ${result.error.message}`);
    }

    return result.data.ticket;
  }

  private async fetchInbox(): Promise<SignalNotificationPayload[]> {
    const result = await this.client.request<SignalNotificationPayload[]>({
      service: 'signal',
      path: '/inbox',
      auth: true,
    });

    if (!result.success) {
      throw new Error(`Failed to fetch signal inbox: ${result.error.message}`);
    }

    return result.data;
  }

  private buildSendBody(notification: SignalSendOptions): Record<string, unknown> {
    return {
      title: notification.title,
      body: notification.body,
      type: notification.type,
      data: notification.data,
      image_url: notification.image_url,
      icon_url: notification.icon_url,
      priority: notification.priority,
      actions: notification.actions,
      ttl_seconds: notification.ttl_seconds,
    };
  }

  async connect(): Promise<void> {
    const ticket = await this.getConnectTicket();
    const wsHost = this.client.config.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    const wsUrl = `${wsHost}/signal/ws?ticket=${encodeURIComponent(ticket)}`;

    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    return new Promise((resolve, reject) => {
      ws.onopen = async () => {
        this.startPing();

        try {
          const inboxMessages = await this.fetchInbox();
          for (const message of inboxMessages) {
            this.handleIncomingNotification(message);
          }
          resolve();
        } catch (error) {
          const err = error instanceof Error ? error : new Error('Signal inbox fetch failed');
          this.emit('error', err);
          reject(err);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as {
            type?: string;
            payload?: Record<string, unknown>;
          };

          if (message.type === 'notification') {
            this.handleIncomingNotification(message.payload as unknown as SignalNotificationPayload);
            return;
          }

          if (message.type === 'connected') {
            this.emit('connected', message.payload as SignalEventMap['connected']);
            return;
          }

          if (message.type === 'ping') {
            this.sendSocketMessage('pong', {});
            return;
          }

          if (message.type === 'error') {
            const errorMessage = typeof message.payload?.message === 'string'
              ? message.payload.message
              : 'Signal error';
            this.emit('error', new Error(errorMessage));
          }
        } catch {
          this.emit('error', new Error('Invalid Signal message'));
        }
      };

      ws.onerror = () => {
        const error = new Error('Signal WebSocket connection failed');
        this.emit('error', error);
        reject(error);
      };

      ws.onclose = (event) => {
        this.cleanupSocket();
        this.emit('disconnected', { code: event.code, reason: event.reason });
      };
    });
  }

  disconnect(): void {
    this.cleanupSocket();
    this.ws?.close();
  }

  on<K extends keyof SignalEventMap>(event: K, handler: (payload: SignalEventMap[K]) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler as (value: unknown) => void);
  }

  setNotificationRenderer(
    renderer: (notification: SignalNotificationPayload) => void
  ): void {
    this.renderer = renderer;
  }

  async subscribe(topic: string): Promise<GlobioResult<void>> {
    const result = await this.client.request<void>({
      service: 'signal',
      path: `/topics/${encodeURIComponent(topic)}/subscribe`,
      method: 'POST',
      auth: true,
    });

    return this.toVoidResult(result);
  }

  async unsubscribe(topic: string): Promise<GlobioResult<void>> {
    const result = await this.client.request<void>({
      service: 'signal',
      path: `/topics/${encodeURIComponent(topic)}/subscribe`,
      method: 'DELETE',
      auth: true,
    });

    return this.toVoidResult(result);
  }

  async send(topic: string, notification: SignalSendOptions): Promise<GlobioResult<{ message_id: string }>> {
    return this.client.request<{ message_id: string }>({
      service: 'signal',
      path: `/topics/${encodeURIComponent(topic)}/send`,
      method: 'POST',
      body: this.buildSendBody(notification),
      auth: true,
    });
  }

  async sendToUser(userId: string, notification: SignalSendOptions): Promise<GlobioResult<{ message_id: string }>> {
    return this.client.request<{ message_id: string }>({
      service: 'signal',
      path: `/users/${encodeURIComponent(userId)}/send`,
      method: 'POST',
      body: this.buildSendBody(notification),
      auth: true,
    });
  }

  async createTopic(name: string, description?: string): Promise<GlobioResult<SignalTopic>> {
    return this.client.request<SignalTopic>({
      service: 'signal',
      path: '/topics',
      method: 'POST',
      body: { name, description },
      auth: true,
    });
  }

  async getTopic(topicName: string): Promise<GlobioResult<SignalTopic>> {
    return this.client.request<SignalTopic>({
      service: 'signal',
      path: `/topics/${encodeURIComponent(topicName)}`,
      auth: true,
    });
  }

  async deleteTopic(topicName: string): Promise<GlobioResult<void>> {
    const result = await this.client.request<void>({
      service: 'signal',
      path: `/topics/${encodeURIComponent(topicName)}`,
      method: 'DELETE',
      auth: true,
    });

    return this.toVoidResult(result);
  }

  async getSubscriptions(): Promise<GlobioResult<SignalSubscription[]>> {
    return this.client.request<SignalSubscription[]>({
      service: 'signal',
      path: '/subscriptions',
      auth: true,
    });
  }

  async listTopics(): Promise<GlobioResult<SignalTopic[]>> {
    return this.client.request<SignalTopic[]>({
      service: 'signal',
      path: '/topics',
      auth: true,
    });
  }

  private handleIncomingNotification(notification: SignalNotificationPayload): void {
    this.emit('notification', notification);

    if (this.renderer) {
      this.renderer(notification);
      return;
    }

    this.defaultRenderer(notification);
  }

  private defaultRenderer(notification: SignalNotificationPayload): void {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return;
    }

    if (Notification.permission !== 'granted') {
      return;
    }

    const options: NotificationOptions & { image?: string } = {
      body: notification.body,
      icon: notification.icon_url ?? undefined,
      image: notification.image_url ?? undefined,
      data: notification.data,
    };

    new Notification(notification.title ?? 'Notification', options);
  }

  private startPing(): void {
    this.cleanupPing();
    this.pingInterval = setInterval(() => {
      this.sendSocketMessage('ping', {});
    }, 30_000);
  }

  private sendSocketMessage(type: string, payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  private cleanupPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private cleanupSocket(): void {
    this.cleanupPing();
  }

  private emit<K extends keyof SignalEventMap>(event: K, payload: SignalEventMap[K]): void {
    const handlers = this.handlers.get(event) ?? [];
    handlers.forEach((handler) => handler(payload));
  }
}

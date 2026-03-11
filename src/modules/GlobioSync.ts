import { GlobioClient } from '../GlobioClient';
import { GlobioResult, GlobioRoomEvent } from '../types';

type EventHandler = (event: GlobioRoomEvent) => void;

export class GlobioRoom {
  private ws: WebSocket | null = null;
  private handlers: Map<string, EventHandler[]> = new Map();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private client: GlobioClient;

  constructor(client: GlobioClient, private roomId: string) {
    this.client = client;
  }

  async connect(): Promise<void> {
    const session = this.client.session.get();
    const baseUrl = this.client.config.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    const url = `${baseUrl}/sync/rooms/${this.roomId}/ws?token=${session?.access_token ?? ''}`;

    this.ws = new WebSocket(url);

    return new Promise((resolve, reject) => {
      this.ws!.onopen = () => {
        this.startPing();
        resolve();
      };
      this.ws!.onerror = () => reject(new Error('WebSocket connection failed'));
      this.ws!.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
      this.ws!.onclose = () => this.cleanup();
    });
  }

  on(type: string, handler: EventHandler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
  }

  off(type: string, handler: EventHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    }
  }

  send(type: string, payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  disconnect(): void {
    this.cleanup();
    this.ws?.close();
  }

  private handleMessage(message: GlobioRoomEvent): void {
    if (message.type === 'ping') {
      this.send('pong', {});
      return;
    }
    const handlers = this.handlers.get(message.type) ?? [];
    const allHandlers = this.handlers.get('*') ?? [];
    [...handlers, ...allHandlers].forEach(h => h(message));
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.send('ping', {});
    }, 30000);
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export class GlobioSync {
  constructor(private client: GlobioClient) {}

  async createRoom(data?: { template_id?: string; name?: string }): Promise<GlobioResult<{ id: string }>> {
    return this.client.request<{ id: string }>({
      service: 'sync',
      path: '/rooms',
      method: 'POST',
      body: data ?? {},
      auth: true,
    });
  }

  async listAvailable(templateId?: string): Promise<GlobioResult<Array<{ id: string; name: string; current_players: number; max_players: number }>>> {
    const qs = templateId ? `?template_id=${templateId}` : '';
    return this.client.request<Array<{ id: string; name: string; current_players: number; max_players: number }>>({
      service: 'sync',
      path: `/rooms/available${qs}`,
      auth: true,
    });
  }

  async joinRoom(roomId: string): Promise<GlobioRoom> {
    const room = new GlobioRoom(this.client, roomId);
    await room.connect();
    return room;
  }

  async getRoom(roomId: string): Promise<GlobioResult<{ id: string; name: string; status: string; current_players: number }>> {
    return this.client.request<{ id: string; name: string; status: string; current_players: number }>({
      service: 'sync',
      path: `/rooms/${roomId}`,
      auth: true,
    });
  }

  async closeRoom(roomId: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'sync',
      path: `/rooms/${roomId}/close`,
      method: 'POST',
      auth: true,
    });
  }
}

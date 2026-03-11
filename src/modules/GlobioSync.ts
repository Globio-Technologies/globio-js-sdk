import { GlobioClient } from '../GlobioClient';
import { GlobioResult, GlobioRoomEvent, SyncCloseCodes, SyncConnectionState, SyncRoom, SyncRoomTemplate } from '../types';

type EventHandler = (event: GlobioRoomEvent) => void;
type CloseEvent = { code: number; reason: string };
type CloseHandler = (event: CloseEvent) => void;
type AnyHandler = EventHandler | CloseHandler;

export class GlobioRoom {
  private ws: WebSocket | null = null;
  private handlers: Map<string, AnyHandler[]> = new Map();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private client: GlobioClient;
  private connectionState: SyncConnectionState = 'disconnected';

  constructor(client: GlobioClient, private roomId: string, private joinTicket: string) {
    this.client = client;
  }

  async connect(): Promise<void> {
    const baseUrl = this.client.config.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    const url = `${baseUrl}/sync/rooms/${this.roomId}/ws?ticket=${encodeURIComponent(this.joinTicket)}`;

    this.connectionState = 'connecting';
    this.ws = new WebSocket(url);

    return new Promise((resolve, reject) => {
      this.ws!.onopen = () => {
        this.connectionState = 'connected';
        this.startPing();
        resolve();
      };
      this.ws!.onerror = () => {
        this.connectionState = 'error';
        reject(new Error('WebSocket connection failed'));
      };
      this.ws!.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
      this.ws!.onclose = (event) => {
        this.connectionState = 'disconnected';
        this.cleanup();
        this.emit('close', { code: event.code, reason: event.reason });
      };
    });
  }

  on(type: 'close', handler: CloseHandler): void;
  on(type: string, handler: EventHandler): void;
  on(type: string, handler: AnyHandler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
  }

  off(type: 'close', handler: CloseHandler): void;
  off(type: string, handler: EventHandler): void;
  off(type: string, handler: AnyHandler): void {
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

  getConnectionState(): SyncConnectionState {
    return this.connectionState;
  }

  private handleMessage(message: GlobioRoomEvent): void {
    if (message.type === 'ping') {
      this.send('pong', {});
      return;
    }
    this.emit(message.type, message);
    this.emit('*', message);
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

  private emit(type: string, event: GlobioRoomEvent | CloseEvent): void {
    const handlers = this.handlers.get(type) ?? [];
    handlers.forEach((handler) => {
      (handler as (value: typeof event) => void)(event);
    });
  }
}

export class GlobioSync {
  constructor(private client: GlobioClient) {}

  private normalizeRoom(room: SyncRoom & { state: Record<string, unknown> | string }): SyncRoom {
    if (typeof room.state === 'string') {
      try {
        return { ...room, state: JSON.parse(room.state) as Record<string, unknown> };
      } catch {
        return { ...room, state: {} };
      }
    }

    return room;
  }

  private normalizeTemplate(template: SyncRoomTemplate & { initial_state: Record<string, unknown> | string }): SyncRoomTemplate {
    if (typeof template.initial_state === 'string') {
      try {
        return { ...template, initial_state: JSON.parse(template.initial_state) as Record<string, unknown> };
      } catch {
        return { ...template, initial_state: {} };
      }
    }

    return template;
  }

  async createRoom(data?: { template_id?: string; name?: string }): Promise<GlobioResult<SyncRoom>> {
    const result = await this.client.request<SyncRoom & { state: string | Record<string, unknown> }>({
      service: 'sync',
      path: '/rooms',
      method: 'POST',
      body: data ?? {},
      auth: true,
    });

    return result.success ? { success: true, data: this.normalizeRoom(result.data) } : result;
  }

  async listAvailable(templateId?: string): Promise<GlobioResult<SyncRoom[]>> {
    const qs = templateId ? `?template_id=${templateId}` : '';
    const result = await this.client.request<Array<SyncRoom & { state: string | Record<string, unknown> }>>({
      service: 'sync',
      path: `/rooms/available${qs}`,
      auth: true,
    });

    return result.success ? { success: true, data: result.data.map((room) => this.normalizeRoom(room)) } : result;
  }

  /**
   * Joins a room and establishes a WebSocket connection.
   *
   * Note: reconnection is not automatic. If the connection drops,
   * call joinRoom() again to reconnect. The player's last state
   * is preserved in the database and will be restored on rejoin
   * if the room is still open.
   *
   * Note: on mobile, listen for visibilitychange events and call
   * disconnect() when the app backgrounds, then joinRoom() again
   * when it returns to foreground.
   */
  async joinRoom(roomId: string): Promise<GlobioRoom> {
    const ticket = await this.getJoinTicket(roomId);
    const room = new GlobioRoom(this.client, roomId, ticket);
    await room.connect();
    return room;
  }

  private async getJoinTicket(roomId: string): Promise<string> {
    const result = await this.client.request<{
      ticket: string;
      expires_in: number;
    }>({
      service: 'sync',
      path: `/rooms/${roomId}/join-ticket`,
      method: 'POST',
      auth: true,
    });

    if (!result.success) {
      throw new Error(`Failed to get join ticket: ${result.error.message}`);
    }

    return result.data.ticket;
  }

  async getRoom(roomId: string): Promise<GlobioResult<SyncRoom>> {
    const result = await this.client.request<SyncRoom & { state: string | Record<string, unknown> }>({
      service: 'sync',
      path: `/rooms/${roomId}`,
      auth: true,
    });

    return result.success ? { success: true, data: this.normalizeRoom(result.data) } : result;
  }

  async closeRoom(roomId: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'sync',
      path: `/rooms/${roomId}/close`,
      method: 'POST',
      auth: true,
    });
  }

  async listTemplates(): Promise<GlobioResult<SyncRoomTemplate[]>> {
    const result = await this.client.request<Array<SyncRoomTemplate & { initial_state: string | Record<string, unknown> }>>({
      service: 'sync',
      path: '/templates',
      auth: true,
    });

    return result.success ? { success: true, data: result.data.map((template) => this.normalizeTemplate(template)) } : result;
  }

  async createTemplate(options: {
    name: string;
    max_players?: number;
    visibility?: 'public' | 'private';
    sync_mode?: 'authoritative' | 'p2p' | 'hybrid';
    initial_state?: Record<string, unknown>;
  }): Promise<GlobioResult<SyncRoomTemplate>> {
    const result = await this.client.request<SyncRoomTemplate & { initial_state: string | Record<string, unknown> }>({
      service: 'sync',
      path: '/templates',
      method: 'POST',
      body: options,
      auth: true,
    });

    return result.success ? { success: true, data: this.normalizeTemplate(result.data) } : result;
  }
}

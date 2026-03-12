import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobioClient } from '../src/GlobioClient';
import { GlobioSignal } from '../src/modules/GlobioSignal';
import type { SignalNotificationPayload } from '../src/types';

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  sent: string[] = [];
  closeCode?: number;
  closeReason?: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    queueMicrotask(() => this.onopen?.());
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code = 1000, reason = ''): void {
    this.closeCode = code;
    this.closeReason = reason;
    this.onclose?.({ code, reason });
  }
}

function response(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('GlobioSignal', () => {
  let signal: GlobioSignal;

  beforeEach(() => {
    MockWebSocket.instances = [];
    Object.defineProperty(globalThis, 'WebSocket', {
      value: MockWebSocket,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, 'window', {
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, 'Notification', {
      value: class {
        static permission = 'default';
        constructor(_title: string, _options?: NotificationOptions) {}
      },
      configurable: true,
      writable: true,
    });

    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    client.session.set({
      user_id: 'user-1',
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
    signal = new GlobioSignal(client);
  });

  it('connect() calls POST /signal/connect-ticket', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ data: { ticket: 'ticket-123', expires_in: 30 } }))
      .mockResolvedValueOnce(response({ data: [] }));

    await signal.connect();

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/signal/connect-ticket',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('connect() opens WebSocket with ?ticket=... URL', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ data: { ticket: 'ticket-123', expires_in: 30 } }))
      .mockResolvedValueOnce(response({ data: [] }));

    await signal.connect();

    expect(MockWebSocket.instances[0]?.url).toBe(
      'wss://api.example.com/signal/ws?ticket=ticket-123',
    );
  });

  it('connect() fetches inbox on connect', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ data: { ticket: 'ticket-123', expires_in: 30 } }))
      .mockResolvedValueOnce(response({ data: [] }));

    await signal.connect();

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.example.com/signal/inbox',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('connect() fires notification handlers for each inbox item', async () => {
    const notifications: SignalNotificationPayload[] = [];
    signal.on('notification', (notification) => notifications.push(notification));

    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ data: { ticket: 'ticket-123', expires_in: 30 } }))
      .mockResolvedValueOnce(response({
        data: [
          {
            id: 'msg-1',
            type: 'notification',
            title: 'Inbox 1',
            body: 'First',
            data: {},
            image_url: null,
            icon_url: null,
            priority: 'normal',
            topic: null,
            sender_user_id: null,
            sender_display_name: null,
            actions: [],
            created_at: 1700000000,
            expires_at: null,
          },
          {
            id: 'msg-2',
            type: 'notification',
            title: 'Inbox 2',
            body: 'Second',
            data: {},
            image_url: null,
            icon_url: null,
            priority: 'normal',
            topic: null,
            sender_user_id: null,
            sender_display_name: null,
            actions: [],
            created_at: 1700000001,
            expires_at: null,
          },
        ],
      }));

    await signal.connect();

    expect(notifications).toHaveLength(2);
    expect(notifications[0]?.title).toBe('Inbox 1');
    expect(notifications[1]?.title).toBe('Inbox 2');
  });

  it('on(\"notification\") handler receives notification payload', async () => {
    const notifications: SignalNotificationPayload[] = [];
    signal.on('notification', (notification) => notifications.push(notification));

    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ data: { ticket: 'ticket-123', expires_in: 30 } }))
      .mockResolvedValueOnce(response({ data: [] }));

    await signal.connect();
    MockWebSocket.instances[0]?.onmessage?.({
      data: JSON.stringify({
        type: 'notification',
        payload: {
          id: 'msg-3',
          type: 'match_ready',
          title: 'Match found',
          body: 'Your ranked match is ready.',
          data: { match_id: 'abc123' },
          image_url: null,
          icon_url: null,
          priority: 'high',
          topic: 'game-updates',
          sender_user_id: 'user-2',
          sender_display_name: 'Matchmaker',
          actions: [],
          created_at: 1700000002,
          expires_at: null,
        },
      }),
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.data.match_id).toBe('abc123');
  });

  it('setNotificationRenderer() is called instead of default renderer', async () => {
    const renderer = vi.fn();
    const notificationSpy = vi.fn();
    Object.defineProperty(globalThis, 'Notification', {
      value: notificationSpy,
      configurable: true,
      writable: true,
    });

    signal.setNotificationRenderer(renderer);

    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ data: { ticket: 'ticket-123', expires_in: 30 } }))
      .mockResolvedValueOnce(response({ data: [] }));

    await signal.connect();
    MockWebSocket.instances[0]?.onmessage?.({
      data: JSON.stringify({
        type: 'notification',
        payload: {
          id: 'msg-4',
          type: 'notification',
          title: 'Custom',
          body: 'Renderer',
          data: {},
          image_url: null,
          icon_url: null,
          priority: 'normal',
          topic: null,
          sender_user_id: null,
          sender_display_name: null,
          actions: [],
          created_at: 1700000003,
          expires_at: null,
        },
      }),
    });

    expect(renderer).toHaveBeenCalledTimes(1);
    expect(notificationSpy).not.toHaveBeenCalled();
  });

  it('subscribe() calls POST /signal/topics/:topic/subscribe with no body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await signal.subscribe('game-updates');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/signal/topics/game-updates/subscribe',
      expect.objectContaining({
        method: 'POST',
        body: undefined,
      }),
    );
  });

  it('unsubscribe() calls DELETE /signal/topics/:topic/subscribe', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await signal.unsubscribe('game-updates');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/signal/topics/game-updates/subscribe',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('send() calls POST /signal/topics/:topic/send with correct body including ttl_seconds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: { message_id: 'msg-1' } }));

    await signal.send('game-updates', {
      title: 'Match found',
      body: 'Your ranked match is ready.',
      priority: 'high',
      ttl_seconds: 300,
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/signal/topics/game-updates/send',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Match found',
          body: 'Your ranked match is ready.',
          type: undefined,
          data: undefined,
          image_url: undefined,
          icon_url: undefined,
          priority: 'high',
          actions: undefined,
          ttl_seconds: 300,
        }),
      }),
    );
  });

  it('sendToUser() calls POST /signal/users/:userId/send', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: { message_id: 'msg-2' } }));

    await signal.sendToUser('user-42', {
      title: 'Your turn',
      body: 'Make your move.',
      data: { match_id: 'abc123' },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/signal/users/user-42/send',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('disconnect() closes WebSocket', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ data: { ticket: 'ticket-123', expires_in: 30 } }))
      .mockResolvedValueOnce(response({ data: [] }));

    await signal.connect();
    signal.disconnect();

    expect(MockWebSocket.instances[0]?.closeCode).toBe(1000);
  });

  it('ping received sends pong', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ data: { ticket: 'ticket-123', expires_in: 30 } }))
      .mockResolvedValueOnce(response({ data: [] }));

    await signal.connect();
    const ws = MockWebSocket.instances[0];
    ws?.onmessage?.({ data: JSON.stringify({ type: 'ping', payload: {} }) });

    expect(ws?.sent).toContain(JSON.stringify({ type: 'pong', payload: {} }));
  });

  it('listTopics() returns SignalTopic[]', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: [
        {
          id: 'topic-1',
          project_id: 'proj-1',
          name: 'game-updates',
          description: 'Live game events',
          created_at: 1700000000,
        },
      ],
    }));

    const result = await signal.listTopics();

    expect(result.success).toBe(true);
    expect(result.success && result.data[0]?.name).toBe('game-updates');
  });

  it('createTopic() calls POST /signal/topics with name and description', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        id: 'topic-1',
        project_id: 'proj-1',
        name: 'game-updates',
        description: 'Live game events',
        created_at: 1700000000,
      },
    }));

    await signal.createTopic('game-updates', 'Live game events');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/signal/topics',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'game-updates', description: 'Live game events' }),
      }),
    );
  });

  it('deleteTopic() calls DELETE /signal/topics/:name', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await signal.deleteTopic('game-updates');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/signal/topics/game-updates',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('getSubscriptions() calls GET /signal/subscriptions', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: [
        {
          id: 'sub-1',
          topic_id: 'topic-1',
          user_id: 'user-1',
          active: true,
          created_at: 1700000000,
        },
      ],
    }));

    await signal.getSubscriptions();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/signal/subscriptions',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

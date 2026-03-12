import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobioClient } from '../src/GlobioClient';
import { GlobioSync } from '../src/modules/GlobioSync';

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

function mockJsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): void {
  vi.mocked(fetch).mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe('GlobioSync', () => {
  let sync: GlobioSync;

  beforeEach(() => {
    MockWebSocket.instances = [];
    Object.defineProperty(globalThis, 'WebSocket', {
      value: MockWebSocket,
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
    sync = new GlobioSync(client);
  });

  it('createRoom() calls POST /sync/rooms with correct body', async () => {
    mockJsonResponse({
      data: {
        id: 'room-1',
        project_id: 'proj-1',
        template_id: null,
        name: 'Arena',
        status: 'waiting',
        current_players: 0,
        max_players: 8,
        state: '{}',
        region: null,
        created_at: 1700000000,
        closed_at: null,
      },
    });

    await sync.createRoom({ name: 'Arena' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/sync/rooms',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Arena' }),
      }),
    );
  });

  it('createRoom() returns a SyncRoom shaped object', async () => {
    mockJsonResponse({
      data: {
        id: 'room-1',
        project_id: 'proj-1',
        template_id: null,
        name: 'Arena',
        status: 'waiting',
        current_players: 0,
        max_players: 8,
        state: '{"round":1}',
        region: null,
        created_at: 1700000000,
        closed_at: null,
      },
    });

    const result = await sync.createRoom({ name: 'Arena' });

    expect(result).toEqual({
      success: true,
      data: {
        id: 'room-1',
        project_id: 'proj-1',
        template_id: null,
        name: 'Arena',
        status: 'waiting',
        current_players: 0,
        max_players: 8,
        state: { round: 1 },
        region: null,
        created_at: 1700000000,
        closed_at: null,
      },
    });
  });

  it('listAvailable() calls GET /sync/rooms/available', async () => {
    mockJsonResponse({ data: [] });

    await sync.listAvailable();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/sync/rooms/available',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('listAvailable() passes template_id as query param when provided', async () => {
    mockJsonResponse({ data: [] });

    await sync.listAvailable('template-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/sync/rooms/available?template_id=template-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getRoom() calls GET /sync/rooms/:roomId', async () => {
    mockJsonResponse({
      data: {
        id: 'room-1',
        project_id: 'proj-1',
        template_id: null,
        name: 'Arena',
        status: 'waiting',
        current_players: 0,
        max_players: 8,
        state: '{}',
        region: null,
        created_at: 1700000000,
        closed_at: null,
      },
    });

    await sync.getRoom('room-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/sync/rooms/room-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('listTemplates() calls GET /sync/templates', async () => {
    mockJsonResponse({ data: [] });

    await sync.listTemplates();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/sync/templates',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('createTemplate() calls POST /sync/templates with correct body', async () => {
    mockJsonResponse({
      data: {
        id: 'template-1',
        name: 'Duel',
        max_players: 2,
        visibility: 'public',
        sync_mode: 'authoritative',
        initial_state: '{}',
        created_at: 1700000000,
      },
    });

    await sync.createTemplate({
      name: 'Duel',
      max_players: 2,
      visibility: 'public',
      sync_mode: 'authoritative',
      initial_state: { round: 1 },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/sync/templates',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Duel',
          max_players: 2,
          visibility: 'public',
          sync_mode: 'authoritative',
          initial_state: { round: 1 },
        }),
      }),
    );
  });

  it('joinRoom() constructs a WebSocket with the current URL', async () => {
    mockJsonResponse({ data: { ticket: 'test-ticket-123', expires_in: 30 } });

    const room = await sync.joinRoom('room-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/sync/rooms/room-1/join-ticket',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-123',
        }),
      }),
    );
    expect(MockWebSocket.instances[0]?.url).toBe(
      'wss://api.example.com/sync/rooms/room-1/ws?ticket=test-ticket-123',
    );
    room.disconnect();
  });

  it('connection.send() sends JSON envelope { type, payload }', async () => {
    mockJsonResponse({ data: { ticket: 'test-ticket-123', expires_in: 30 } });

    const room = await sync.joinRoom('room-1');
    const ws = MockWebSocket.instances[0];

    room.send('event', { action: 'wave' });

    expect(ws.sent).toContain(JSON.stringify({ type: 'event', payload: { action: 'wave' } }));
    room.disconnect();
  });

  it('connection.on("ping") replies with pong message', async () => {
    mockJsonResponse({ data: { ticket: 'test-ticket-123', expires_in: 30 } });

    const room = await sync.joinRoom('room-1');
    const ws = MockWebSocket.instances[0];

    room.on('*', () => {});
    ws.onmessage?.({ data: JSON.stringify({ type: 'ping', payload: { ts: 1 } }) });

    expect(ws.sent).toContain(JSON.stringify({ type: 'pong', payload: {} }));
    room.disconnect();
  });

  it('connection.disconnect() closes the socket', async () => {
    mockJsonResponse({ data: { ticket: 'test-ticket-123', expires_in: 30 } });

    const room = await sync.joinRoom('room-1');
    const ws = MockWebSocket.instances[0];

    room.disconnect();

    expect(ws.closeCode).toBe(1000);
  });

  it('joinRoom() does not use the old token query param', async () => {
    mockJsonResponse({ data: { ticket: 'test-ticket-123', expires_in: 30 } });

    const room = await sync.joinRoom('room-1');

    expect(MockWebSocket.instances[0]?.url).not.toContain('?token=');
    room.disconnect();
  });

  it('joinRoom() throws a clear error if getJoinTicket() fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ error: 'Authentication required' }),
    } as unknown as Response);

    await expect(sync.joinRoom('room-1')).rejects.toThrow(
      'Failed to get join ticket: Authentication required',
    );

    expect(MockWebSocket.instances).toHaveLength(0);
  });
});

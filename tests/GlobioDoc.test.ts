import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobioClient } from '../src/GlobioClient';
import { GlobioDoc } from '../src/modules/GlobioDoc';

function mockJsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): void {
  vi.mocked(fetch).mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe('GlobioDoc', () => {
  let client: GlobioClient;
  let doc: GlobioDoc;

  beforeEach(() => {
    client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    doc = new GlobioDoc(client);
    vi.spyOn(client.offline, 'isOnline').mockResolvedValue(true);
    vi.spyOn(client.offline, 'setDocument').mockResolvedValue();
    vi.spyOn(client.offline, 'deleteDocument').mockResolvedValue();
  });

  it('get() calls the correct endpoint', async () => {
    mockJsonResponse({ data: { id: 'player-1', score: 100 } });

    await doc.get('scores', 'player-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/doc/collections/scores/documents/player-1',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('set() calls the correct endpoint with the correct body', async () => {
    mockJsonResponse({ data: { id: 'player-1', version: 2 } });

    await doc.set('scores', 'player-1', { score: 200 });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/doc/collections/scores/documents/player-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ score: 200 }),
      }),
    );
  });

  it('query() builds the correct query string from options', async () => {
    const setDocumentSpy = vi.mocked(client.offline.setDocument);
    mockJsonResponse({
      data: [{ id: 'player-1', score: 200, level: 10 }],
    });

    await doc.query('scores', {
      where: [{ field: 'level', op: '>=', value: 10 }],
      orderBy: { field: 'score', direction: 'desc' },
      limit: 5,
      startAfter: 'player-0',
    });

    const [url] = vi.mocked(fetch).mock.calls[0];
    const parsedUrl = new URL(url as string);

    expect(parsedUrl.pathname).toBe('/doc/collections/scores/documents/query');
    expect(parsedUrl.searchParams.get('where')).toBe(JSON.stringify([{ field: 'level', op: '>=', value: 10 }]));
    expect(parsedUrl.searchParams.get('orderBy')).toBe(JSON.stringify({ field: 'score', direction: 'desc' }));
    expect(parsedUrl.searchParams.get('limit')).toBe('5');
    expect(parsedUrl.searchParams.get('startAfter')).toBe('player-0');
    expect(setDocumentSpy).toHaveBeenCalledWith('scores', 'player-1', { id: 'player-1', score: 200, level: 10 });
  });

  it('populates cache after get()', async () => {
    const setDocumentSpy = vi.mocked(client.offline.setDocument);
    mockJsonResponse({ data: { id: 'player-1', score: 100 } });

    await doc.get('scores', 'player-1');

    expect(setDocumentSpy).toHaveBeenCalledWith('scores', 'player-1', { id: 'player-1', score: 100 });
  });

  it('invalidates cache after delete()', async () => {
    const deleteDocumentSpy = vi.mocked(client.offline.deleteDocument);
    mockJsonResponse({}, true, 200);

    await doc.delete('scores', 'player-1');

    expect(deleteDocumentSpy).toHaveBeenCalledWith('scores', 'player-1');
  });
});

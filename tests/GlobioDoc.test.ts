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
    vi.spyOn(client.offline, 'getDocument').mockResolvedValue(null);
    vi.spyOn(client.offline, 'setDocument').mockResolvedValue();
    vi.spyOn(client.offline, 'deleteDocument').mockResolvedValue();
  });

  it('get() calls GET /doc/:collection/:docId and returns GlobioDocument metadata', async () => {
    const setDocumentSpy = vi.mocked(client.offline.setDocument);
    mockJsonResponse({
      data: {
        id: 'player-1',
        version: 2,
        created_at: 1700000000,
        updated_at: 1700000100,
        score: 100,
      },
    });

    const result = await doc.get<{ score: number }>('scores', 'player-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/doc/scores/player-1',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(setDocumentSpy).toHaveBeenCalledWith('scores', 'player-1', {
      id: 'player-1',
      version: 2,
      created_at: 1700000000,
      updated_at: 1700000100,
      score: 100,
    });
    expect(result).toEqual({
      success: true,
      data: {
        id: 'player-1',
        version: 2,
        created_at: 1700000000,
        updated_at: 1700000100,
        data: {
          score: 100,
        },
      },
    });
  });

  it('set() calls PUT /doc/:collection/:docId with the correct body', async () => {
    mockJsonResponse({ data: { id: 'player-1', version: 2 } });

    await doc.set('scores', 'player-1', { score: 200 });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/doc/scores/player-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ score: 200 }),
      }),
    );
  });

  it('add() calls PUT /doc/:collection/auto', async () => {
    mockJsonResponse({ data: { id: 'generated-1', version: 1 } });

    await doc.add('scores', { score: 200 });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/doc/scores/auto',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ score: 200 }),
      }),
    );
  });

  it('delete() calls DELETE /doc/:collection/:docId and invalidates cache', async () => {
    const deleteDocumentSpy = vi.mocked(client.offline.deleteDocument);
    mockJsonResponse({ success: true }, true, 200);

    await doc.delete('scores', 'player-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/doc/scores/player-1',
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
    expect(deleteDocumentSpy).toHaveBeenCalledWith('scores', 'player-1');
  });

  it('query() sends POST /doc/:collection/query with a JSON body', async () => {
    const setDocumentSpy = vi.mocked(client.offline.setDocument);
    mockJsonResponse({
      data: [
        {
          id: 'player-1',
          version: 3,
          created_at: 1700000000,
          updated_at: 1700000200,
          score: 200,
          level: 10,
        },
      ],
    });

    const result = await doc.query<{ score: number; level: number }>('scores', {
      where: [{ field: 'level', op: '>=', value: 10 }],
      orderBy: { field: 'score', direction: 'desc' },
      limit: 5,
      startAfter: 'player-0',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/doc/scores/query',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          where: [{ field: 'level', op: '>=', value: 10 }],
          orderBy: { field: 'score', direction: 'desc' },
          limit: 5,
          startAfter: 'player-0',
        }),
      }),
    );
    expect(setDocumentSpy).toHaveBeenCalledWith('scores', 'player-1', {
      id: 'player-1',
      version: 3,
      created_at: 1700000000,
      updated_at: 1700000200,
      score: 200,
      level: 10,
    });
    expect(result).toEqual({
      success: true,
      data: [
        {
          id: 'player-1',
          version: 3,
          created_at: 1700000000,
          updated_at: 1700000200,
          data: {
            score: 200,
            level: 10,
          },
        },
      ],
    });
  });

  it('listCollections() calls GET /doc/collections', async () => {
    mockJsonResponse({
      data: [
        {
          id: 'col_1',
          project_id: 'proj_1',
          name: 'scores',
          parent_collection_id: null,
          parent_document_id: null,
          schema: '{}',
          rules: '{}',
          created_at: 1700000000,
        },
      ],
    });

    await doc.listCollections();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/doc/collections',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('createCollection() calls POST /doc/collections with the correct body', async () => {
    mockJsonResponse({
      data: {
        id: 'col_1',
        project_id: 'proj_1',
        name: 'scores',
        parent_collection_id: null,
        parent_document_id: null,
        schema: '{}',
        rules: '{"read":"authenticated","write":"authenticated"}',
        created_at: 1700000000,
      },
    });

    await doc.createCollection('scores', {
      schema: { type: 'object' },
      rules: { read: 'authenticated', write: 'authenticated' },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/doc/collections',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'scores',
          schema: { type: 'object' },
          rules: { read: 'authenticated', write: 'authenticated' },
        }),
      }),
    );
  });
});

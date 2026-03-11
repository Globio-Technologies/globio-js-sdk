import { GlobioClient } from '../GlobioClient';
import { GlobioResult, DocumentQueryOptions, GlobioDocument, DocCollection, DocIndex } from '../types';
import { WriteBatch } from '../WriteBatch';
import { Transaction } from '../Transaction';

export interface DocSnapshot<T = Record<string, unknown>> {
  id: string;
  version: number;
  created_at: number;
  updated_at: number;
  data: T;
}

export type SnapshotCallback<T> = (snapshot: DocSnapshot<T>[]) => void;
export type Unsubscribe = () => void;

export interface DocOptions {
  offline?: boolean;
  useCache?: boolean;
}

interface BackendDocument<T = Record<string, unknown>> {
  id: string;
  version: number;
  created_at: number;
  updated_at: number;
  [key: string]: unknown;
}

export class GlobioDoc {
  private listeners: Map<string, { callback: SnapshotCallback<unknown>; pollInterval: number; intervalId: ReturnType<typeof setInterval> }> = new Map();

  constructor(private client: GlobioClient) {}

  private normalizeDocument<T = Record<string, unknown>>(doc: BackendDocument<T>): GlobioDocument<T> {
    const { id, version, created_at, updated_at, ...data } = doc;
    return {
      id,
      version,
      created_at,
      updated_at,
      data: data as T,
    };
  }

  async get<T = Record<string, unknown>>(collection: string, documentId: string, options?: DocOptions): Promise<GlobioResult<GlobioDocument<T>>> {
    const isOnline = await this.client.offline.isOnline();

    if (!isOnline || options?.useCache) {
      const cached = await this.client.offline.getDocument(collection, documentId);
      if (cached) {
        return { success: true, data: this.normalizeDocument(cached.data as BackendDocument<T>) };
      }
      if (!isOnline) {
        return { success: false, error: { code: 'OFFLINE', message: 'Document not in cache', status: 0 } };
      }
    }

    const result = await this.client.request<BackendDocument<T>>({
      service: 'doc',
      path: `/${collection}/${documentId}`,
      auth: true,
    });

    if (result.success && options?.offline !== false) {
      await this.client.offline.setDocument(collection, documentId, result.data);
      return { success: true, data: this.normalizeDocument(result.data) };
    }

    return result.success ? { success: true, data: this.normalizeDocument(result.data) } : result;
  }

  async set<T = Record<string, unknown>>(collection: string, documentId: string, data: T, options?: DocOptions): Promise<GlobioResult<{ id: string; version: number }>> {
    const isOnline = await this.client.offline.isOnline();

    if (!isOnline) {
      const now = Math.floor(Date.now() / 1000);
      await this.client.offline.setDocument(collection, documentId, {
        id: documentId,
        version: 0,
        created_at: now,
        updated_at: now,
        ...data,
      });
      await this.client.offline.addPendingWrite({
        id: crypto.randomUUID(),
        type: 'set',
        collection,
        docId: documentId,
        data,
      });
      return { success: true, data: { id: documentId, version: 0 } };
    }

    const result = await this.client.request<{ id: string; version: number }>({
      service: 'doc',
      path: `/${collection}/${documentId}`,
      method: 'PUT',
      body: data,
      auth: true,
    });

    if (result.success && options?.offline !== false) {
      const cached = await this.client.offline.getDocument(collection, documentId);
      const previous = (cached?.data as Record<string, unknown> | undefined) ?? {};
      const now = Math.floor(Date.now() / 1000);
      await this.client.offline.setDocument(collection, documentId, {
        ...previous,
        ...data,
        id: result.data.id,
        version: result.data.version,
        created_at: typeof previous.created_at === 'number' ? previous.created_at : now,
        updated_at: now,
      });
    }

    return result;
  }

  async add<T = Record<string, unknown>>(collection: string, data: T, options?: DocOptions): Promise<GlobioResult<{ id: string; version: number }>> {
    const isOnline = await this.client.offline.isOnline();
    const tempId = crypto.randomUUID();

    if (!isOnline) {
      const tempData = { ...data, _tempId: tempId };
      const now = Math.floor(Date.now() / 1000);
      await this.client.offline.setDocument(collection, tempId, {
        id: tempId,
        version: 0,
        created_at: now,
        updated_at: now,
        ...tempData,
      });
      await this.client.offline.addPendingWrite({
        id: tempId,
        type: 'add',
        collection,
        data: tempData,
      });
      return { success: true, data: { id: tempId, version: 0 } };
    }

    const result = await this.client.request<{ id: string; version: number }>({
      service: 'doc',
      path: `/${collection}/auto`,
      method: 'PUT',
      body: data,
      auth: true,
    });

    return result;
  }

  async delete(collection: string, documentId: string, options?: DocOptions): Promise<GlobioResult<void>> {
    const isOnline = await this.client.offline.isOnline();

    if (!isOnline) {
      await this.client.offline.deleteDocument(collection, documentId);
      await this.client.offline.addPendingWrite({
        id: crypto.randomUUID(),
        type: 'delete',
        collection,
        docId: documentId,
      });
      return { success: true, data: undefined };
    }

    const result = await this.client.request<void>({
      service: 'doc',
      path: `/${collection}/${documentId}`,
      method: 'DELETE',
      auth: true,
    });

    if (result.success && options?.offline !== false) {
      await this.client.offline.deleteDocument(collection, documentId);
    }

    return result;
  }

  async query<T = Record<string, unknown>>(collection: string, options?: DocumentQueryOptions & DocOptions): Promise<GlobioResult<GlobioDocument<T>[]>> {
    const isOnline = await this.client.offline.isOnline();

    if (!isOnline || options?.useCache) {
      const cached = await this.client.offline.queryDocuments(collection, {
        where: options?.where,
        orderBy: options?.orderBy,
        limit: options?.limit,
      });

      if (cached.length > 0 || !isOnline) {
        return { success: true, data: cached.map(c => this.normalizeDocument(c.data as BackendDocument<T>)) };
      }
    }

    const result = await this.client.request<Array<BackendDocument<T>>>({
      service: 'doc',
      path: `/${collection}/query`,
      method: 'POST',
      body: {
        where: options?.where,
        orderBy: options?.orderBy,
        limit: options?.limit,
        startAfter: options?.startAfter,
      },
      auth: true,
    });

    if (result.success && options?.offline !== false) {
      for (const doc of result.data) {
        const docId = doc.id;
        if (typeof docId === 'string' && docId.length > 0) {
          await this.client.offline.setDocument(collection, docId, doc);
        }
      }
      return { success: true, data: result.data.map((doc) => this.normalizeDocument(doc)) };
    }

    return result.success ? { success: true, data: result.data.map((doc) => this.normalizeDocument(doc)) } : result;
  }

  onSnapshot<T = Record<string, unknown>>(
    collection: string,
    options: {
      where?: DocumentQueryOptions['where'];
      orderBy?: DocumentQueryOptions['orderBy'];
      limit?: DocumentQueryOptions['limit'];
    },
    callback: SnapshotCallback<T>
  ): Unsubscribe {
    const listenerKey = `${collection}_${JSON.stringify(options)}`;

    const pollAndNotify = async () => {
      const result = await this.query<T>(collection, {
        where: options.where,
        orderBy: options.orderBy,
        limit: options.limit,
      });

      if (result.success) {
        callback(result.data.map((d) => ({
          id: d.id,
          version: d.version,
          created_at: d.created_at,
          updated_at: d.updated_at,
          data: d.data,
        })));
      }
    };

    pollAndNotify();

    const intervalId = setInterval(pollAndNotify, 5000);

    this.listeners.set(listenerKey, {
      callback: callback as SnapshotCallback<unknown>,
      pollInterval: 5000,
      intervalId,
    });

    return () => {
      const listener = this.listeners.get(listenerKey);
      if (listener) {
        clearInterval(listener.intervalId);
        this.listeners.delete(listenerKey);
      }
    };
  }

  onSnapshotDoc<T = Record<string, unknown>>(
    collection: string,
    documentId: string,
    callback: (snapshot: DocSnapshot<T> | null) => void
  ): Unsubscribe {
    const pollAndNotify = async () => {
      const result = await this.get<T>(collection, documentId);

      if (result.success) {
        callback({
          id: result.data.id,
          version: result.data.version,
          created_at: result.data.created_at,
          updated_at: result.data.updated_at,
          data: result.data.data,
        });
      } else {
        callback(null);
      }
    };

    pollAndNotify();

    const intervalId = setInterval(pollAndNotify, 5000);

    const listenerKey = `${collection}_${documentId}`;
    this.listeners.set(listenerKey, {
      callback: () => {},
      pollInterval: 5000,
      intervalId,
    });

    return () => {
      clearInterval(intervalId);
      this.listeners.delete(listenerKey);
    };
  }

  async syncPending(): Promise<{ synced: number; failed: number }> {
    return this.client.syncPendingWrites();
  }

  async isOnline(): Promise<boolean> {
    return this.client.offline.isOnline();
  }

  removeAllListeners(): void {
    for (const listener of this.listeners.values()) {
      clearInterval(listener.intervalId);
    }
    this.listeners.clear();
  }

  batch(): WriteBatch {
    return new WriteBatch(this.client);
  }

  async listCollections(): Promise<GlobioResult<DocCollection[]>> {
    return this.client.request<DocCollection[]>({
      service: 'doc',
      path: '/collections',
      auth: true,
    });
  }

  async createCollection(name: string, options?: {
    parent_collection_id?: string;
    parent_document_id?: string;
    schema?: Record<string, unknown>;
    rules?: Record<string, unknown>;
  }): Promise<GlobioResult<DocCollection>> {
    return this.client.request<DocCollection>({
      service: 'doc',
      path: '/collections',
      method: 'POST',
      body: { name, ...options },
      auth: true,
    });
  }

  async listIndexes(collection: string): Promise<GlobioResult<DocIndex[]>> {
    return this.client.request<DocIndex[]>({
      service: 'doc',
      path: `/${collection}/indexes`,
      auth: true,
    });
  }

  async createIndex(collection: string, options: {
    field_path: string;
    index_type?: string;
    composite_fields?: string[];
  }): Promise<GlobioResult<DocIndex>> {
    return this.client.request<DocIndex>({
      service: 'doc',
      path: `/${collection}/indexes`,
      method: 'POST',
      body: options,
      auth: true,
    });
  }

  transaction(collection: string): Transaction {
    return new Transaction(this.client, collection);
  }
}

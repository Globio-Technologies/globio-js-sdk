import { GlobioClient } from '../GlobioClient';
import { GlobioResult, DocumentQueryOptions } from '../types';
import { WriteBatch } from '../WriteBatch';
import { Transaction } from '../Transaction';

export interface DocSnapshot<T = Record<string, unknown>> {
  id: string;
  data: T;
}

export type SnapshotCallback<T> = (snapshot: DocSnapshot<T>[]) => void;
export type Unsubscribe = () => void;

export interface DocOptions {
  offline?: boolean;
  useCache?: boolean;
}

export class GlobioDoc {
  private listeners: Map<string, { callback: SnapshotCallback<unknown>; pollInterval: number; intervalId: ReturnType<typeof setInterval> }> = new Map();

  constructor(private client: GlobioClient) {}

  async get<T = Record<string, unknown>>(collection: string, documentId: string, options?: DocOptions): Promise<GlobioResult<T>> {
    const isOnline = await this.client.offline.isOnline();

    if (!isOnline || options?.useCache) {
      const cached = await this.client.offline.getDocument(collection, documentId);
      if (cached) {
        return { success: true, data: cached.data as T };
      }
      if (!isOnline) {
        return { success: false, error: { code: 'OFFLINE', message: 'Document not in cache', status: 0 } };
      }
    }

    const result = await this.client.request<T>({
      service: 'doc',
      path: `/collections/${collection}/documents/${documentId}`,
      auth: true,
    });

    if (result.success && options?.offline !== false) {
      await this.client.offline.setDocument(collection, documentId, result.data);
    }

    return result;
  }

  async set<T = Record<string, unknown>>(collection: string, documentId: string, data: T, options?: DocOptions): Promise<GlobioResult<T>> {
    const isOnline = await this.client.offline.isOnline();

    if (!isOnline) {
      await this.client.offline.setDocument(collection, documentId, data);
      await this.client.offline.addPendingWrite({
        id: crypto.randomUUID(),
        type: 'set',
        collection,
        docId: documentId,
        data,
      });
      return { success: true, data };
    }

    const result = await this.client.request<T>({
      service: 'doc',
      path: `/collections/${collection}/documents/${documentId}`,
      method: 'PUT',
      body: data,
      auth: true,
    });

    if (result.success && options?.offline !== false) {
      await this.client.offline.setDocument(collection, documentId, result.data);
    }

    return result;
  }

  async add<T = Record<string, unknown>>(collection: string, data: T, options?: DocOptions): Promise<GlobioResult<{ id: string; data: T }>> {
    const isOnline = await this.client.offline.isOnline();
    const tempId = crypto.randomUUID();

    if (!isOnline) {
      const tempData = { ...data, _tempId: tempId };
      await this.client.offline.addPendingWrite({
        id: tempId,
        type: 'add',
        collection,
        data: tempData,
      });
      return { success: true, data: { id: tempId, data: tempData as T } };
    }

    const result = await this.client.request<{ id: string; data: T }>({
      service: 'doc',
      path: `/collections/${collection}/documents`,
      method: 'POST',
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
      path: `/collections/${collection}/documents/${documentId}`,
      method: 'DELETE',
      auth: true,
    });

    if (result.success && options?.offline !== false) {
      await this.client.offline.deleteDocument(collection, documentId);
    }

    return result;
  }

  async query<T = Record<string, unknown>>(collection: string, options?: DocumentQueryOptions & DocOptions): Promise<GlobioResult<T[]>> {
    const isOnline = await this.client.offline.isOnline();

    if (!isOnline || options?.useCache) {
      const cached = await this.client.offline.queryDocuments(collection, {
        where: options?.where,
        orderBy: options?.orderBy,
        limit: options?.limit,
      });

      if (cached.length > 0 || !isOnline) {
        return { success: true, data: cached.map(c => c.data as T) };
      }
    }

    const params = new URLSearchParams();
    if (options?.where) params.set('where', JSON.stringify(options.where));
    if (options?.orderBy) params.set('orderBy', JSON.stringify(options.orderBy));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.startAfter) params.set('startAfter', options.startAfter);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const result = await this.client.request<T[]>({
      service: 'doc',
      path: `/collections/${collection}/documents/query${qs}`,
      auth: true,
    });

    if (result.success && options?.offline !== false) {
      for (const doc of result.data) {
        const docId = (doc as { id?: unknown }).id;
        if (typeof docId === 'string' && docId.length > 0) {
          await this.client.offline.setDocument(collection, docId, doc);
        }
      }
    }

    return result;
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
        callback(result.data.map((d, i) => ({
          id: (d as any)?.id || String(i),
          data: d,
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
        callback({ id: documentId, data: result.data });
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

  transaction(collection: string): Transaction {
    return new Transaction(this.client, collection);
  }
}

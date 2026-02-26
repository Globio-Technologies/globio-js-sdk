import { GlobioClient } from './GlobioClient';

interface BatchWrite {
  type: 'set' | 'add' | 'delete';
  collection: string;
  docId?: string;
  data?: unknown;
}

export class WriteBatch {
  private writes: BatchWrite[] = [];
  private client: GlobioClient;

  constructor(client: GlobioClient) {
    this.client = client;
  }

  set<T = Record<string, unknown>>(collection: string, docId: string, data: T): WriteBatch {
    this.writes.push({ type: 'set', collection, docId, data });
    return this;
  }

  add<T = Record<string, unknown>>(collection: string, data: T): WriteBatch {
    this.writes.push({ type: 'add', collection, data });
    return this;
  }

  delete(collection: string, docId: string): WriteBatch {
    this.writes.push({ type: 'delete', collection, docId });
    return this;
  }

  async commit(): Promise<{ success: boolean; committed: number; errors: string[] }> {
    if (this.writes.length === 0) {
      return { success: true, committed: 0, errors: [] };
    }

    const errors: string[] = [];
    let committed = 0;

    for (const write of this.writes) {
      try {
        if (write.type === 'set' && write.docId) {
          await this.client.request({
            service: 'doc',
            path: `/collections/${write.collection}/documents/${write.docId}`,
            method: 'PUT',
            body: write.data,
            auth: true,
          });
          committed++;
        } else if (write.type === 'add') {
          await this.client.request({
            service: 'doc',
            path: `/collections/${write.collection}/documents`,
            method: 'POST',
            body: write.data,
            auth: true,
          });
          committed++;
        } else if (write.type === 'delete' && write.docId) {
          await this.client.request({
            service: 'doc',
            path: `/collections/${write.collection}/documents/${write.docId}`,
            method: 'DELETE',
            auth: true,
          });
          committed++;
        }
      } catch (e: any) {
        errors.push(e.message || 'Write failed');
      }
    }

    this.writes = [];
    return { success: errors.length === 0, committed, errors };
  }
}

export class WriteBatchManager {
  private currentBatch: WriteBatch | null = null;
  private client: GlobioClient;

  constructor(client: GlobioClient) {
    this.client = client;
  }

  batch(): WriteBatch {
    if (!this.currentBatch) {
      this.currentBatch = new WriteBatch(this.client);
    }
    return this.currentBatch;
  }

  async commit(): Promise<{ success: boolean; committed: number; errors: string[] }> {
    if (!this.currentBatch) {
      return { success: true, committed: 0, errors: [] };
    }

    const result = await this.currentBatch.commit();
    this.currentBatch = null;
    return result;
  }
}

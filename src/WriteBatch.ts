import { GlobioClient } from './GlobioClient';

interface BatchSetOp {
  type: 'set';
  collection: string;
  docId: string;
  data: Record<string, unknown>;
}

interface BatchAddOp {
  type: 'add';
  collection: string;
  data: Record<string, unknown>;
}

interface BatchDeleteOp {
  type: 'delete';
  collection: string;
  docId: string;
}

type BatchOp = BatchSetOp | BatchAddOp | BatchDeleteOp;

export class WriteBatch {
  private operations: BatchOp[] = [];

  constructor(private client: GlobioClient) {}

  set<T = Record<string, unknown>>(collection: string, docId: string, data: T): WriteBatch {
    this.operations.push({
      type: 'set',
      collection,
      docId,
      data: data as Record<string, unknown>,
    });
    return this;
  }

  add<T = Record<string, unknown>>(collection: string, data: T): WriteBatch {
    this.operations.push({
      type: 'add',
      collection,
      data: data as Record<string, unknown>,
    });
    return this;
  }

  delete(collection: string, docId: string): WriteBatch {
    this.operations.push({
      type: 'delete',
      collection,
      docId,
    });
    return this;
  }

  clear(): void {
    this.operations = [];
  }

  size(): number {
    return this.operations.length;
  }

  async commit(): Promise<{ success: boolean; committed: number; errors: string[] }> {
    const errors: string[] = [];
    let committed = 0;

    for (const operation of this.operations) {
      let result;

      if (operation.type === 'set') {
        result = await this.client.request({
          service: 'doc',
          path: `/collections/${operation.collection}/documents/${operation.docId}`,
          method: 'PUT',
          body: operation.data,
          auth: true,
        });
      } else if (operation.type === 'add') {
        result = await this.client.request({
          service: 'doc',
          path: `/collections/${operation.collection}/documents`,
          method: 'POST',
          body: operation.data,
          auth: true,
        });
      } else {
        result = await this.client.request({
          service: 'doc',
          path: `/collections/${operation.collection}/documents/${operation.docId}`,
          method: 'DELETE',
          auth: true,
        });
      }

      if (result.success) {
        committed++;
      } else {
        errors.push(`${operation.type}:${operation.collection}${'docId' in operation ? `/${operation.docId}` : ''}:${result.error.message}`);
      }
    }

    this.clear();

    return {
      success: errors.length === 0,
      committed,
      errors,
    };
  }
}

export class WriteBatchManager {
  private currentBatch: WriteBatch | null = null;

  constructor(private client: GlobioClient) {}

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

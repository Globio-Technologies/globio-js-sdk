import { GlobioClient } from './GlobioClient';
import { GlobioResult } from './types';

interface TransactionRead {
  op: 'get';
  docId: string;
}

interface TransactionWrite {
  op: 'set' | 'delete';
  docId: string;
  data?: Record<string, unknown>;
}

type TransactionOp = TransactionRead | TransactionWrite;

export class Transaction {
  private reads: TransactionRead[] = [];
  private writes: TransactionWrite[] = [];
  private client: GlobioClient;
  private collection: string;

  constructor(client: GlobioClient, collection: string) {
    this.client = client;
    this.collection = collection;
  }

  get<T = Record<string, unknown>>(docId: string): Transaction {
    this.reads.push({ op: 'get', docId });
    return this;
  }

  set<T = Record<string, unknown>>(docId: string, data: T): Transaction {
    this.writes.push({ op: 'set', docId, data: data as Record<string, unknown> });
    return this;
  }

  delete(docId: string): Transaction {
    this.writes.push({ op: 'delete', docId });
    return this;
  }

  async commit(): Promise<GlobioResult<{ results: Array<{ op: string; docId: string; success: boolean; data?: unknown; error?: string }> }>> {
    const operations: TransactionOp[] = [...this.reads, ...this.writes];

    const result = await this.client.request<{
      results: Array<{ op: string; docId: string; success: boolean; data?: unknown; error?: string }>
    }>({
      service: 'doc',
      path: '/transaction',
      method: 'POST',
      body: {
        collectionName: this.collection,
        operations,
      },
      auth: true,
    });

    return result;
  }
}

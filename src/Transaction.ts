import { GlobioClient } from './GlobioClient';

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

interface TransactionResult {
  op: 'get' | 'set' | 'delete';
  docId: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Transactions in GlobalDoc are NOT atomic.
 * Operations execute sequentially. A failure in one operation
 * does not roll back previous operations.
 * results[] contains the per-operation outcome.
 */
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

  async commit(): Promise<{
    success: boolean;
    results: TransactionResult[];
  }> {
    const operations: TransactionOp[] = [...this.reads, ...this.writes];
    const session = this.client.session.get();

    if (this.client.session.isExpired() && session?.refresh_token) {
      const refreshResult = await this.client.request<{ access_token: string }>({
        service: 'id',
        path: '/auth/refresh',
        method: 'POST',
        body: { refresh_token: session.refresh_token },
      });

      if (refreshResult.success) {
        this.client.session.set({
          ...session,
          access_token: refreshResult.data.access_token,
          expires_at: Math.floor(Date.now() / 1000) + (15 * 60),
        });
      } else {
        this.client.session.clear();
        return { success: false, results: [] };
      }
    }

    const authSession = this.client.session.get();
    const response = await fetch(`${this.client.config.baseUrl}/doc/transaction`, {
      method: 'POST',
      headers: {
        'X-Globio-Key': this.client.config.apiKey,
        'Content-Type': 'application/json',
        ...(authSession ? { Authorization: `Bearer ${authSession.access_token}` } : {}),
      },
      body: JSON.stringify({
        collectionName: this.collection,
        operations,
      }),
    });

    const responseBody = await response.json().catch(() => ({})) as {
      success?: boolean;
      results?: TransactionResult[];
    };

    return {
      success: Boolean(response.ok && responseBody.success),
      results: responseBody.results ?? [],
    };
  }
}

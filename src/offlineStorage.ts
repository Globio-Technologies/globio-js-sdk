const DB_NAME = 'globio-offline';
const DB_VERSION = 2;
const DEFAULT_CACHE_SIZE_MB = 50;

interface DBSchema {
  documents: {
    key: string;
    value: {
      collection: string;
      docId: string;
      data: unknown;
      updatedAt: number;
      synced: boolean;
    };
  };
  pendingWrites: {
    key: string;
    value: {
      id: string;
      type: 'set' | 'add' | 'delete';
      collection: string;
      docId?: string;
      data?: unknown;
      timestamp: number;
    };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      value: string;
    };
  };
}

let db: IDBDatabase | null = null;
let persistenceEnabled = true;

interface CacheConfig {
  maxSizeMB: number;
}

async function openDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains('documents')) {
        database.createObjectStore('documents', { keyPath: ['collection', 'docId'] });
      }
      
      if (!database.objectStoreNames.contains('pendingWrites')) {
        database.createObjectStore('pendingWrites', { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains('metadata')) {
        database.createObjectStore('metadata', { keyPath: 'key' });
      }
    };
  });
}

async function calculateDBSize(database: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('documents', 'readonly');
    const store = transaction.objectStore('documents');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const totalSize = request.result.reduce((acc: number, doc: any) => {
        return acc + JSON.stringify(doc.data).length;
      }, 0);
      resolve(totalSize / (1024 * 1024));
    };
  });
}

export class OfflineStorage {
  private config: CacheConfig = { maxSizeMB: DEFAULT_CACHE_SIZE_MB };

  setConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  enablePersistence(): void {
    persistenceEnabled = true;
  }

  disablePersistence(): void {
    persistenceEnabled = false;
  }

  isPersistenceEnabled(): boolean {
    return persistenceEnabled;
  }

  async getDocument(collection: string, docId: string): Promise<{ data: unknown; updatedAt: number } | null> {
    if (!persistenceEnabled) return null;
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('documents', 'readonly');
      const store = transaction.objectStore('documents');
      const key = [collection, docId];
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result) {
          resolve({ data: request.result.data, updatedAt: request.result.updatedAt });
        } else {
          resolve(null);
        }
      };
    });
  }

  async setDocument(collection: string, docId: string, data: unknown): Promise<void> {
    if (!persistenceEnabled) return;
    
    const currentSize = await this.getCacheSize();
    const dataSize = JSON.stringify(data).length / (1024 * 1024);
    
    if (currentSize + dataSize > this.config.maxSizeMB) {
      await this.evictOldest(10);
    }

    const database = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('documents', 'readwrite');
      const store = transaction.objectStore('documents');
      const request = store.put({
        collection,
        docId,
        data,
        updatedAt: Date.now(),
        synced: true,
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async deleteDocument(collection: string, docId: string): Promise<void> {
    if (!persistenceEnabled) return;
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('documents', 'readwrite');
      const store = transaction.objectStore('documents');
      const request = store.delete([collection, docId]);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async queryDocuments(
    collection: string,
    options?: {
      where?: Array<{ field: string; op: string; value: unknown }>;
      orderBy?: { field: string; direction: 'asc' | 'desc' };
      limit?: number;
    }
  ): Promise<Array<{ docId: string; data: unknown }>> {
    if (!persistenceEnabled) return [];
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('documents', 'readonly');
      const store = transaction.objectStore('documents');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        let results = request.result.filter((doc: any) => doc.collection === collection);

        if (options?.where) {
          for (const filter of options.where) {
            results = results.filter((doc: any) => {
              const value = doc.data[filter.field];
              const filterVal = filter.value as any;
              switch (filter.op) {
                case '==': return value === filterVal;
                case '!=': return value !== filterVal;
                case '>': return value > filterVal;
                case '<': return value < filterVal;
                case '>=': return value >= filterVal;
                case '<=': return value <= filterVal;
                case 'array-contains': return Array.isArray(value) && value.includes(filterVal);
                default: return true;
              }
            });
          }
        }

        if (options?.orderBy) {
          results.sort((a: any, b: any) => {
            const aVal = a.data[options.orderBy!.field];
            const bVal = b.data[options.orderBy!.field];
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return options.orderBy!.direction === 'desc' ? -cmp : cmp;
          });
        }

        if (options?.limit) {
          results = results.slice(0, options.limit);
        }

        resolve(results.map((doc: any) => ({ docId: doc.docId, data: doc.data })));
      };
    });
  }

  async addPendingWrite(write: { id: string; type: 'set' | 'add' | 'delete'; collection: string; docId?: string; data?: unknown }): Promise<void> {
    if (!persistenceEnabled) return;
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('pendingWrites', 'readwrite');
      const store = transaction.objectStore('pendingWrites');
      const request = store.put({ ...write, timestamp: Date.now() });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getPendingWrites(): Promise<Array<{ id: string; type: 'set' | 'add' | 'delete'; collection: string; docId?: string; data?: unknown; timestamp: number }>> {
    if (!persistenceEnabled) return [];
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('pendingWrites', 'readonly');
      const store = transaction.objectStore('pendingWrites');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result.sort((a: any, b: any) => a.timestamp - b.timestamp));
      };
    });
  }

  async removePendingWrite(id: string): Promise<void> {
    if (!persistenceEnabled) return;
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('pendingWrites', 'readwrite');
      const store = transaction.objectStore('pendingWrites');
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearPendingWrites(): Promise<void> {
    if (!persistenceEnabled) return;
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('pendingWrites', 'readwrite');
      const store = transaction.objectStore('pendingWrites');
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async isOnline(): Promise<boolean> {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  async getCacheSize(): Promise<number> {
    if (!persistenceEnabled) return 0;
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('documents', 'readonly');
      const store = transaction.objectStore('documents');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const totalSize = request.result.reduce((acc: number, doc: any) => {
          return acc + JSON.stringify(doc.data).length;
        }, 0);
        resolve(totalSize / (1024 * 1024));
      };
    });
  }

  async clearCache(): Promise<void> {
    if (!persistenceEnabled) return;
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('documents', 'readwrite');
      const store = transaction.objectStore('documents');
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private async evictOldest(percent: number): Promise<void> {
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('documents', 'readwrite');
      const store = transaction.objectStore('documents');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const docs = request.result.sort((a: any, b: any) => a.updatedAt - b.updatedAt);
        const toDelete = Math.floor(docs.length * (percent / 100));
        
        for (let i = 0; i < toDelete; i++) {
          store.delete([docs[i].collection, docs[i].docId]);
        }
        resolve();
      };
    });
  }

  async terminate(): Promise<void> {
    if (db) {
      db.close();
      db = null;
    }
    persistenceEnabled = false;
  }

  async waitForPendingWrites(timeoutMs: number = 10_000): Promise<void> {
    const startedAt = Date.now();

    while (true) {
      const pending = await this.getPendingWrites();
      if (pending.length === 0) break;
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error('waitForPendingWrites timed out — some writes may still be pending');
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

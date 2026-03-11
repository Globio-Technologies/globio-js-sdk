import { GlobioConfig, GlobioResult, GlobioError } from './types';
import { SessionManager } from './session';
import { parseError } from './errors';
import { OfflineStorage } from './offlineStorage';

const DEFAULT_BASE_URL = 'https://api.globio.stanlink.online';

export class GlobioClient {
  public readonly config: Required<GlobioConfig>;
  public readonly session: SessionManager;
  public readonly offline: OfflineStorage;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  constructor(config: GlobioConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      environment: config.environment ?? 'production',
      storage: config.storage ?? (typeof localStorage !== 'undefined' ? 'localStorage' : 'memory'),
    };
    this.session = new SessionManager(this.config.storage);
    this.offline = new OfflineStorage();

    this.initOnlineListener();
  }

  private initOnlineListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.syncPendingWrites();
    });

    window.addEventListener('offline', () => {
    });

    if (navigator.onLine) {
      this.syncPendingWrites();
    } else {
      this.startSyncInterval();
    }
  }

  private startSyncInterval(): void {
    if (this.syncInterval) return;
    
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncPendingWrites();
      }
    }, 30000);
  }

  async syncPendingWrites(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing) return { synced: 0, failed: 0 };
    this.isSyncing = true;

    const pending = await this.offline.getPendingWrites();
    if (pending.length === 0) {
      this.isSyncing = false;
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const write of pending) {
      try {
        if (write.type === 'set' && write.docId) {
          await this.request({
            service: 'doc',
            path: `/${write.collection}/${write.docId}`,
            method: 'PUT',
            body: write.data,
            auth: true,
          });
        } else if (write.type === 'add') {
          const result = await this.request<{ id: string; version: number }>({
            service: 'doc',
            path: `/${write.collection}/auto`,
            method: 'PUT',
            body: write.data,
            auth: true,
          });
          if (result.success) {
            const tempId = typeof write.data === 'object' && write.data !== null
              ? (write.data as { _tempId?: unknown })._tempId
              : undefined;

            if (typeof tempId === 'string' && tempId.length > 0) {
              // Best-effort reconciliation: local state using the temp id is not updated automatically.
              await this.offline.deleteDocument(write.collection, tempId);
            }

            await this.offline.setDocument(write.collection, result.data.id, {
              ...(typeof write.data === 'object' && write.data !== null ? write.data as Record<string, unknown> : {}),
              id: result.data.id,
              version: result.data.version,
            });
          } else {
            throw new Error(result.error.message);
          }
        } else if (write.type === 'delete' && write.docId) {
          await this.request({
            service: 'doc',
            path: `/${write.collection}/${write.docId}`,
            method: 'DELETE',
            auth: true,
          });
        }

        await this.offline.removePendingWrite(write.id);
        synced++;
      } catch {
        failed++;
      }
    }

    this.isSyncing = false;
    return { synced, failed };
  }

  async request<T>(options: {
    service: string;
    path: string;
    method?: string;
    body?: unknown;
    auth?: boolean;
    headers?: Record<string, string>;
  }): Promise<GlobioResult<T>> {
    const { service, path, method = 'GET', body, auth = false, headers = {} } = options;

    if (auth && this.session.isExpired() && this.session.get()?.refresh_token) {
      await this.refreshSession();
    }

    const url = `${this.config.baseUrl}/${service}${path}`;

    const requestHeaders: Record<string, string> = {
      'X-Globio-Key': this.config.apiKey,
      ...headers,
    };

    let requestBody: BodyInit | undefined;
    if (body instanceof FormData) {
      requestBody = body;
      delete requestHeaders['Content-Type'];
    } else if (body) {
      requestBody = JSON.stringify(body);
      requestHeaders['Content-Type'] = 'application/json';
    }

    if (auth) {
      const session = this.session.get();
      if (session) requestHeaders['Authorization'] = `Bearer ${session.access_token}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
      });

      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { success: false, error: parseError(response.status, responseBody) };
      }

      const data = (responseBody as { data?: T }).data ?? (responseBody as T);
      return { success: true, data: data as T };
    } catch {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: 'Network request failed', status: 0 },
      };
    }
  }

  private async refreshSession(): Promise<void> {
    const session = this.session.get();
    if (!session?.refresh_token) return;

    const result = await this.request<{ access_token: string }>({
      service: 'id',
      path: '/auth/refresh',
      method: 'POST',
      body: { refresh_token: session.refresh_token },
    });

    if (result.success) {
      this.session.set({
        ...session,
        access_token: result.data.access_token,
        expires_at: Math.floor(Date.now() / 1000) + (15 * 60),
      });
    } else {
      this.session.clear();
    }
  }
}

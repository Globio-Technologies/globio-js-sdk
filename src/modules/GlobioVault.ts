import { GlobioClient } from '../GlobioClient';
import { parseError } from '../errors';
import { GlobioResult, GlobioError, AccessLevel, VaultFolder, VaultFile, MultipartUploadInit, DownloadUrl, VaultListFilesResult } from '../types';

type RawVaultFile = Omit<VaultFile, 'metadata'> & {
  metadata: Record<string, unknown> | string;
};

export class GlobioVault {
  constructor(private client: GlobioClient) {}

  private normalizeVaultFile(file: RawVaultFile): VaultFile {
    if (typeof file.metadata === 'string') {
      try {
        return { ...file, metadata: JSON.parse(file.metadata) as Record<string, unknown> };
      } catch {
        return { ...file, metadata: {} };
      }
    }

    const metadata = file.metadata;
    return { ...file, metadata };
  }

  private async requestRaw<T>(options: {
    path: string;
    method?: string;
    auth?: boolean;
  }): Promise<GlobioResult<T>> {
    const { path, method = 'GET', auth = false } = options;
    const session = this.client.session.get();

    if (auth && this.client.session.isExpired() && session?.refresh_token) {
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
        return { success: false, error: refreshResult.error };
      }
    }

    const activeSession = this.client.session.get();

    try {
      const response = await fetch(`${this.client.config.baseUrl}/vault${path}`, {
        method,
        headers: {
          'X-Globio-Key': this.client.config.apiKey,
          ...(auth && activeSession ? { Authorization: `Bearer ${activeSession.access_token}` } : {}),
        },
      });

      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { success: false, error: parseError(response.status, responseBody) };
      }

      return { success: true, data: responseBody as T };
    } catch {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: 'Network request failed', status: 0 } as GlobioError,
      };
    }
  }

  async createFolder(name: string, options?: { parent_folder_id?: string; access?: AccessLevel }): Promise<GlobioResult<VaultFolder>> {
    return this.client.request<VaultFolder>({
      service: 'vault',
      path: '/vault/folders',
      method: 'POST',
      body: { name, ...options },
      auth: true,
    });
  }

  async listFolders(parentFolderId?: string): Promise<GlobioResult<VaultFolder[]>> {
    const qs = parentFolderId ? `?parent_folder_id=${encodeURIComponent(parentFolderId)}` : '';
    return this.client.request<VaultFolder[]>({
      service: 'vault',
      path: `/vault/folders${qs}`,
      auth: true,
    });
  }

  async deleteFolder(folderId: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'vault',
      path: `/vault/folders/${folderId}`,
      method: 'DELETE',
      auth: true,
    });
  }

  async uploadFile(file: File, options?: { folder_id?: string; access?: AccessLevel; metadata?: Record<string, unknown> }): Promise<GlobioResult<VaultFile>> {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.folder_id) formData.append('folder_id', options.folder_id);
    if (options?.access) formData.append('access', options.access);
    if (options?.metadata) formData.append('metadata', JSON.stringify(options.metadata));

    const result = await this.client.request<RawVaultFile>({
      service: 'vault',
      path: '/vault/files',
      method: 'POST',
      body: formData,
      auth: true,
    });

    return result.success ? { success: true, data: this.normalizeVaultFile(result.data) } : result;
  }

  async initMultipartUpload(filename: string, options?: { folder_id?: string; access?: AccessLevel; metadata?: Record<string, unknown> }): Promise<GlobioResult<MultipartUploadInit>> {
    return this.client.request<MultipartUploadInit>({
      service: 'vault',
      path: '/vault/files/multipart',
      method: 'POST',
      body: { filename, ...options },
      auth: true,
    });
  }

  async completeMultipartUpload(data: {
    file_id: string;
    upload_id: string;
    r2_key: string;
    filename: string;
    folder_id?: string;
    access?: AccessLevel;
    metadata?: Record<string, unknown>;
    size_bytes: number;
    parts: Array<{ etag: string; partNumber: number }>;
  }): Promise<GlobioResult<VaultFile>> {
    const result = await this.client.request<RawVaultFile>({
      service: 'vault',
      path: '/vault/files/multipart/complete',
      method: 'POST',
      body: data,
      auth: true,
    });

    return result.success ? { success: true, data: this.normalizeVaultFile(result.data) } : result;
  }

  async getFile(fileId: string): Promise<GlobioResult<VaultFile>> {
    return this.client.request<VaultFile>({
      service: 'vault',
      path: `/vault/files/${fileId}`,
      auth: true,
    });
  }

  async getDownloadUrl(fileId: string, expiresIn: number = 3600): Promise<GlobioResult<DownloadUrl>> {
    return this.client.request<DownloadUrl>({
      service: 'vault',
      path: `/vault/files/${fileId}/url?expires_in=${expiresIn}`,
      auth: true,
    });
  }

  async listFiles(options?: { folder_id?: string; limit?: number; cursor?: string }): Promise<GlobioResult<VaultListFilesResult>> {
    const params = new URLSearchParams();
    if (options?.folder_id) params.set('folder_id', options.folder_id);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const result = await this.requestRaw<{ data?: VaultFile[]; next_cursor?: string | null } | VaultFile[]>({
      path: `/files${qs}`,
      auth: true,
    });

    if (!result.success) return result;

    if (Array.isArray(result.data)) {
      return { success: true, data: { files: result.data, next_cursor: null } };
    }

    return {
      success: true,
      data: {
        files: Array.isArray(result.data.data) ? result.data.data : [],
        next_cursor: result.data.next_cursor ?? null,
      },
    };
  }

  async updateFileAccess(fileId: string, access: AccessLevel): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'vault',
      path: `/vault/files/${fileId}/access`,
      method: 'PATCH',
      body: { access },
      auth: true,
    });
  }

  async deleteFile(fileId: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'vault',
      path: `/vault/files/${fileId}`,
      method: 'DELETE',
      auth: true,
    });
  }

  async uploadSmallFile(file: File, folderId?: string): Promise<GlobioResult<VaultFile>> {
    return this.uploadFile(file, { folder_id: folderId });
  }

  async uploadLargeFile(
    file: File,
    folderId?: string,
    access: AccessLevel = 'private',
    metadata?: Record<string, unknown>,
    onProgress?: (progress: number) => void
  ): Promise<GlobioResult<VaultFile>> {
    void file;
    void folderId;
    void access;
    void metadata;
    void onProgress;

    console.warn(
      'GlobalVault: large file multipart upload is not yet supported in this backend version. Use uploadFile() for files under 100MB.'
    );
    throw new Error(
      'Multipart upload backend not implemented. Files must be under 100MB for direct upload.'
    );
  }
}

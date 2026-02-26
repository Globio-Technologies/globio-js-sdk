import { GlobioClient } from '../GlobioClient';
import { GlobioResult } from '../types';

export type AccessLevel = 'public' | 'private' | 'authenticated';

export interface VaultFolder {
  id: string;
  project_id: string;
  name: string;
  parent_folder_id: string | null;
  owner_user_id: string | null;
  access: AccessLevel;
  created_at: number;
}

export interface VaultFile {
  id: string;
  project_id: string;
  folder_id: string | null;
  owner_user_id: string | null;
  filename: string;
  r2_key: string;
  mime_type: string | null;
  size_bytes: number;
  access: AccessLevel;
  metadata: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface MultipartUploadInit {
  file_id: string;
  upload_url: string;
  upload_id: string;
  r2_key: string;
}

export interface DownloadUrl {
  url: string;
  expires_in: number | null;
  filename: string;
  mime_type: string | null;
  size_bytes: number;
}

export interface ListResult<T> {
  data: T[];
  next_cursor: string | null;
}

export class GlobioVault {
  constructor(private client: GlobioClient) {}

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

    return this.client.request<VaultFile>({
      service: 'vault',
      path: '/vault/files',
      method: 'POST',
      body: formData as unknown as Record<string, unknown>,
      headers: { 'Content-Type': 'multipart/form-data' },
      auth: true,
    });
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
    return this.client.request<VaultFile>({
      service: 'vault',
      path: '/vault/files/multipart/complete',
      method: 'POST',
      body: data,
      auth: true,
    });
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

  async listFiles(options?: { folder_id?: string; limit?: number; cursor?: string }): Promise<GlobioResult<ListResult<VaultFile>>> {
    const params = new URLSearchParams();
    if (options?.folder_id) params.set('folder_id', options.folder_id);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);
    const qs = params.toString() ? `?${params.toString()}` : '';

    return this.client.request<ListResult<VaultFile>>({
      service: 'vault',
      path: `/vault/files${qs}`,
      auth: true,
    });
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
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);

    const initResult = await this.initMultipartUpload(file.name, { folder_id: folderId, access, metadata });
    if (!initResult.success) return initResult;

    const { file_id, upload_url, upload_id, r2_key } = initResult.data;
    const parts: Array<{ etag: string; partNumber: number }> = [];

    for (let i = 0; i < totalParts; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const uploadResponse = await fetch(`${upload_url}&partNumber=${i + 1}`, {
        method: 'PUT',
        body: chunk,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed for part ${i + 1}`);
      }

      const etag = uploadResponse.headers.get('ETag');
      if (!etag) throw new Error(`No ETag for part ${i + 1}`);

      parts.push({ etag, partNumber: i + 1 });
      onProgress?.(((i + 1) / totalParts) * 100);
    }

    return this.completeMultipartUpload({
      file_id,
      upload_id,
      r2_key,
      filename: file.name,
      folder_id: folderId,
      access,
      metadata,
      size_bytes: file.size,
      parts,
    });
  }
}

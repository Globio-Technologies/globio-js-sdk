import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobioClient } from '../src/GlobioClient';
import { GlobioVault } from '../src/modules/GlobioVault';

function mockJsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): void {
  vi.mocked(fetch).mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    headers: { get: vi.fn() },
  } as unknown as Response);
}

describe('GlobioVault', () => {
  let client: GlobioClient;
  let vault: GlobioVault;

  beforeEach(() => {
    client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    vault = new GlobioVault(client);
  });

  it('uploadFile() sends POST /vault/files as FormData', async () => {
    mockJsonResponse({
      data: {
        id: 'file-1',
        project_id: 'proj-1',
        folder_id: 'folder-1',
        owner_user_id: 'user-1',
        filename: 'avatar.png',
        r2_key: 'proj-1/vault/folder-1/file-1/avatar.png',
        mime_type: 'image/png',
        size_bytes: 123,
        access: 'private',
        metadata: '{"level":5}',
        created_at: 1700000000,
        updated_at: 1700000001,
      },
    });

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    const result = await vault.uploadFile(file, {
      folder_id: 'folder-1',
      access: 'private',
      metadata: { level: 5 },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/vault/vault/files',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );
    const [, requestInit] = vi.mocked(fetch).mock.calls[0];
    const formData = requestInit?.body as FormData;
    expect(formData.get('folder_id')).toBe('folder-1');
    expect(formData.get('access')).toBe('private');
    expect(formData.get('metadata')).toBe(JSON.stringify({ level: 5 }));
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        id: 'file-1',
        metadata: { level: 5 },
      }),
    });
  });

  it('uploadFile() normalizes metadata from string to object', async () => {
    mockJsonResponse({
      data: {
        id: 'file-2',
        project_id: 'proj-1',
        folder_id: null,
        owner_user_id: 'user-1',
        filename: 'readme.txt',
        r2_key: 'proj-1/vault/root/file-2/readme.txt',
        mime_type: 'text/plain',
        size_bytes: 8,
        access: 'private',
        metadata: '{"tag":"docs"}',
        created_at: 1700000000,
        updated_at: 1700000001,
      },
    });

    const file = new File(['content'], 'readme.txt', { type: 'text/plain' });
    const result = await vault.uploadFile(file);

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        id: 'file-2',
        metadata: { tag: 'docs' },
      }),
    });
  });

  it('listFiles() returns files and next_cursor when more pages exist', async () => {
    mockJsonResponse({
      success: true,
      data: [
        {
          id: 'file-1',
          project_id: 'proj-1',
          folder_id: null,
          owner_user_id: 'user-1',
          filename: 'a.png',
          r2_key: 'proj-1/vault/root/file-1/a.png',
          mime_type: 'image/png',
          size_bytes: 123,
          access: 'private',
          metadata: {},
          created_at: 1700000000,
          updated_at: 1700000001,
        },
      ],
      next_cursor: 'file-1',
    });

    const result = await vault.listFiles();

    expect(result).toEqual({
      success: true,
      data: {
        files: [
          expect.objectContaining({
            id: 'file-1',
            filename: 'a.png',
          }),
        ],
        next_cursor: 'file-1',
      },
    });
  });

  it('listFiles() returns next_cursor null when there are no more pages', async () => {
    mockJsonResponse({
      success: true,
      data: [],
      next_cursor: null,
    });

    const result = await vault.listFiles();

    expect(result).toEqual({
      success: true,
      data: {
        files: [],
        next_cursor: null,
      },
    });
  });

  it('getFile() calls GET /vault/files/:fileId', async () => {
    mockJsonResponse({
      data: {
        id: 'file-1',
        project_id: 'proj-1',
        folder_id: null,
        owner_user_id: 'user-1',
        filename: 'a.png',
        r2_key: 'proj-1/vault/root/file-1/a.png',
        mime_type: 'image/png',
        size_bytes: 123,
        access: 'private',
        metadata: {},
        created_at: 1700000000,
        updated_at: 1700000001,
      },
    });

    await vault.getFile('file-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/vault/vault/files/file-1',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('deleteFile() calls DELETE /vault/files/:fileId', async () => {
    mockJsonResponse({ success: true });

    await vault.deleteFile('file-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/vault/vault/files/file-1',
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });

  it('createFolder() calls POST /vault/folders with correct body', async () => {
    mockJsonResponse({
      data: {
        id: 'folder-1',
        project_id: 'proj-1',
        name: 'avatars',
        parent_folder_id: null,
        owner_user_id: 'user-1',
        access: 'private',
        created_at: 1700000000,
      },
    });

    await vault.createFolder('avatars', {
      parent_folder_id: 'root-folder',
      access: 'private',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/vault/vault/folders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'avatars',
          parent_folder_id: 'root-folder',
          access: 'private',
        }),
      }),
    );
  });

  it('uploadLargeFile() warns and throws a clear error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const file = new File(['large'], 'large.bin', { type: 'application/octet-stream' });

    await expect(vault.uploadLargeFile(file)).rejects.toThrow(
      'Multipart upload backend not implemented. Files must be under 100MB for direct upload.',
    );

    expect(warnSpy).toHaveBeenCalledWith(
      'GlobalVault: large file multipart upload is not yet supported in this backend version. Use uploadFile() for files under 100MB.'
    );
  });
});

import { GlobioError } from './types';

export class GlobioException extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(error: GlobioError) {
    super(error.message);
    this.code = error.code;
    this.status = error.status;
    this.name = 'GlobioException';
  }
}

export function parseError(status: number, body: unknown): GlobioError {
  if (typeof body === 'object' && body !== null) {
    const b = body as Record<string, unknown>;
    return {
      code: String(b.code ?? b.error ?? 'UNKNOWN'),
      message: String(b.error ?? b.message ?? 'An unknown error occurred'),
      status,
    };
  }
  return { code: 'UNKNOWN', message: 'An unknown error occurred', status };
}

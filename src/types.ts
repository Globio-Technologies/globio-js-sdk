export interface GlobioConfig {
  apiKey: string;
  baseUrl?: string;
  environment?: string;
  storage?: 'localStorage' | 'memory';
}

export interface GlobioSession {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface GlobioUser {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  metadata: Record<string, unknown>;
  created_at: number;
}

export type GlobioResult<T> =
  | { success: true; data: T }
  | { success: false; error: GlobioError };

export interface GlobioError {
  code: string;
  message: string;
  status: number;
}

export interface DocumentQueryOptions {
  where?: Array<{ field: string; op: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'array-contains'; value: unknown }>;
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
  startAfter?: string;
}

export interface GlobioRoomEvent {
  type: 'state_update' | 'player_update' | 'event' | 'room_state' | 'error' | 'ping' | 'pong';
  payload: Record<string, unknown>;
  user_id?: string;
}

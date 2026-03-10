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
  email_verified: boolean;
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

export interface GlobioDocument<T = Record<string, unknown>> {
  id: string;
  version: number;
  created_at: number;
  updated_at: number;
  data: T;
}

export interface DocCollection {
  id: string;
  project_id: string;
  name: string;
  parent_collection_id: string | null;
  parent_document_id: string | null;
  schema: string;
  rules: string;
  created_at: number;
}

export interface DocIndex {
  id: string;
  collection_id: string;
  project_id: string;
  field_path: string;
  index_type: 'asc' | 'desc' | 'array';
  composite: number;
  composite_fields: string;
  created_at: number;
}

export interface GlobioRoomEvent {
  type: 'state_update' | 'player_update' | 'event' | 'room_state' | 'error' | 'ping' | 'pong';
  payload: Record<string, unknown>;
  user_id?: string;
}

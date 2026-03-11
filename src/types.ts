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
  // metadata is returned as a parsed object on GET,
  // and as a JSON string on POST — normalize it client-side
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

export interface VaultListFilesResult {
  files: VaultFile[];
  next_cursor: string | null;
}

export type ValueType = 'string' | 'number' | 'boolean' | 'json';
export type RolloutType = 'all' | 'percentage' | 'segment' | 'user_list';

export interface PulseEnvironment {
  id: string;
  project_id: string;
  name: string;
  created_at: number;
}

export interface PulseConfig {
  key: string;
  value: unknown;
  value_type: ValueType;
  version: number;
  description?: string | null;
}

export interface PulseFlag {
  key: string;
  enabled: boolean;
  rollout_type: RolloutType;
  rollout_percentage: number;
  version: number;
}

export interface TrackEventPayload {
  event_name: string;
  user_id?: string;
  session_id?: string;
  platform?: string;
  properties?: Record<string, unknown>;
}

export interface ScopeMetrics {
  dau: number;
  wau: number;
  mau: number;
}

export interface ScopeFunnel {
  id: string;
  name: string;
  steps: string[];
  conversion_window_hours: number;
  created_at: number;
}

export interface ScopeDashboardWidget {
  type: 'metric' | 'chart' | 'table' | 'funnel';
  title: string;
  config: Record<string, unknown>;
}

export interface ScopeDashboard {
  id: string;
  name: string;
  widgets: ScopeDashboardWidget[];
  created_at: number;
  updated_at: number;
}

export interface FunnelStepResult {
  step: string;
  users: number;
  conversion_rate: number;
}

export interface SyncRoom {
  id: string;
  project_id: string;
  template_id: string | null;
  name: string | null;
  status: 'waiting' | 'active' | 'closed';
  current_players: number;
  max_players: number;
  state: Record<string, unknown>;
  region: string | null;
  created_at: number;
  closed_at: number | null;
}

export interface SyncRoomTemplate {
  id: string;
  name: string;
  max_players: number;
  visibility: 'public' | 'private';
  sync_mode: 'authoritative' | 'p2p' | 'hybrid';
  initial_state: Record<string, unknown>;
  created_at: number;
}

export type SyncConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export const SyncCloseCodes = {
  CLEAN: 1000,
  NETWORK_DROP: 1006,
  ROOM_FULL: 4001,
  ROOM_CLOSED: 4002,
} as const;

export interface GlobioRoomEvent {
  type: 'state_update' | 'player_update' | 'event' | 'room_state' | 'error' | 'ping' | 'pong';
  payload: Record<string, unknown>;
  user_id?: string;
}

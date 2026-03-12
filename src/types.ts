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

export interface SignalTopic {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_at: number;
}

export interface SignalSubscription {
  id: string;
  topic_id: string;
  user_id: string;
  active: boolean;
  created_at: number;
}

export interface SignalNotificationAction {
  id: string;
  label: string;
  data?: Record<string, unknown>;
}

export interface SignalNotificationPayload {
  id: string;
  type: string;
  title: string | null;
  body: string;
  data: Record<string, unknown>;
  image_url: string | null;
  icon_url: string | null;
  priority: 'low' | 'normal' | 'high';
  topic: string | null;
  sender_user_id: string | null;
  sender_display_name: string | null;
  actions: SignalNotificationAction[];
  created_at: number;
  expires_at: number | null;
}

export interface SignalMessage {
  id: string;
  topic_id: string | null;
  target_user_id: string | null;
  title: string | null;
  body: string;
  type: string;
  data: Record<string, unknown>;
  image_url: string | null;
  icon_url: string | null;
  priority: 'low' | 'normal' | 'high';
  status: string;
  recipient_count: number;
  created_at: number;
  expires_at: number | null;
}

export interface SignalSendOptions {
  title?: string;
  body: string;
  type?: string;
  data?: Record<string, unknown>;
  image_url?: string;
  icon_url?: string;
  priority?: 'low' | 'normal' | 'high';
  actions?: SignalNotificationAction[];
  ttl_seconds?: number;
}

export interface MartCurrency {
  id: string;
  project_id: string;
  name: string;
  code: string;
  type: 'soft' | 'hard' | 'premium';
  purchasable: boolean;
  created_at: number;
}

export interface MartCatalog {
  id: string;
  project_id: string;
  name: string;
  version: string;
  active: boolean;
  created_at: number;
  updated_at: number;
}

export interface MartItemPrice {
  currency_code: string;
  amount: number;
}

export interface MartItem {
  id: string;
  catalog_id: string;
  name: string;
  sku: string;
  type: 'consumable' | 'durable' | 'subscription';
  prices: MartItemPrice[];
  metadata: Record<string, unknown>;
  active: boolean;
  created_at: number;
}

export interface MartWallet {
  id: string;
  currency_id: string;
  currency_code: string;
  currency_name: string;
  balance: number;
  updated_at: number;
  created_at: number;
}

export interface MartInventoryItem {
  id: string;
  item_id: string;
  sku: string;
  name: string;
  type: 'consumable' | 'durable' | 'subscription';
  quantity: number;
  instance_data: Record<string, unknown> | null;
  acquired_at: number;
  expires_at: number | null;
}

export interface MartTransaction {
  id: string;
  project_id: string;
  user_id: string;
  type: 'purchase' | 'grant' | 'spend' | 'refund' | 'transfer';
  currency_id: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  ref_id: string | null;
  ref_type: string | null;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  created_at: number;
}

export interface MartPaymentConfig {
  id: string;
  project_id: string;
  provider: 'stripe' | 'nowpayments' | 'paystack' | 'flutterwave' | 'custom';
  credentials: Record<string, unknown>;
  webhook_secret: string | null;
  currency: string;
  active: boolean;
  created_at: number;
}

export type BrainProvider = 'workers_ai' | 'openai' | 'anthropic' | 'custom';

export interface BrainProviderConfig {
  id: string;
  provider: BrainProvider;
  endpoint_url: string | null;
  default_model: string | null;
  created_at: number;
  updated_at: number;
}

export interface BrainAgent {
  id: string;
  name: string;
  provider: BrainProvider;
  model: string | null;
  system_prompt: string | null;
  temperature: number;
  max_tokens: number;
  created_at: number;
  updated_at: number;
}

export interface BrainChatResponse {
  response: string;
  conversation_id: string;
  tokens_used: {
    input: number;
    output: number;
    total: number;
  };
}

export interface BrainMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: number;
}

export interface BrainConversation {
  id: string;
  agent_id: string;
  user_id: string;
  context_key: string | null;
  created_at: number;
  messages: BrainMessage[];
}

export interface BrainModerationResult {
  result: 'approved' | 'rejected' | 'review';
  confidence: number;
  categories: Record<string, number>;
}

export interface BrainModerationLog {
  id: string;
  content_type: string;
  content_ref: string | null;
  result: string;
  confidence: number;
  categories: string;
  created_at: number;
}

export type GCHookTrigger =
  | 'id.onSignup'
  | 'id.onSignin'
  | 'id.onSignout'
  | 'id.onPasswordReset'
  | 'doc.onCreate'
  | 'doc.onUpdate'
  | 'doc.onDelete'
  | 'mart.onPurchase'
  | 'mart.onPayment'
  | 'sync.onRoomCreate'
  | 'sync.onRoomClose'
  | 'sync.onPlayerJoin'
  | 'sync.onPlayerLeave'
  | 'vault.onUpload'
  | 'vault.onDelete'
  | 'signal.onDeliver';

export interface CodeFunction {
  id: string;
  name: string;
  slug: string;
  type: 'function' | 'hook';
  trigger_event: GCHookTrigger | null;
  code?: string;
  runtime: 'js';
  active: boolean;
  description: string | null;
  created_at: number;
  updated_at: number;
}

export interface CodeInvocation {
  id: string;
  function_id: string;
  trigger_type: 'http' | 'hook';
  duration_ms: number;
  status_code: number;
  success: boolean;
  invoked_at: number;
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

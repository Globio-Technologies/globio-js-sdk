import { GlobioClient } from './GlobioClient';
import { GlobioConfig, GlobioSession, GlobioUser, GlobioResult, GlobioError, DocumentQueryOptions, GlobioRoomEvent, GlobioDocument, DocCollection, DocIndex, AccessLevel, VaultFolder, VaultFile, MultipartUploadInit, DownloadUrl, VaultListFilesResult, SignalTopic, SignalSubscription, SignalNotificationAction, SignalNotificationPayload, SignalMessage, SignalSendOptions, ValueType, RolloutType, PulseEnvironment, PulseConfig, PulseFlag, TrackEventPayload, ScopeMetrics, ScopeFunnel, ScopeDashboard, ScopeDashboardWidget, FunnelStepResult, SyncRoom, SyncRoomTemplate, SyncConnectionState, SyncCloseCodes } from './types';
import { GlobioException } from './errors';
import { GlobioId } from './modules/GlobioId';
import { GlobioDoc, DocOptions } from './modules/GlobioDoc';
import { GlobioVault } from './modules/GlobioVault';
import { GlobioPulse } from './modules/GlobioPulse';
import { GlobioSync, GlobioRoom } from './modules/GlobioSync';
import { GlobioSignal } from './modules/GlobioSignal';
import { GlobioMart } from './modules/GlobioMart';
import { GlobioBrain } from './modules/GlobioBrain';
import { GlobioCode } from './modules/GlobioCode';
import { GlobioScope } from './modules/GlobioScope';
import { WriteBatch } from './WriteBatch';
import { Transaction } from './Transaction';

export class Globio {
  public readonly id: GlobioId;
  public readonly doc: GlobioDoc;
  public readonly vault: GlobioVault;
  public readonly pulse: GlobioPulse;
  public readonly sync: GlobioSync;
  public readonly signal: GlobioSignal;
  public readonly mart: GlobioMart;
  public readonly brain: GlobioBrain;
  public readonly code: GlobioCode;
  public readonly scope: GlobioScope;

  private client: GlobioClient;

  constructor(config: GlobioConfig) {
    this.client = new GlobioClient(config);
    this.id = new GlobioId(this.client);
    this.doc = new GlobioDoc(this.client);
    this.vault = new GlobioVault(this.client);
    this.pulse = new GlobioPulse(this.client);
    this.sync = new GlobioSync(this.client);
    this.signal = new GlobioSignal(this.client);
    this.mart = new GlobioMart(this.client);
    this.brain = new GlobioBrain(this.client);
    this.code = new GlobioCode(this.client);
    this.scope = new GlobioScope(this.client);
  }

  batch(): WriteBatch {
    return new WriteBatch(this.client);
  }

  async syncPending(): Promise<{ synced: number; failed: number }> {
    return this.client.syncPendingWrites();
  }

  async isOnline(): Promise<boolean> {
    return this.client.offline.isOnline();
  }

  async waitForPendingWrites(): Promise<void> {
    return this.client.offline.waitForPendingWrites();
  }

  async getPendingWrites(): Promise<Array<{ id: string; type: string; collection: string; timestamp: number }>> {
    return this.client.offline.getPendingWrites();
  }

  enableOffline(): void {
    this.client.offline.enablePersistence();
  }

  disableOffline(): void {
    this.client.offline.disablePersistence();
  }

  async clearCache(): Promise<void> {
    return this.client.offline.clearCache();
  }

  async getCacheSize(): Promise<number> {
    return this.client.offline.getCacheSize();
  }

  setCacheSize(maxSizeMB: number): void {
    this.client.offline.setConfig({ maxSizeMB });
  }

  async terminate(): Promise<void> {
    return this.client.offline.terminate();
  }
}

export { GlobioClient, GlobioException, WriteBatch, Transaction };
export { SyncCloseCodes };
export type { GlobioConfig, GlobioSession, GlobioUser, GlobioResult, GlobioError, DocumentQueryOptions, GlobioRoomEvent, GlobioDocument, DocCollection, DocIndex, AccessLevel, VaultFolder, VaultFile, MultipartUploadInit, DownloadUrl, VaultListFilesResult, SignalTopic, SignalSubscription, SignalNotificationAction, SignalNotificationPayload, SignalMessage, SignalSendOptions, ValueType, RolloutType, PulseEnvironment, PulseConfig, PulseFlag, TrackEventPayload, ScopeMetrics, ScopeFunnel, ScopeDashboard, ScopeDashboardWidget, FunnelStepResult, SyncRoom, SyncRoomTemplate, SyncConnectionState, DocOptions };
export { GlobioId, GlobioDoc, GlobioVault, GlobioPulse, GlobioSync, GlobioRoom, GlobioSignal, GlobioMart, GlobioBrain, GlobioCode, GlobioScope };

import { GlobioClient } from '../GlobioClient';
import { GlobioResult, ValueType, RolloutType, PulseEnvironment, PulseConfig, PulseFlag } from '../types';

interface PulseCache {
  configs: Record<string, PulseConfig>;
  flags: Record<string, PulseFlag>;
  ts: number;
}

export class GlobioPulse {
  private cache: Record<string, PulseCache> = {};
  private cacheTtl = 300_000;

  constructor(private client: GlobioClient) {}

  async listEnvironments(): Promise<GlobioResult<PulseEnvironment[]>> {
    return this.client.request<PulseEnvironment[]>({
      service: 'pulse',
      path: '/pulse/environments',
    });
  }

  async createEnvironment(name: string): Promise<GlobioResult<PulseEnvironment>> {
    return this.client.request<PulseEnvironment>({
      service: 'pulse',
      path: '/pulse/environments',
      method: 'POST',
      body: { name },
    });
  }

  async getConfigs(environment: string): Promise<GlobioResult<PulseConfig[]>> {
    return this.client.request<PulseConfig[]>({
      service: 'pulse',
      path: `/pulse/${environment}/configs`,
    });
  }

  async setConfig(
    environment: string,
    key: string,
    value: unknown,
    valueType: ValueType,
    description?: string
  ): Promise<GlobioResult<PulseConfig>> {
    return this.client.request<PulseConfig>({
      service: 'pulse',
      path: `/pulse/${environment}/configs/${key}`,
      method: 'PUT',
      body: { value, value_type: valueType, description },
    });
  }

  async deleteConfig(environment: string, key: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'pulse',
      path: `/pulse/${environment}/configs/${key}`,
      method: 'DELETE',
    });
  }

  async getFlags(environment: string): Promise<GlobioResult<PulseFlag[]>> {
    return this.client.request<PulseFlag[]>({
      service: 'pulse',
      path: `/pulse/${environment}/flags`,
    });
  }

  async setFlag(
    environment: string,
    key: string,
    enabled: boolean,
    options?: {
      rollout_type?: RolloutType;
      rollout_percentage?: number;
      target_user_ids?: string[];
      conditions?: Record<string, unknown>;
    }
  ): Promise<GlobioResult<PulseFlag>> {
    return this.client.request<PulseFlag>({
      service: 'pulse',
      path: `/pulse/${environment}/flags/${key}`,
      method: 'PUT',
      body: {
        enabled,
        rollout_type: options?.rollout_type ?? 'all',
        rollout_percentage: options?.rollout_percentage ?? 100,
        target_user_ids: options?.target_user_ids ?? [],
        conditions: options?.conditions ?? {},
      },
    });
  }

  async deleteFlag(environment: string, key: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'pulse',
      path: `/pulse/${environment}/flags/${key}`,
      method: 'DELETE',
    });
  }

  async evaluateFlag(environment: string, key: string, userId?: string): Promise<GlobioResult<{ key: string; enabled: boolean }>> {
    const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    return this.client.request<{ key: string; enabled: boolean }>({
      service: 'pulse',
      path: `/pulse/${environment}/flags/${key}/evaluate${qs}`,
    });
  }

  async getAll(environment: string = 'production'): Promise<GlobioResult<{ configs: Record<string, PulseConfig>; flags: Record<string, PulseFlag> }>> {
    const cached = this.cache[environment];
    if (cached && Date.now() - cached.ts < this.cacheTtl) {
      return { success: true, data: { configs: cached.configs, flags: cached.flags } };
    }

    const [configsResult, flagsResult] = await Promise.all([
      this.client.request<PulseConfig[]>({ service: 'pulse', path: `/pulse/${environment}/configs` }),
      this.client.request<PulseFlag[]>({ service: 'pulse', path: `/pulse/${environment}/flags` }),
    ]);

    if (!configsResult.success) return configsResult;
    if (!flagsResult.success) return flagsResult;

    const configs = Object.fromEntries(configsResult.data.map(c => [c.key, c]));
    const flags = Object.fromEntries(flagsResult.data.map(f => [f.key, f]));

    this.cache[environment] = { configs, flags, ts: Date.now() };
    return { success: true, data: { configs, flags } };
  }

  async getConfig<T = unknown>(key: string, environment: string = 'production'): Promise<T | undefined> {
    const result = await this.getAll(environment);
    if (!result.success) return undefined;
    return result.data.configs[key]?.value as T | undefined;
  }

  /**
   * Checks if a feature flag is enabled.
   * For percentage rollouts or user-list targeting, always pass
   * userId — without it, targeting is ignored and the flat
   * enabled state is returned.
   * Note: rollout_type 'segment' is not yet evaluated server-side
   * and behaves identically to 'all'.
   * Note: conditions are stored on flags but are not yet evaluated
   * server-side.
   */
  async isEnabled(flagKey: string, environment: string = 'production', userId?: string): Promise<boolean> {
    if (userId) {
      const result = await this.evaluateFlag(environment, flagKey, userId);
      if (!result.success) return false;
      return result.data.enabled;
    }

    const result = await this.getAll(environment);
    if (!result.success) return false;
    return result.data.flags[flagKey]?.enabled ?? false;
  }

  clearCache(environment?: string): void {
    if (environment) {
      delete this.cache[environment];
    } else {
      this.cache = {};
    }
  }
}

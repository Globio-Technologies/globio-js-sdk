import { GlobioClient } from '../GlobioClient';
import { GlobioResult } from '../types';

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
  description: string | null;
}

export interface PulseFlag {
  key: string;
  enabled: boolean;
  rollout_type: RolloutType;
  rollout_percentage: number;
  version: number;
}

interface PulseCache {
  configs: Record<string, unknown>;
  flags: Record<string, boolean>;
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
        target_user_ids: options?.target_user_ids ? JSON.stringify(options.target_user_ids) : '[]',
        conditions: options?.conditions ? JSON.stringify(options.conditions) : '{}',
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

  async getAll(environment: string = 'production'): Promise<GlobioResult<{ configs: Record<string, unknown>; flags: Record<string, boolean> }>> {
    const cached = this.cache[environment];
    if (cached && Date.now() - cached.ts < this.cacheTtl) {
      return { success: true, data: { configs: cached.configs, flags: cached.flags } };
    }

    const [configsResult, flagsResult] = await Promise.all([
      this.client.request<Array<{ key: string; value: unknown }>>({ service: 'pulse', path: `/pulse/${environment}/configs` }),
      this.client.request<Array<{ key: string; enabled: boolean }>>({ service: 'pulse', path: `/pulse/${environment}/flags` }),
    ]);

    if (!configsResult.success) return configsResult;
    if (!flagsResult.success) return flagsResult;

    const configs = Object.fromEntries(configsResult.data.map(c => [c.key, c.value]));
    const flags = Object.fromEntries(flagsResult.data.map(f => [f.key, f.enabled]));

    this.cache[environment] = { configs, flags, ts: Date.now() };
    return { success: true, data: { configs, flags } };
  }

  async getConfig<T = unknown>(key: string, environment: string = 'production'): Promise<T | undefined> {
    const result = await this.getAll(environment);
    if (!result.success) return undefined;
    return result.data.configs[key] as T;
  }

  async isEnabled(flagKey: string, environment: string = 'production'): Promise<boolean> {
    const result = await this.getAll(environment);
    if (!result.success) return false;
    return result.data.flags[flagKey] ?? false;
  }

  clearCache(environment?: string): void {
    if (environment) {
      delete this.cache[environment];
    } else {
      this.cache = {};
    }
  }
}

import { GlobioClient } from '../GlobioClient';
import { GlobioResult } from '../types';

interface PulseCache {
  configs: Record<string, unknown>;
  flags: Record<string, boolean>;
  ts: number;
}

export class GlobioPulse {
  private cache: Record<string, PulseCache> = {};
  private cacheTtl = 300_000;

  constructor(private client: GlobioClient) {}

  async getAll(environment = 'production'): Promise<GlobioResult<{ configs: Record<string, unknown>; flags: Record<string, boolean> }>> {
    const cached = this.cache[environment];
    if (cached && Date.now() - cached.ts < this.cacheTtl) {
      return { success: true, data: { configs: cached.configs, flags: cached.flags } };
    }

    const [configsResult, flagsResult] = await Promise.all([
      this.client.request<Array<{ key: string; value: unknown }>>({ service: 'pulse', path: `/${environment}/configs` }),
      this.client.request<Array<{ key: string; enabled: boolean }>>({ service: 'pulse', path: `/${environment}/flags` }),
    ]);

    if (!configsResult.success) return configsResult;
    if (!flagsResult.success) return flagsResult;

    const configs = Object.fromEntries(configsResult.data.map(c => [c.key, c.value]));
    const flags = Object.fromEntries(flagsResult.data.map(f => [f.key, f.enabled]));

    this.cache[environment] = { configs, flags, ts: Date.now() };
    return { success: true, data: { configs, flags } };
  }

  async get<T = unknown>(key: string, environment = 'production'): Promise<T | undefined> {
    const result = await this.getAll(environment);
    if (!result.success) return undefined;
    return result.data.configs[key] as T;
  }

  async isEnabled(flagKey: string, environment = 'production'): Promise<boolean> {
    const result = await this.getAll(environment);
    if (!result.success) return false;
    return result.data.flags[flagKey] ?? false;
  }

  clearCache(): void {
    this.cache = {};
  }
}

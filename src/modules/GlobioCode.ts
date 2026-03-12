import { GlobioClient } from '../GlobioClient';
import { CodeFunction, CodeInvocation, GCHookTrigger, GlobioResult } from '../types';

/**
 * GlobioCode — Serverless Edge Functions and GC Hooks
 *
 * TWO PRODUCTS:
 *
 * GC EDGE FUNCTIONS
 * HTTP-triggered functions invoked by your game client.
 * Run at Cloudflare edge. Have full access to all Globio
 * services via an injected globio object.
 *
 * GC HOOKS
 * Event-driven functions that fire automatically when things
 * happen in your Globio project. React to signups, purchases,
 * room events, document changes, and more.
 * Also have full access to all Globio services.
 *
 * AVAILABLE HOOK TRIGGERS:
 *   id.onSignup         id.onSignin
 *   id.onSignout        id.onPasswordReset
 *   doc.onCreate        doc.onUpdate        doc.onDelete
 *   mart.onPurchase     mart.onPayment
 *   sync.onRoomCreate   sync.onRoomClose
 *   sync.onPlayerJoin   sync.onPlayerLeave
 *   vault.onUpload      vault.onDelete
 *   signal.onDeliver
 *
 * RUNTIME:
 *   JavaScript only. Functions must export a handler function.
 *   A globio object is injected as the second argument.
 *   Network access is disabled inside functions.
 *   Timeout: 5s for edge functions, 10s for hooks.
 */
export class GlobioCode {
  constructor(private client: GlobioClient) {}

  async listFunctions(): Promise<GlobioResult<CodeFunction[]>> {
    return this.client.request<CodeFunction[]>({
      service: 'code',
      path: '/functions',
      auth: true,
    });
  }

  async createFunction(options: {
    name: string;
    slug: string;
    type: 'function' | 'hook';
    code: string;
    trigger_event?: GCHookTrigger;
    description?: string;
  }): Promise<GlobioResult<CodeFunction>> {
    return this.client.request<CodeFunction>({
      service: 'code',
      path: '/functions',
      method: 'POST',
      body: options,
      auth: true,
    });
  }

  async getFunction(slug: string): Promise<GlobioResult<CodeFunction>> {
    return this.client.request<CodeFunction>({
      service: 'code',
      path: `/functions/${slug}`,
      auth: true,
    });
  }

  async updateFunction(
    slug: string,
    updates: Partial<{
      name: string;
      code: string;
      trigger_event: GCHookTrigger;
      description: string;
    }>
  ): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'code',
      path: `/functions/${slug}`,
      method: 'PATCH',
      body: updates,
      auth: true,
    });
  }

  async deleteFunction(slug: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'code',
      path: `/functions/${slug}`,
      method: 'DELETE',
      auth: true,
    });
  }

  async toggleFunction(slug: string, active: boolean): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'code',
      path: `/functions/${slug}/toggle`,
      method: 'PATCH',
      body: { active },
      auth: true,
    });
  }

  async invoke(
    slug: string,
    input?: Record<string, unknown>
  ): Promise<GlobioResult<{ result: unknown; duration_ms: number }>> {
    return this.client.request<{ result: unknown; duration_ms: number }>({
      service: 'code',
      path: `/invoke/${slug}`,
      method: 'POST',
      body: input,
      auth: true,
    });
  }

  async getInvocations(slug: string, limit?: number): Promise<GlobioResult<CodeInvocation[]>> {
    const query = limit !== undefined ? `?limit=${limit}` : '';
    return this.client.request<CodeInvocation[]>({
      service: 'code',
      path: `/functions/${slug}/invocations${query}`,
      auth: true,
    });
  }
}

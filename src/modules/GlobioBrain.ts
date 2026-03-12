import { GlobioClient } from '../GlobioClient';
import {
  BrainAgent,
  BrainChatResponse,
  BrainConversation,
  BrainModerationLog,
  BrainModerationResult,
  BrainProvider,
  BrainProviderConfig,
  GlobioResult,
} from '../types';

/**
 * GlobioBrain — AI agent and moderation service.
 *
 * AVAILABLE NOW:
 * - Named agents with persistent conversation history
 * - Buffered chat (non-streaming)
 * - Content moderation
 * - Provider configuration (Workers AI, OpenAI, Anthropic, Custom)
 *
 * COMING SOON (not yet implemented on the backend):
 * - Streaming chat responses
 * - Text embeddings
 * - Knowledge base and document ingestion
 * - Retrieval-augmented generation (RAG)
 * - Tool/function calling
 *
 * Providers declared in the schema but not yet implemented:
 * Gemini, Groq, Mistral — configuring these will fail at runtime.
 */
export class GlobioBrain {
  constructor(private client: GlobioClient) {}

  /**
   * Send a message to a named agent.
   * Conversation history is managed server-side.
   * Use context_key to maintain separate conversation threads
   * for the same user and agent (e.g. different game sessions).
   * Omit context_key to use a single default conversation thread.
   */
  async chat(
    agentName: string,
    message: string,
    options?: {
      context_key?: string;
    },
  ): Promise<GlobioResult<BrainChatResponse>> {
    return this.client.request<BrainChatResponse>({
      service: 'brain',
      path: `/agents/${encodeURIComponent(agentName)}/chat`,
      method: 'POST',
      body: {
        message,
        context_key: options?.context_key,
      },
      auth: true,
    });
  }

  async moderate(
    content: string,
    contentType: string,
    contentRef?: string,
  ): Promise<GlobioResult<BrainModerationResult>> {
    return this.client.request<BrainModerationResult>({
      service: 'brain',
      path: '/moderate',
      method: 'POST',
      body: {
        content,
        content_type: contentType,
        content_ref: contentRef,
      },
      auth: true,
    });
  }

  async listProviders(): Promise<GlobioResult<BrainProviderConfig[]>> {
    return this.client.request<BrainProviderConfig[]>({
      service: 'brain',
      path: '/providers',
      auth: true,
    });
  }

  async upsertProvider(
    provider: BrainProvider,
    options: {
      api_key?: string;
      endpoint_url?: string;
      default_model?: string;
    },
  ): Promise<GlobioResult<void>> {
    const result = await this.client.request<void>({
      service: 'brain',
      path: `/providers/${encodeURIComponent(provider)}`,
      method: 'PUT',
      body: options,
      auth: true,
    });
    return result.success ? { success: true, data: undefined } : result;
  }

  async deleteProvider(provider: BrainProvider): Promise<GlobioResult<void>> {
    const result = await this.client.request<void>({
      service: 'brain',
      path: `/providers/${encodeURIComponent(provider)}`,
      method: 'DELETE',
      auth: true,
    });
    return result.success ? { success: true, data: undefined } : result;
  }

  async listAgents(): Promise<GlobioResult<BrainAgent[]>> {
    return this.client.request<BrainAgent[]>({
      service: 'brain',
      path: '/agents',
      auth: true,
    });
  }

  async createAgent(options: {
    name: string;
    model?: string;
    provider?: BrainProvider;
    system_prompt?: string;
    temperature?: number;
    max_tokens?: number;
  }): Promise<GlobioResult<BrainAgent>> {
    return this.client.request<BrainAgent>({
      service: 'brain',
      path: '/agents',
      method: 'POST',
      body: options,
      auth: true,
    });
  }

  async getAgent(name: string): Promise<GlobioResult<BrainAgent>> {
    return this.client.request<BrainAgent>({
      service: 'brain',
      path: `/agents/${encodeURIComponent(name)}`,
      auth: true,
    });
  }

  async updateAgent(
    name: string,
    updates: Partial<{
      model: string;
      provider: BrainProvider;
      system_prompt: string;
      temperature: number;
      max_tokens: number;
    }>,
  ): Promise<GlobioResult<void>> {
    const result = await this.client.request<void>({
      service: 'brain',
      path: `/agents/${encodeURIComponent(name)}`,
      method: 'PATCH',
      body: updates,
      auth: true,
    });
    return result.success ? { success: true, data: undefined } : result;
  }

  async deleteAgent(name: string): Promise<GlobioResult<void>> {
    const result = await this.client.request<void>({
      service: 'brain',
      path: `/agents/${encodeURIComponent(name)}`,
      method: 'DELETE',
      auth: true,
    });
    return result.success ? { success: true, data: undefined } : result;
  }

  async getConversation(conversationId: string): Promise<GlobioResult<BrainConversation>> {
    return this.client.request<BrainConversation>({
      service: 'brain',
      path: `/conversations/${encodeURIComponent(conversationId)}`,
      auth: true,
    });
  }

  async clearConversation(conversationId: string): Promise<GlobioResult<void>> {
    const result = await this.client.request<void>({
      service: 'brain',
      path: `/conversations/${encodeURIComponent(conversationId)}`,
      method: 'DELETE',
      auth: true,
    });
    return result.success ? { success: true, data: undefined } : result;
  }

  async listModerationLogs(limit?: number): Promise<GlobioResult<BrainModerationLog[]>> {
    const params = new URLSearchParams();
    if (typeof limit === 'number') {
      params.set('limit', String(limit));
    }

    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return this.client.request<BrainModerationLog[]>({
      service: 'brain',
      path: `/moderation-logs${suffix}`,
      auth: true,
    });
  }
}

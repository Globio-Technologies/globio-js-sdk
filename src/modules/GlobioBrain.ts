import { GlobioClient } from '../GlobioClient';
import { GlobioResult } from '../types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  message: string;
  conversation_id: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class GlobioBrain {
  private conversationId: string | null = null;

  constructor(private client: GlobioClient) {}

  async chat(agentName: string, message: string, context?: Record<string, unknown>): Promise<GlobioResult<ChatResponse>> {
    const result = await this.client.request<ChatResponse>({
      service: 'brain',
      path: `/agents/${encodeURIComponent(agentName)}/chat`,
      method: 'POST',
      body: {
        message,
        conversation_id: this.conversationId,
        context,
      },
      auth: true,
    });

    if (result.success) {
      this.conversationId = result.data.conversation_id;
    }

    return result;
  }

  resetConversation(): void {
    this.conversationId = null;
  }

  setConversationId(id: string): void {
    this.conversationId = id;
  }

  async moderate(content: string, type: 'chat' | 'image' | 'username'): Promise<GlobioResult<{ result: 'pass' | 'flag' | 'block'; confidence: number; categories: string[] }>> {
    return this.client.request<{ result: 'pass' | 'flag' | 'block'; confidence: number; categories: string[] }>({
      service: 'brain',
      path: '/moderate',
      method: 'POST',
      body: { content, type },
      auth: true,
    });
  }
}

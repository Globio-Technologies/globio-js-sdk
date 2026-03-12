import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobioClient } from '../src/GlobioClient';
import { GlobioBrain } from '../src/modules/GlobioBrain';

function response(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('GlobioBrain', () => {
  let brain: GlobioBrain;

  beforeEach(() => {
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    client.session.set({
      user_id: 'user-1',
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
    brain = new GlobioBrain(client);
  });

  it('chat() calls POST /brain/agents/:name/chat with { message } body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        response: 'Hello',
        conversation_id: 'convo-1',
        tokens_used: { input: 10, output: 12, total: 22 },
      },
    }));

    await brain.chat('support-agent', 'Hello');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/agents/support-agent/chat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: 'Hello', context_key: undefined }),
      }),
    );
  });

  it('chat() with context_key sends { message, context_key }', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        response: 'Hello',
        conversation_id: 'convo-1',
        tokens_used: { input: 10, output: 12, total: 22 },
      },
    }));

    await brain.chat('support-agent', 'Hello', { context_key: 'session_1' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/agents/support-agent/chat',
      expect.objectContaining({
        body: JSON.stringify({ message: 'Hello', context_key: 'session_1' }),
      }),
    );
  });

  it('chat() returns BrainChatResponse shape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        response: 'Hello',
        conversation_id: 'convo-1',
        tokens_used: { input: 10, output: 12, total: 22 },
      },
    }));

    const result = await brain.chat('support-agent', 'Hello');

    expect(result).toEqual({
      success: true,
      data: {
        response: 'Hello',
        conversation_id: 'convo-1',
        tokens_used: { input: 10, output: 12, total: 22 },
      },
    });
  });

  it('moderate() calls POST /brain/moderate with { content_type, content } not { type, content }', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        result: 'approved',
        confidence: 0.98,
        categories: {},
      },
    }));

    await brain.moderate('hello world', 'chat_message');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/moderate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          content: 'hello world',
          content_type: 'chat_message',
          content_ref: undefined,
        }),
      }),
    );
  });

  it('moderate() with contentRef sends content_ref field', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        result: 'review',
        confidence: 0.7,
        categories: { toxic: 0.7 },
      },
    }));

    await brain.moderate('hello world', 'chat_message', 'msg_123');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/moderate',
      expect.objectContaining({
        body: JSON.stringify({
          content: 'hello world',
          content_type: 'chat_message',
          content_ref: 'msg_123',
        }),
      }),
    );
  });

  it('moderate() returns { result, confidence, categories }', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        result: 'rejected',
        confidence: 0.99,
        categories: { harmful: 0.99 },
      },
    }));

    const result = await brain.moderate('bad content', 'chat_message');

    expect(result).toEqual({
      success: true,
      data: {
        result: 'rejected',
        confidence: 0.99,
        categories: { harmful: 0.99 },
      },
    });
  });

  it('listProviders() calls GET /brain/providers', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: [] }));

    await brain.listProviders();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/providers',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('upsertProvider() calls PUT /brain/providers/:provider with correct body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await brain.upsertProvider('openai', {
      api_key: 'sk-123',
      default_model: 'gpt-4o-mini',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/providers/openai',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          api_key: 'sk-123',
          default_model: 'gpt-4o-mini',
        }),
      }),
    );
  });

  it('deleteProvider() calls DELETE /brain/providers/:provider', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await brain.deleteProvider('openai');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/providers/openai',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('listAgents() calls GET /brain/agents', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: [] }));

    await brain.listAgents();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/agents',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('createAgent() calls POST /brain/agents with all fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        id: 'agent-1',
        name: 'support-agent',
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        system_prompt: 'help',
        temperature: 0.7,
        max_tokens: 1000,
        created_at: 1,
        updated_at: 1,
      },
    }));

    await brain.createAgent({
      name: 'support-agent',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      system_prompt: 'help',
      temperature: 0.7,
      max_tokens: 1000,
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/agents',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'support-agent',
          provider: 'anthropic',
          model: 'claude-haiku-4-5-20251001',
          system_prompt: 'help',
          temperature: 0.7,
          max_tokens: 1000,
        }),
      }),
    );
  });

  it('getAgent() calls GET /brain/agents/:name', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        id: 'agent-1',
        name: 'support-agent',
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        system_prompt: 'help',
        temperature: 0.7,
        max_tokens: 1000,
        created_at: 1,
        updated_at: 1,
      },
    }));

    await brain.getAgent('support-agent');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/agents/support-agent',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('updateAgent() calls PATCH /brain/agents/:name', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await brain.updateAgent('support-agent', { temperature: 0.3 });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/agents/support-agent',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ temperature: 0.3 }),
      }),
    );
  });

  it('deleteAgent() calls DELETE /brain/agents/:name', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await brain.deleteAgent('support-agent');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/agents/support-agent',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('getConversation() calls GET /brain/conversations/:id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        id: 'convo-1',
        agent_id: 'agent-1',
        user_id: 'user-1',
        context_key: null,
        created_at: 1,
        messages: [],
      },
    }));

    await brain.getConversation('convo-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/conversations/convo-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('clearConversation() calls DELETE /brain/conversations/:id', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await brain.clearConversation('convo-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/conversations/convo-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('listModerationLogs() calls GET /brain/moderation-logs', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: [] }));

    await brain.listModerationLogs();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/moderation-logs',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('listModerationLogs(25) sends ?limit=25', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: [] }));

    await brain.listModerationLogs(25);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/brain/moderation-logs?limit=25',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchLiveAnthropicModels,
  fetchLiveOpenAiModels,
} from '@/features/ai-copilot/providers/provider-models-discovery';
import { getAiModelDescriptor } from '@/features/ai-copilot/models/models-catalog';

describe('Descoberta Dinâmica de Modelos (OpenAI & Anthropic)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filtra apenas modelos de chat/raciocínio retornados pela OpenAI e resolve descritor dinâmico', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { id: 'gpt-4.1-mini', created: 200 },
            { id: 'o4-mini', created: 300 },
            { id: 'whisper-1', created: 400 },
            { id: 'text-embedding-3-large', created: 500 },
            { id: 'gpt-4o-realtime-preview', created: 600 },
          ],
        }),
        { status: 200 }
      )
    );

    const res = await fetchLiveOpenAiModels('sk-proj-valid-openai-key-1234567890');
    expect(res.ok).toBe(true);
    expect(res.source).toBe('LIVE_PROVIDER_API');
    expect(res.models.map((m) => m.id)).toEqual(['o4-mini', 'gpt-4.1-mini']);

    const dynamicDesc = getAiModelDescriptor('gpt-4.1-mini');
    expect(dynamicDesc.id).toBe('gpt-4.1-mini');
    expect(dynamicDesc.provider).toBe('OPENAI');
  });

  it('lista dinamicamente modelos retornados pela Anthropic e resolve descritor dinâmico', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4' },
            { id: 'claude-3-5-haiku-20241022', display_name: 'Claude 3.5 Haiku' },
          ],
        }),
        { status: 200 }
      )
    );

    const res = await fetchLiveAnthropicModels('sk-ant-api03-valid-key-1234567890');
    expect(res.ok).toBe(true);
    expect(res.source).toBe('LIVE_PROVIDER_API');
    expect(res.models.map((m) => m.id)).toEqual([
      'claude-sonnet-4-20250514',
      'claude-3-5-haiku-20241022',
    ]);

    const dynamicDesc = getAiModelDescriptor('claude-sonnet-4-20250514');
    expect(dynamicDesc.id).toBe('claude-sonnet-4-20250514');
    expect(dynamicDesc.provider).toBe('CLAUDE');
  });
});

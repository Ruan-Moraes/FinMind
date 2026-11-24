import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  discoverOfficialProviderModels,
  invalidateProviderModelsCache,
} from '@/features/ai-copilot/services/official-models-discovery';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Descoberta Oficial Dinâmica e Paginada de Modelos (OpenAI, Anthropic e Gemini)', () => {
  it('classifica compatibilidade e descontinuação em OpenAI sem ocultar modelos nem usar lista estática', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { id: 'gpt-5-mini', created: 1760000000, owned_by: 'openai', shutdown_date: null },
            { id: 'text-embedding-3-small', created: 1710000000, owned_by: 'openai' },
            { id: 'whisper-1', created: 1700000000, owned_by: 'openai' },
            { id: 'gpt-4-0314', created: 1680000000, owned_by: 'openai', shutdown_date: '2025-06-01' },
          ],
        }),
        { status: 200 }
      )
    );

    const res = await discoverOfficialProviderModels({
      userId: 'u-openai-test',
      provider: 'OPENAI',
      apiKey: 'sk-proj-valid-key-for-unit-test',
      forceRefresh: true,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(true);
    expect(res.models).toHaveLength(4);
    expect(res.models.find((m) => m.id === 'gpt-5-mini')?.compatibleWithApp).toBe(true);
    expect(res.models.find((m) => m.id === 'text-embedding-3-small')?.compatibleWithApp).toBe(false);
    expect(res.models.find((m) => m.id === 'whisper-1')?.compatibleWithApp).toBe(false);
    expect(res.models.find((m) => m.id === 'gpt-4-0314')?.isDeprecated).toBe(true);

    // Segunda chamada usa cache isolado por usuário+chave
    const cached = await discoverOfficialProviderModels({
      userId: 'u-openai-test',
      provider: 'OPENAI',
      apiKey: 'sk-proj-valid-key-for-unit-test',
    });
    expect(cached.fromCache).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    invalidateProviderModelsCache('u-openai-test', 'OPENAI');
  });

  it('percorre paginação por cursor (after_id) na Anthropic API', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5' }],
            has_more: true,
            last_id: 'claude-sonnet-4-5',
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: 'claude-haiku-4-5', display_name: 'Claude Haiku 4.5' }],
            has_more: false,
            last_id: 'claude-haiku-4-5',
          }),
          { status: 200 }
        )
      );

    const res = await discoverOfficialProviderModels({
      userId: 'u-claude-test',
      provider: 'CLAUDE',
      apiKey: 'sk-ant-api03-valid-key-unit-test',
      forceRefresh: true,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain('after_id=claude-sonnet-4-5');
    expect(res.models.map((m) => m.id)).toEqual(['claude-sonnet-4-5', 'claude-haiku-4-5']);
  });

  it('percorre paginação por pageToken na Google Gemini API usando header x-goog-api-key', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [
              {
                name: 'models/gemini-2.5-flash',
                displayName: 'Gemini 2.5 Flash',
                supportedGenerationMethods: ['generateContent'],
              },
            ],
            nextPageToken: 'tok-page-2',
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [
              {
                name: 'models/text-embedding-004',
                displayName: 'Text Embedding 004',
                supportedGenerationMethods: ['embedContent'],
              },
            ],
          }),
          { status: 200 }
        )
      );

    const res = await discoverOfficialProviderModels({
      userId: 'u-gemini-test',
      provider: 'GEMINI',
      apiKey: 'AIzaSyValidGeminiKeyForUnitTest',
      forceRefresh: true,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0]?.[0])).not.toContain('AIzaSy');
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain('pageToken=tok-page-2');
    expect(res.models).toHaveLength(2);
    expect(res.models.find((m) => m.id === 'gemini-2.5-flash')?.compatibleWithApp).toBe(true);
    expect(res.models.find((m) => m.id === 'text-embedding-004')?.compatibleWithApp).toBe(false);
  });

  it('retorna lista vazia e erro classificado em falha HTTP (nunca fallback estático)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Incorrect API key provided' } }), { status: 401 })
    );

    const res = await discoverOfficialProviderModels({
      userId: 'u-err-test',
      provider: 'OPENAI',
      apiKey: 'sk-proj-invalid-key-unit-test',
      forceRefresh: true,
    });

    expect(res.ok).toBe(false);
    expect(res.models).toEqual([]);
    expect(res.diagnosticCode).toBe('INVALID_CREDENTIALS');
  });
});

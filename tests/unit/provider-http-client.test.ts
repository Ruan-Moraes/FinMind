import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  callProviderApiText,
  callProviderApiJson,
  executeModelSanityCheck,
} from '@/features/ai-copilot/providers';
import {
  adaptOpenAiBodyForUnsupportedParam,
  AI_PROVIDER_ADAPTERS,
} from '@/features/ai-copilot/providers/provider-adapters';
import { resolveDynamicModelRoute } from '@/features/ai-copilot/models/model-route-resolver';

describe('Cliente HTTP Multi-Provedor de IA & Strategy Adapters (OCP)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('AI_PROVIDER_ADAPTERS constroi payloads distintos para OpenAI padrão, OpenAI reasoning (o3), Gemini e Claude', () => {
    const openaiRoute = resolveDynamicModelRoute('gpt-4o-mini', {
      openaiApiKey: 'sk-test-openai-key-123456',
    });
    const openaiBody = AI_PROVIDER_ADAPTERS.OPENAI.buildTextRequestBody({
      model: openaiRoute.model,
      systemInstruction: 'sys',
      userPrompt: 'hello',
      maxTokens: 256,
    });
    expect(openaiBody.temperature).toBe(0.2);
    expect(openaiBody.max_completion_tokens).toBe(256);
    expect(openaiBody.max_tokens).toBeUndefined();

    const nextGenRoute = resolveDynamicModelRoute('gpt-6.2-sol', {
      openaiApiKey: 'sk-test-openai-key-123456',
    });
    const nextGenBody = AI_PROVIDER_ADAPTERS.OPENAI.buildTextRequestBody({
      model: nextGenRoute.model,
      systemInstruction: 'sys',
      userPrompt: 'hello',
      maxTokens: 512,
    });
    expect(nextGenBody.max_completion_tokens).toBe(512);
    expect(nextGenBody.max_tokens).toBeUndefined();
    expect(nextGenBody.temperature).toBeUndefined();

    const reasoningRoute = resolveDynamicModelRoute('o3-mini', {
      openaiApiKey: 'sk-test-openai-key-123456',
    });
    const reasoningBody = AI_PROVIDER_ADAPTERS.OPENAI.buildTextRequestBody({
      model: reasoningRoute.model,
      systemInstruction: 'sys',
      userPrompt: 'hello',
      maxTokens: 512,
    });
    expect(reasoningBody.max_completion_tokens).toBe(512);
    expect(reasoningBody.temperature).toBeUndefined();

    const geminiRoute = resolveDynamicModelRoute('gemini-2.0-flash', {
      geminiApiKey: 'AIzaSyTestGeminiKey123456',
    });
    expect(geminiRoute.endpointUrl).toContain('gemini-2.0-flash:generateContent');
    expect(geminiRoute.endpointUrl).not.toContain('key=');
    expect(geminiRoute.headers['x-goog-api-key']).toBe('AIzaSyTestGeminiKey123456');

    const claudeRoute = resolveDynamicModelRoute('claude-3-5-sonnet-latest', {
      claudeApiKey: 'sk-ant-test-claude-key-123456',
    });
    expect(claudeRoute.headers['x-api-key']).toBe('sk-ant-test-claude-key-123456');
    expect(claudeRoute.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('callProviderApiText e callProviderApiJson extraem respostas corretamente para OpenAI, Gemini e Claude', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Sou o GPT-4o mini' } }] }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const openaiRoute = resolveDynamicModelRoute('gpt-4o-mini', {
      openaiApiKey: 'sk-test-openai-key-123456',
    });
    const openaiText = await callProviderApiText({
      routeConfig: openaiRoute,
      systemInstruction: 'Responda',
      userPrompt: 'Qual seu modelo?',
    });
    expect(openaiText).toBe('Sou o GPT-4o mini');

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const geminiJson = await callProviderApiJson({
      provider: 'GEMINI',
      apiKey: 'AIzaSyTestGeminiKey123456',
      model: 'gemini-2.0-flash',
      prompt: 'Retorne JSON',
    });
    expect(geminiJson).toBe('{"ok":true}');

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ text: 'Sou o Claude 3.5 Sonnet' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const claudeRoute = resolveDynamicModelRoute('claude-3-5-sonnet-latest', {
      claudeApiKey: 'sk-ant-test-claude-key-123456',
    });
    const claudeText = await callProviderApiText({
      routeConfig: claudeRoute,
      systemInstruction: 'Responda',
      userPrompt: 'Qual seu modelo?',
    });
    expect(claudeText).toBe('Sou o Claude 3.5 Sonnet');
  });

  it('propaga erros HTTP (401/429) e converte AbortError em HTTP 504', async () => {
    const openaiRoute = resolveDynamicModelRoute('gpt-4o-mini', {
      openaiApiKey: 'sk-test-openai-key-123456',
    });

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    ) as unknown as typeof fetch;

    await expect(
      callProviderApiText({
        routeConfig: openaiRoute,
        systemInstruction: 'sys',
        userPrompt: 'hi',
      })
    ).rejects.toThrow(/OpenAI API HTTP 401: Invalid API key/);

    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    globalThis.fetch = vi.fn().mockRejectedValueOnce(abortErr) as unknown as typeof fetch;

    await expect(
      callProviderApiText({
        routeConfig: openaiRoute,
        systemInstruction: 'sys',
        userPrompt: 'hi',
      })
    ).rejects.toThrow(/HTTP 504/);
  });

  it('executeModelSanityCheck valida resposta real via HTTP 200, rejeita 401 e modelo inexistente 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Sou o modelo GPT-4o mini da OpenAI.' } }] }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const okRes = await executeModelSanityCheck({
      modelId: 'gpt-4o-mini',
      userKeys: { openaiApiKey: 'sk-test-openai-key-123456' },
    });
    expect(okRes.passed).toBe(true);
    expect(okRes.diagnosticCode).toBe('VALID');

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Incorrect API key provided' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    ) as unknown as typeof fetch;

    const failRes = await executeModelSanityCheck({
      modelId: 'gpt-4o-mini',
      userKeys: { openaiApiKey: 'sk-test-openai-key-123456' },
    });
    expect(failRes.passed).toBe(false);
    expect(failRes.diagnosticCode).toBe('INVALID_CREDENTIALS');

    const missingKeyRes = await executeModelSanityCheck({
      modelId: 'claude-3-5-sonnet-latest',
      userKeys: {},
    });
    expect(missingKeyRes.passed).toBe(false);
    expect(missingKeyRes.diagnosticCode).toBe('MISSING_CREDENTIALS');

    const invalidModelRes = await executeModelSanityCheck({
      modelId: 'modelo-inexistente-999',
      userKeys: {},
    });
    expect(invalidModelRes.passed).toBe(false);
    expect(invalidModelRes.diagnosticCode).toBe('MODEL_UNAVAILABLE');
  });

  it('retenta automaticamente na OpenAI quando um modelo retorna HTTP 400 por parâmetro opcional não suportado', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "Unsupported value: 'temperature' does not support 0.2 with this model.",
            },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'Resposta após ajuste automático' } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const route = resolveDynamicModelRoute('gpt-4o-mini', {
      openaiApiKey: 'sk-test-openai-key-123456',
    });
    const text = await callProviderApiText({
      routeConfig: route,
      systemInstruction: 'sys',
      userPrompt: 'hello',
    });
    expect(text).toBe('Resposta após ajuste automático');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}'));
    expect(secondPayload.temperature).toBeUndefined();
    expect(secondPayload.max_completion_tokens).toBe(1024);

    const adaptedTools = adaptOpenAiBodyForUnsupportedParam(
      { model: 'gpt-6.2-sol', messages: [], tools: [] },
      "Function tools with reasoning_effort are not supported for gpt-6.2-sol in /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'."
    );
    expect(adaptedTools?.reasoning_effort).toBe('none');
  });
});

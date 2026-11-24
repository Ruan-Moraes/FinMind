import {
  type AiProviderId,
  getAiModelDescriptor,
  resolveDynamicModelRoute,
  type ResolvedModelRouteConfig,
} from '@/features/ai-copilot/models';
import { AI_PROVIDER_ADAPTERS } from '@/features/ai-copilot/providers/provider-adapters';

export { executeModelSanityCheck } from '@/features/ai-copilot/providers/sanity-check-runner';

async function executeProviderHttpRequest(params: {
  routeConfig: ResolvedModelRouteConfig;
  body: Record<string, unknown>;
  timeoutMs: number;
}): Promise<string> {
  const { routeConfig, body, timeoutMs } = params;
  const { provider, endpointUrl, headers, model } = routeConfig;
  const adapter = AI_PROVIDER_ADAPTERS[provider];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      const detail =
        errBody?.error?.message ||
        res.statusText ||
        `Credencial ou modelo recusado por ${adapter.displayGroupLabel}`;
      throw new Error(`${adapter.displayGroupLabel} API HTTP ${res.status}: ${detail}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return adapter.extractTextFromResponse(data);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `HTTP 504: Tempo limite excedido ao aguardar resposta de ${model.providerGroupLabel} (${model.displayName}).`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Chamada HTTP real direta para o endpoint oficial do provedor (OpenAI, Google Gemini ou Anthropic Claude).
 * Respeita estritamente o modelo selecionado (sem substituir silenciosamente por outro modelo em caso de erro).
 */
export async function callProviderApiText(params: {
  routeConfig: ResolvedModelRouteConfig;
  systemInstruction: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<string> {
  const { routeConfig, systemInstruction, userPrompt, maxTokens = 1024 } = params;
  const { provider, model } = routeConfig;

  if (!routeConfig.hasExternalApiKey) {
    throw new Error(
      `HTTP 401: Chave de API (${model.envVarName}) ausente para o provedor ${model.providerGroupLabel}.`
    );
  }

  const adapter = AI_PROVIDER_ADAPTERS[provider];
  const body = adapter.buildTextRequestBody({
    model,
    systemInstruction,
    userPrompt,
    maxTokens,
  });

  return executeProviderHttpRequest({ routeConfig, body, timeoutMs: 25000 });
}

/**
 * Chamada direta via API Oficial solicitando resposta JSON estruturada.
 */
export async function callProviderApiJson(params: {
  provider: AiProviderId;
  apiKey?: string | null;
  model: string;
  prompt: string;
  ssoToken?: string;
}): Promise<string> {
  const { provider, apiKey, model, prompt, ssoToken } = params;
  const descriptor = getAiModelDescriptor(model);
  const adapter = AI_PROVIDER_ADAPTERS[provider];

  const routeConfig = resolveDynamicModelRoute(
    descriptor.id,
    { [adapter.dbKeyField]: apiKey },
    ssoToken
  );

  if (!routeConfig.hasExternalApiKey) {
    throw new Error(
      `Chave de API (${descriptor.envVarName}) não configurada para ${descriptor.providerGroupLabel}.`
    );
  }

  const body = adapter.buildJsonRequestBody({ model: descriptor, prompt });
  return executeProviderHttpRequest({ routeConfig, body, timeoutMs: 30000 });
}

import {
  AI_MODELS_CATALOG,
  isAuthenticApiKey,
  type AiProviderId,
} from '@/features/ai-copilot/models';
import { fetchLiveGeminiModels } from '@/features/ai-copilot/providers/gemini-models-discovery';

export interface DiscoveredProviderModel {
  id: string;
  displayName: string;
  description: string;
  maxContextTokens: number;
}

export interface ProviderModelsDiscoveryResult {
  ok: boolean;
  provider: AiProviderId;
  source: 'LIVE_PROVIDER_API' | 'FALLBACK_CATALOG';
  models: DiscoveredProviderModel[];
  error?: string;
  httpStatus?: number;
}

const OPENAI_CHAT_INCLUDE = /^(gpt-|o1|o3|o4|chatgpt-)/i;
const OPENAI_EXCLUDE = /(audio|realtime|tts|whisper|dall-e|embedding|moderation|transcribe|image|search|instruct)/i;

export function getFallbackModelsForProvider(provider: AiProviderId): DiscoveredProviderModel[] {
  return AI_MODELS_CATALOG.filter((m) => m.provider === provider).map((m) => ({
    id: m.id,
    displayName: m.displayName,
    description: m.description,
    maxContextTokens: m.capabilities.maxContextTokens,
  }));
}

function formatOpenAiDisplayName(id: string): string {
  return id
    .split('-')
    .map((p) => (p.toLowerCase() === 'gpt' ? 'GPT' : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

export async function fetchLiveOpenAiModels(
  apiKey: string
): Promise<ProviderModelsDiscoveryResult> {
  const cleanKey = apiKey.trim();
  if (!isAuthenticApiKey(cleanKey)) {
    return {
      ok: false,
      provider: 'OPENAI',
      source: 'FALLBACK_CATALOG',
      models: getFallbackModelsForProvider('OPENAI'),
      error: 'Informe uma chave válida da OpenAI para listar os modelos liberados.',
    };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${cleanKey}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        ok: false,
        provider: 'OPENAI',
        source: 'FALLBACK_CATALOG',
        models: getFallbackModelsForProvider('OPENAI'),
        httpStatus: res.status,
        error: `OpenAI retornou HTTP ${res.status} ao listar modelos.`,
      };
    }

    const payload = (await res.json()) as { data?: Array<{ id?: string; created?: number }> };
    const rawList = Array.isArray(payload.data) ? payload.data : [];
    const seen = new Set<string>();
    const discovered: DiscoveredProviderModel[] = rawList
      .filter((item) => {
        const id = String(item.id || '').trim();
        if (!id || seen.has(id)) return false;
        if (!OPENAI_CHAT_INCLUDE.test(id) || OPENAI_EXCLUDE.test(id)) return false;
        seen.add(id);
        return true;
      })
      .sort((a, b) => (b.created || 0) - (a.created || 0))
      .map((item) => {
        const id = String(item.id).trim();
        return {
          id,
          displayName: formatOpenAiDisplayName(id),
          description: `Modelo ${id} liberado pela sua conta OpenAI.`,
          maxContextTokens: 128000,
        };
      });

    if (discovered.length === 0) {
      return {
        ok: true,
        provider: 'OPENAI',
        source: 'FALLBACK_CATALOG',
        models: getFallbackModelsForProvider('OPENAI'),
      };
    }

    return {
      ok: true,
      provider: 'OPENAI',
      source: 'LIVE_PROVIDER_API',
      models: discovered,
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'OPENAI',
      source: 'FALLBACK_CATALOG',
      models: getFallbackModelsForProvider('OPENAI'),
      error: err instanceof Error ? err.message : 'Erro ao consultar modelos na OpenAI.',
    };
  }
}

export async function fetchLiveAnthropicModels(
  apiKey: string
): Promise<ProviderModelsDiscoveryResult> {
  const cleanKey = apiKey.trim();
  if (!isAuthenticApiKey(cleanKey)) {
    return {
      ok: false,
      provider: 'CLAUDE',
      source: 'FALLBACK_CATALOG',
      models: getFallbackModelsForProvider('CLAUDE'),
      error: 'Informe uma chave válida da Anthropic para listar os modelos liberados.',
    };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': cleanKey,
        'anthropic-version': '2023-06-01',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        ok: false,
        provider: 'CLAUDE',
        source: 'FALLBACK_CATALOG',
        models: getFallbackModelsForProvider('CLAUDE'),
        httpStatus: res.status,
        error: `Anthropic retornou HTTP ${res.status} ao listar modelos.`,
      };
    }

    const payload = (await res.json()) as {
      data?: Array<{ id?: string; display_name?: string }>;
    };
    const rawList = Array.isArray(payload.data) ? payload.data : [];
    const discovered: DiscoveredProviderModel[] = rawList
      .filter((item) => typeof item.id === 'string' && item.id.trim().length > 0)
      .map((item) => {
        const id = String(item.id).trim();
        return {
          id,
          displayName: item.display_name?.trim() || id,
          description: `Modelo ${item.display_name || id} liberado pela sua conta Anthropic.`,
          maxContextTokens: 200000,
        };
      });

    if (discovered.length === 0) {
      return {
        ok: true,
        provider: 'CLAUDE',
        source: 'FALLBACK_CATALOG',
        models: getFallbackModelsForProvider('CLAUDE'),
      };
    }

    return {
      ok: true,
      provider: 'CLAUDE',
      source: 'LIVE_PROVIDER_API',
      models: discovered,
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'CLAUDE',
      source: 'FALLBACK_CATALOG',
      models: getFallbackModelsForProvider('CLAUDE'),
      error: err instanceof Error ? err.message : 'Erro ao consultar modelos na Anthropic.',
    };
  }
}

export async function fetchLiveProviderModels(
  provider: AiProviderId,
  apiKey: string
): Promise<ProviderModelsDiscoveryResult> {
  if (provider === 'OPENAI') return fetchLiveOpenAiModels(apiKey);
  if (provider === 'CLAUDE') return fetchLiveAnthropicModels(apiKey);

  const geminiRes = await fetchLiveGeminiModels(apiKey);
  return {
    ok: geminiRes.ok,
    provider: 'GEMINI',
    source: geminiRes.source === 'LIVE_GOOGLE_API' ? 'LIVE_PROVIDER_API' : 'FALLBACK_CATALOG',
    models: geminiRes.models.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      description: m.description,
      maxContextTokens: m.capabilities.maxContextTokens,
    })),
    error: geminiRes.error || undefined,
    httpStatus: geminiRes.httpStatus,
  };
}

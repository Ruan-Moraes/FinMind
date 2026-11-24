import crypto from 'crypto';
import type { AiProviderId } from '@/features/ai-copilot/domain/ai-provider-types';
import { isAuthenticApiKey } from '@/features/ai-copilot/models/model-route-resolver';
import {
  fetchAnthropicOfficialModels,
  fetchGeminiOfficialModels,
  fetchOpenAiOfficialModels,
  type OfficialModelsDiscoveryResult,
} from '@/features/ai-copilot/services/official-models-fetchers';

export type { OfficialModelsDiscoveryResult };

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  result: OfficialModelsDiscoveryResult;
}

const modelsCache = new Map<string, CacheEntry>();

function buildCacheKey(userId: string, provider: AiProviderId, apiKey: string): string {
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
  return `${userId}::${provider}::${keyHash}`;
}

export function invalidateProviderModelsCache(userId: string, provider?: AiProviderId): void {
  const prefix = provider ? `${userId}::${provider}::` : `${userId}::`;
  for (const key of modelsCache.keys()) {
    if (key.startsWith(prefix)) modelsCache.delete(key);
  }
}

export async function discoverOfficialProviderModels(params: {
  userId: string;
  provider: AiProviderId;
  apiKey: string;
  forceRefresh?: boolean;
}): Promise<OfficialModelsDiscoveryResult> {
  const { userId, provider, forceRefresh = false } = params;
  const cleanKey = (params.apiKey || '').trim();
  const fetchedAt = new Date().toISOString();

  if (!isAuthenticApiKey(cleanKey)) {
    return {
      ok: false,
      provider,
      models: [],
      fetchedAt,
      fromCache: false,
      diagnosticCode: 'MISSING_CREDENTIALS',
      error: 'Nenhuma chave de API configurada para este provedor.',
    };
  }

  const cacheKey = buildCacheKey(userId, provider, cleanKey);
  if (!forceRefresh) {
    const cached = modelsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.result, fromCache: true };
    }
  }

  try {
    const result =
      provider === 'OPENAI'
        ? await fetchOpenAiOfficialModels(cleanKey)
        : provider === 'CLAUDE'
        ? await fetchAnthropicOfficialModels(cleanKey)
        : await fetchGeminiOfficialModels(cleanKey);

    if (result.ok) {
      modelsCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
    }
    return result;
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      provider,
      models: [],
      fetchedAt,
      fromCache: false,
      httpStatus: isTimeout ? 504 : 503,
      diagnosticCode: isTimeout ? 'SERVICE_UNAVAILABLE' : 'NETWORK_ERROR',
      error: isTimeout
        ? 'Tempo limite excedido ao consultar a lista de modelos do provedor.'
        : err instanceof Error
        ? err.message
        : 'Erro de rede ao consultar modelos do provedor.',
    };
  }
}

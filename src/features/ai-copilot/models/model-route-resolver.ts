import {
  getAiModelDescriptor,
  type AiModelDescriptor,
  type AiProviderId,
} from '@/features/ai-copilot/models/models-catalog';
import { AI_PROVIDER_ADAPTERS } from '@/features/ai-copilot/providers/provider-adapters';

/**
 * Verifica se uma string é uma chave de API real (em texto puro) pronta para autenticação HTTP.
 * Rejeita strings vazias, curtas, criptografadas (`enc:v1:`) ou mascaradas (`••••`).
 */
export function isAuthenticApiKey(rawKey?: string | null): boolean {
  if (!rawKey) return false;
  const trimmed = rawKey.trim();
  if (trimmed.length <= 8) return false;
  if (trimmed.startsWith('enc:v1:')) return false;
  if (trimmed.includes('••') || trimmed.includes('...')) return false;
  return true;
}

/**
 * Mascara uma chave de API para exibição segura na interface sem expor o segredo no cliente.
 */
export function maskApiKey(rawKey?: string | null): string {
  if (!isAuthenticApiKey(rawKey)) return '';
  const trimmed = String(rawKey).trim();
  if (trimmed.length <= 12) return '••••••••';
  return `${trimmed.slice(0, 7)}••••${trimmed.slice(-4)}`;
}

export interface ResolvedModelRouteConfig {
  model: AiModelDescriptor;
  provider: AiProviderId;
  endpointUrl: string;
  headers: Record<string, string>;
  hasExternalApiKey: boolean;
  effectiveApiKey: string;
  resolvedCredentialSource: 'USER_DB_KEY' | 'ENV_KEY' | 'NONE';
}

export function resolveDynamicModelRoute(
  modelId: string,
  userKeys?: {
    openaiApiKey?: string | null;
    geminiApiKey?: string | null;
    claudeApiKey?: string | null;
  },
  explicitProvider?: AiProviderId
): ResolvedModelRouteConfig {
  const descriptor = getAiModelDescriptor(modelId, explicitProvider);
  const adapter = AI_PROVIDER_ADAPTERS[descriptor.provider];
  const rawDbValue = userKeys?.[descriptor.credentialKeyName]?.trim() || '';

  const dbApiKey = isAuthenticApiKey(rawDbValue) ? rawDbValue : '';
  const rawEnvKey =
    typeof process !== 'undefined' && process.env
      ? (process.env[descriptor.envVarName] || '').trim()
      : '';
  const envKey = isAuthenticApiKey(rawEnvKey) ? rawEnvKey : '';

  const effectiveApiKey = dbApiKey || envKey;
  const hasExternalApiKey = effectiveApiKey.length > 8;

  const resolvedCredentialSource: ResolvedModelRouteConfig['resolvedCredentialSource'] =
    dbApiKey.length > 8
      ? 'USER_DB_KEY'
      : envKey.length > 8
      ? 'ENV_KEY'
      : 'NONE';

  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const { endpointUrl, headers } = adapter.buildEndpointAndHeaders({
    model: descriptor,
    effectiveApiKey,
    hasExternalApiKey,
    baseHeaders,
  });

  return {
    model: descriptor,
    provider: descriptor.provider,
    endpointUrl,
    headers,
    hasExternalApiKey,
    effectiveApiKey,
    resolvedCredentialSource,
  };
}

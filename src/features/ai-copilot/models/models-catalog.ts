import {
  PROVIDER_STATIC_META,
  type AiModelId,
  type AiProviderId,
  type IntegrationDiagnosticCode,
} from '@/features/ai-copilot/domain/ai-provider-types';

export type { AiModelId, AiProviderId, IntegrationDiagnosticCode };

export interface AiModelCapabilities {
  supportsJsonMode: boolean;
  supportsSystemInstruction: boolean;
  supportsEmbeddings: boolean;
  embeddingModelId: string | null;
  maxContextTokens: number;
}

export interface AiModelDescriptor {
  id: AiModelId;
  displayName: string;
  provider: AiProviderId;
  providerGroupLabel: string;
  shortProviderName: string;
  endpointUrl: string;
  upstreamApiModel: string;
  credentialKeyName: 'openaiApiKey' | 'geminiApiKey' | 'claudeApiKey';
  envVarName: string;
  keyPlaceholder: string;
  expectedIdentityKeywords: string[];
  badgeColor: string;
  description: string;
  capabilities: AiModelCapabilities;
}

export const DEFAULT_AI_MODEL_ID: AiModelId = '';

export function inferProviderFromModelId(modelId?: string | null): AiProviderId | null {
  const clean = String(modelId || '').trim().toLowerCase().replace(/^models\//, '');
  if (!clean) return null;
  if (clean.startsWith('claude-') || clean.includes('anthropic')) return 'CLAUDE';
  if (clean.startsWith('gemini-') || clean.startsWith('gemma-') || clean.includes('gemini')) return 'GEMINI';
  if (
    clean.startsWith('gpt-') ||
    clean.startsWith('chatgpt-') ||
    /^o[1-9](?:-|$)/.test(clean) ||
    clean.startsWith('ft:gpt-') ||
    clean.startsWith('text-embedding-')
  ) {
    return 'OPENAI';
  }
  return null;
}

function formatDynamicModelName(provider: AiProviderId, id: string): string {
  return id
    .split('-')
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === 'gpt') return 'GPT';
      if (provider === 'GEMINI' && lower === 'gemini') return 'Gemini';
      if (provider === 'CLAUDE' && lower === 'claude') return 'Claude';
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

export function buildDynamicModelDescriptor(
  provider: AiProviderId,
  rawModelId: string,
  meta?: { displayName?: string; description?: string; maxContextTokens?: number | null }
): AiModelDescriptor {
  const cleanId = rawModelId.trim().replace(/^models\//i, '');
  const metaInfo = PROVIDER_STATIC_META[provider];
  const displayName = meta?.displayName?.trim() || formatDynamicModelName(provider, cleanId);

  const endpointUrl =
    provider === 'OPENAI'
      ? 'https://api.openai.com/v1/chat/completions'
      : provider === 'CLAUDE'
      ? 'https://api.anthropic.com/v1/messages'
      : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanId)}:generateContent`;

  const providerKeywords =
    provider === 'OPENAI'
      ? ['openai', 'gpt', 'chatgpt']
      : provider === 'GEMINI'
      ? ['gemini', 'google']
      : ['claude', 'anthropic'];

  return {
    id: cleanId,
    displayName,
    provider,
    providerGroupLabel: metaInfo.name,
    shortProviderName: metaInfo.shortName,
    endpointUrl,
    upstreamApiModel: cleanId,
    credentialKeyName: metaInfo.dbKeyField,
    envVarName: metaInfo.envVarName,
    keyPlaceholder: metaInfo.keyPlaceholder,
    expectedIdentityKeywords: [cleanId.toLowerCase(), ...providerKeywords],
    badgeColor: metaInfo.badgeColor,
    description: meta?.description?.trim() || `${metaInfo.name} • ${cleanId}`,
    capabilities: {
      supportsJsonMode: provider !== 'CLAUDE',
      supportsSystemInstruction: true,
      supportsEmbeddings: provider !== 'CLAUDE',
      embeddingModelId:
        provider === 'OPENAI'
          ? 'text-embedding-3-small'
          : provider === 'GEMINI'
          ? 'text-embedding-004'
          : null,
      maxContextTokens:
        meta?.maxContextTokens || (provider === 'GEMINI' ? 1000000 : provider === 'CLAUDE' ? 200000 : 128000),
    },
  };
}

/**
 * Constrói dinamicamente o descritor de qualquer modelo (sem lista estática limitante).
 * Se `explicitProvider` for informado, respeita-o estritamente (suporta inclusive novos modelos/famílias).
 */
export function findStrictAiModelDescriptor(
  modelId?: string | null,
  explicitProvider?: AiProviderId
): AiModelDescriptor | null {
  const clean = String(modelId || '').trim().replace(/^models\//i, '');
  if (!clean) return null;
  const provider = explicitProvider || inferProviderFromModelId(clean);
  if (!provider) return null;
  return buildDynamicModelDescriptor(provider, clean);
}

export function getAiModelDescriptor(
  modelId?: string | null,
  explicitProvider?: AiProviderId
): AiModelDescriptor {
  const strict = findStrictAiModelDescriptor(modelId, explicitProvider);
  if (strict) return strict;
  const provider = explicitProvider || 'OPENAI';
  const fallbackId = String(modelId || '').trim() || 'modelo-nao-selecionado';
  return buildDynamicModelDescriptor(provider, fallbackId);
}


export type AiProviderId = 'OPENAI' | 'GEMINI' | 'CLAUDE';
export type AiConnectionMode = 'SUBSCRIPTION' | 'API_QUOTA';
export type AiModelId = string;
export type IntegrationDiagnosticCode =
  | 'VALID'
  | 'MISSING_CREDENTIALS'
  | 'INVALID_CREDENTIALS'
  | 'AUTH_ERROR'
  | 'MODEL_UNAVAILABLE'
  | 'FEATURE_INCOMPATIBLE'
  | 'RATE_LIMITED_OR_QUOTA'
  | 'SERVICE_UNAVAILABLE'
  | 'NETWORK_ERROR';
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
export const AI_MODELS_CATALOG: AiModelDescriptor[] = [
  {
    id: 'gpt-4o-mini', displayName: 'GPT-4o Mini',
    provider: 'OPENAI', providerGroupLabel: 'OpenAI',
    shortProviderName: 'OpenAI', endpointUrl: 'https://api.openai.com/v1/chat/completions',
    upstreamApiModel: 'gpt-4o-mini', credentialKeyName: 'openaiApiKey',
    envVarName: 'OPENAI_API_KEY', keyPlaceholder: 'sk-proj-...',
    expectedIdentityKeywords: ['gpt-4o-mini', 'gpt-4o', 'gpt-4', 'gpt', 'openai'], badgeColor: '#10b981',
    description: 'Modelo oficial OpenAI rápido e econômico para classificação, extração estruturada e assistente financeiro.',
    capabilities: {
      supportsJsonMode: true, supportsSystemInstruction: true,
      supportsEmbeddings: true, embeddingModelId: 'text-embedding-3-small',
      maxContextTokens: 128000, },
  },
  {
    id: 'gpt-4o', displayName: 'GPT-4o',
    provider: 'OPENAI', providerGroupLabel: 'OpenAI',
    shortProviderName: 'OpenAI', endpointUrl: 'https://api.openai.com/v1/chat/completions',
    upstreamApiModel: 'gpt-4o', credentialKeyName: 'openaiApiKey',
    envVarName: 'OPENAI_API_KEY', keyPlaceholder: 'sk-proj-...',
    expectedIdentityKeywords: ['gpt-4o', 'gpt-4', 'gpt', 'openai'], badgeColor: '#10b981',
    description: 'Modelo multimodal topo de linha da OpenAI para auditoria patrimonial, conciliação complexa e RAG.',
    capabilities: {
      supportsJsonMode: true, supportsSystemInstruction: true,
      supportsEmbeddings: true, embeddingModelId: 'text-embedding-3-small',
      maxContextTokens: 128000, },
  },
  {
    id: 'o3-mini', displayName: 'OpenAI o3-mini',
    provider: 'OPENAI', providerGroupLabel: 'OpenAI',
    shortProviderName: 'OpenAI', endpointUrl: 'https://api.openai.com/v1/chat/completions',
    upstreamApiModel: 'o3-mini', credentialKeyName: 'openaiApiKey',
    envVarName: 'OPENAI_API_KEY', keyPlaceholder: 'sk-proj-...',
    expectedIdentityKeywords: ['o3-mini', 'o3', 'gpt', 'openai'], badgeColor: '#10b981',
    description: 'Modelo de raciocínio analítico da OpenAI para projeções financeiras e simulações de metas.',
    capabilities: {
      supportsJsonMode: true, supportsSystemInstruction: true,
      supportsEmbeddings: true, embeddingModelId: 'text-embedding-3-small',
      maxContextTokens: 200000, },
  },
  {
    id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash',
    provider: 'GEMINI', providerGroupLabel: 'Google Gemini',
    shortProviderName: 'Gemini',
    endpointUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    upstreamApiModel: 'gemini-2.5-flash', credentialKeyName: 'geminiApiKey',
    envVarName: 'GEMINI_API_KEY', keyPlaceholder: 'AIzaSy...',
    expectedIdentityKeywords: ['gemini 2.5', 'gemini-2.5', 'gemini', 'google'], badgeColor: '#3b82f6',
    description: 'Modelo Google Gemini 2.5 Flash de alta velocidade e raciocínio para análise de extratos.',
    capabilities: {
      supportsJsonMode: true, supportsSystemInstruction: true,
      supportsEmbeddings: true, embeddingModelId: 'text-embedding-004',
      maxContextTokens: 1000000, },
  },
  {
    id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro',
    provider: 'GEMINI', providerGroupLabel: 'Google Gemini',
    shortProviderName: 'Gemini',
    endpointUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent',
    upstreamApiModel: 'gemini-2.5-pro', credentialKeyName: 'geminiApiKey',
    envVarName: 'GEMINI_API_KEY', keyPlaceholder: 'AIzaSy...',
    expectedIdentityKeywords: ['gemini 2.5', 'gemini-2.5', 'gemini', 'google'], badgeColor: '#3b82f6',
    description: 'Modelo Google Gemini 2.5 Pro para análise profunda de múltiplos extratos e planejamento financeiro.',
    capabilities: {
      supportsJsonMode: true, supportsSystemInstruction: true,
      supportsEmbeddings: true, embeddingModelId: 'text-embedding-004',
      maxContextTokens: 1000000, },
  },
  {
    id: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash-Lite',
    provider: 'GEMINI', providerGroupLabel: 'Google Gemini',
    shortProviderName: 'Gemini',
    endpointUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
    upstreamApiModel: 'gemini-2.5-flash-lite', credentialKeyName: 'geminiApiKey',
    envVarName: 'GEMINI_API_KEY', keyPlaceholder: 'AIzaSy...',
    expectedIdentityKeywords: ['gemini 2.5', 'gemini-2.5', 'gemini', 'google'], badgeColor: '#3b82f6',
    description: 'Modelo Google Gemini 2.5 Flash-Lite ultra econômico e veloz para categorização diária.',
    capabilities: {
      supportsJsonMode: true, supportsSystemInstruction: true,
      supportsEmbeddings: true, embeddingModelId: 'text-embedding-004',
      maxContextTokens: 1000000, },
  },
  {
    id: 'claude-3-5-haiku-latest', displayName: 'Claude 3.5 Haiku',
    provider: 'CLAUDE', providerGroupLabel: 'Anthropic Claude',
    shortProviderName: 'Claude', endpointUrl: 'https://api.anthropic.com/v1/messages',
    upstreamApiModel: 'claude-3-5-haiku-latest', credentialKeyName: 'claudeApiKey',
    envVarName: 'ANTHROPIC_API_KEY', keyPlaceholder: 'sk-ant-api03-...',
    expectedIdentityKeywords: ['claude', 'haiku', 'anthropic'], badgeColor: '#d97706',
    description: 'Modelo oficial Anthropic Claude 3.5 Haiku de baixa latência para categorização rápida.',
    capabilities: {
      supportsJsonMode: false, supportsSystemInstruction: true,
      supportsEmbeddings: false, embeddingModelId: null,
      maxContextTokens: 200000, },
  },
  {
    id: 'claude-3-5-sonnet-latest', displayName: 'Claude 3.5 Sonnet',
    provider: 'CLAUDE', providerGroupLabel: 'Anthropic Claude',
    shortProviderName: 'Claude', endpointUrl: 'https://api.anthropic.com/v1/messages',
    upstreamApiModel: 'claude-3-5-sonnet-latest', credentialKeyName: 'claudeApiKey',
    envVarName: 'ANTHROPIC_API_KEY', keyPlaceholder: 'sk-ant-api03-...',
    expectedIdentityKeywords: ['claude', 'sonnet', 'anthropic'], badgeColor: '#d97706',
    description: 'Modelo oficial Anthropic Claude 3.5 Sonnet balanceado para engenharia financeira e relatórios.',
    capabilities: {
      supportsJsonMode: false, supportsSystemInstruction: true,
      supportsEmbeddings: false, embeddingModelId: null,
      maxContextTokens: 200000, },
  },
  {
    id: 'claude-3-7-sonnet-latest', displayName: 'Claude 3.7 Sonnet',
    provider: 'CLAUDE', providerGroupLabel: 'Anthropic Claude',
    shortProviderName: 'Claude', endpointUrl: 'https://api.anthropic.com/v1/messages',
    upstreamApiModel: 'claude-3-7-sonnet-latest', credentialKeyName: 'claudeApiKey',
    envVarName: 'ANTHROPIC_API_KEY', keyPlaceholder: 'sk-ant-api03-...',
    expectedIdentityKeywords: ['claude', 'sonnet', 'anthropic'], badgeColor: '#d97706',
    description: 'Modelo oficial Anthropic Claude 3.7 Sonnet para raciocínio patrimonial e diagnóstico avançado.',
    capabilities: {
      supportsJsonMode: false, supportsSystemInstruction: true,
      supportsEmbeddings: false, embeddingModelId: null,
      maxContextTokens: 200000, },
  }, ];
export const DEFAULT_AI_MODEL_ID: AiModelId = 'gpt-4o-mini';
export const LEGACY_MODEL_ID_MIGRATION_MAP: Record<string, AiModelId> = {
  'gpt-luna': 'gpt-4o-mini', 'gpt-terra': 'gpt-4o',
  'gpt-sol': 'gpt-4o', astra: 'gpt-4o-mini',
  'gemini-3.8-pro': 'gemini-2.0-flash', 'gemini-agon': 'gemini-2.0-flash',
  'claude-haiku': 'claude-3-5-haiku-latest', 'claude-sonnet': 'claude-3-5-sonnet-latest',
  'claude-opus': 'claude-3-7-sonnet-latest', };
export const SSO_POPUP_TOKEN_PREFIX = 'sso_popup_token::';
const DYNAMIC_GEMINI_MODEL_REGEX = /^(?:models\/)?(gemini-[a-z0-9][a-z0-9._-]{1,64})$/i;
const DYNAMIC_OPENAI_MODEL_REGEX = /^((?:gpt-[3-6]|o[1-4]|chatgpt-4)[a-z0-9._-]{0,60})$/i;
const DYNAMIC_CLAUDE_MODEL_REGEX = /^(claude-[a-z0-9._-]{1,64})$/i;

export function buildDynamicGeminiDescriptor(
  rawModelId: string,
  meta?: { displayName?: string; description?: string; maxContextTokens?: number }
): AiModelDescriptor {
  const cleanId = rawModelId.trim().replace(/^models\//i, '').toLowerCase();
  const formattedName =
    meta?.displayName?.trim() ||
    cleanId
      .split('-')
      .map((part) => (part === 'gemini' ? 'Gemini' : part.charAt(0).toUpperCase() + part.slice(1)))
      .join(' ');
  const versionMatch = cleanId.match(/gemini-(\d+(?:\.\d+)?)/i);
  const versionKeywords = versionMatch
    ? [`gemini ${versionMatch[1]}`, `gemini-${versionMatch[1]}`]
    : [];

  return {
    id: cleanId,
    displayName: formattedName,
    provider: 'GEMINI',
    providerGroupLabel: 'Google Gemini',
    shortProviderName: 'Gemini',
    endpointUrl: `https://generativelanguage.googleapis.com/v1beta/models/${cleanId}:generateContent`,
    upstreamApiModel: cleanId,
    credentialKeyName: 'geminiApiKey',
    envVarName: 'GEMINI_API_KEY',
    keyPlaceholder: 'AIzaSy...',
    expectedIdentityKeywords: [...versionKeywords, cleanId, 'gemini', 'google'],
    badgeColor: '#3b82f6',
    description:
      meta?.description?.trim() ||
      `Modelo ${formattedName} liberado dinamicamente pela sua conta Google Gemini.`,
    capabilities: {
      supportsJsonMode: true,
      supportsSystemInstruction: true,
      supportsEmbeddings: true,
      embeddingModelId: 'text-embedding-004',
      maxContextTokens: meta?.maxContextTokens || 1000000,
    },
  };
}

export function findStrictAiModelDescriptor(modelId?: string | null): AiModelDescriptor | null {
  const normalized = String(modelId || '').toLowerCase().trim();
  if (!normalized) return null;
  const direct = AI_MODELS_CATALOG.find((m) => m.id.toLowerCase() === normalized);
  if (direct) return direct;
  const migratedId = LEGACY_MODEL_ID_MIGRATION_MAP[normalized];
  if (migratedId) {
    return AI_MODELS_CATALOG.find((m) => m.id === migratedId) || null;
  }
  const geminiMatch = normalized.match(DYNAMIC_GEMINI_MODEL_REGEX);
  if (geminiMatch) return buildDynamicGeminiDescriptor(geminiMatch[1]);
  const openaiMatch = normalized.match(DYNAMIC_OPENAI_MODEL_REGEX);
  if (openaiMatch) {
    const id = openaiMatch[1];
    return { ...AI_MODELS_CATALOG[0], id, displayName: id, upstreamApiModel: id, expectedIdentityKeywords: [id, 'gpt', 'openai'], description: `Modelo ${id} liberado dinamicamente pela sua conta OpenAI.` };
  }
  const claudeMatch = normalized.match(DYNAMIC_CLAUDE_MODEL_REGEX);
  if (claudeMatch) {
    const id = claudeMatch[1];
    const baseClaude = AI_MODELS_CATALOG.find((m) => m.provider === 'CLAUDE') || AI_MODELS_CATALOG[0];
    return { ...baseClaude, id, displayName: id, upstreamApiModel: id, expectedIdentityKeywords: [id, 'claude', 'anthropic'], description: `Modelo ${id} liberado dinamicamente pela sua conta Anthropic.` };
  }
  return null;
}
export function getAiModelDescriptor(modelId?: string | null): AiModelDescriptor {
  return findStrictAiModelDescriptor(modelId) || AI_MODELS_CATALOG[0];
}

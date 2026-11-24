export type AiProviderId = 'OPENAI' | 'GEMINI' | 'CLAUDE';
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

export type ProviderAuthStatus =
  | 'NOT_CONFIGURED'
  | 'UNVERIFIED'
  | 'VERIFYING'
  | 'CONNECTED'
  | 'OPERATIONAL'
  | 'INVALID_CREDENTIALS'
  | 'ACCESS_RESTRICTED'
  | 'QUOTA_EXCEEDED'
  | 'UNAVAILABLE';

export interface DiscoveredAiModelCapabilities {
  chat: boolean;
  tools: boolean;
  jsonMode: boolean;
  embeddings: boolean;
  audioTranscription: boolean;
  vision: boolean;
}

export interface DiscoveredAiModel {
  id: string;
  displayName: string;
  provider: AiProviderId;
  description: string;
  createdAt?: string | null;
  ownedBy?: string | null;
  shutdownDate?: string | null;
  maxContextTokens?: number | null;
  capabilities: DiscoveredAiModelCapabilities;
  compatibleWithApp: boolean;
  incompatibilityReason?: string | null;
  isDeprecated: boolean;
}

export interface ProviderIntegrationError {
  code: IntegrationDiagnosticCode;
  message: string;
  httpStatus?: number;
}

export interface ProviderIntegrationState {
  provider: AiProviderId;
  hasStoredKey: boolean;
  hasEnvKey: boolean;
  keyPreview: string;
  credentialSource: 'USER_DB_KEY' | 'ENV_KEY' | 'NONE';
  status: ProviderAuthStatus;
  selectedModelId: string;
  selectedModelAvailable: boolean;
  models: DiscoveredAiModel[];
  modelsLoading: boolean;
  modelsFetchedAt: string | null;
  lastVerifiedAt: string | null;
  error: ProviderIntegrationError | null;
}

export interface GlobalAiState {
  activeProvider: AiProviderId;
  activeModelId: string;
  providers: Record<AiProviderId, ProviderIntegrationState>;
}

export interface ProviderStaticMeta {
  id: AiProviderId;
  name: string;
  shortName: string;
  company: string;
  badgeColor: string;
  envVarName: string;
  dbKeyField: 'openaiApiKey' | 'geminiApiKey' | 'claudeApiKey';
  dbModelField: 'openaiModel' | 'geminiModel' | 'claudeModel';
  keyLabel: string;
  keyPlaceholder: string;
  consoleUrl: string;
  consoleLabel: string;
}

export const AI_PROVIDER_IDS: AiProviderId[] = ['OPENAI', 'GEMINI', 'CLAUDE'];

export const PROVIDER_STATIC_META: Record<AiProviderId, ProviderStaticMeta> = {
  OPENAI: {
    id: 'OPENAI',
    name: 'OpenAI',
    shortName: 'OpenAI',
    company: 'OpenAI',
    badgeColor: '#10b981',
    envVarName: 'OPENAI_API_KEY',
    dbKeyField: 'openaiApiKey',
    dbModelField: 'openaiModel',
    keyLabel: 'Chave de API OpenAI',
    keyPlaceholder: 'sk-proj-...',
    consoleUrl: 'https://platform.openai.com/api-keys',
    consoleLabel: 'OpenAI Platform',
  },
  GEMINI: {
    id: 'GEMINI',
    name: 'Google Gemini',
    shortName: 'Gemini',
    company: 'Google',
    badgeColor: '#3b82f6',
    envVarName: 'GEMINI_API_KEY',
    dbKeyField: 'geminiApiKey',
    dbModelField: 'geminiModel',
    keyLabel: 'Chave de API Google Gemini',
    keyPlaceholder: 'AIzaSy...',
    consoleUrl: 'https://aistudio.google.com/app/apikey',
    consoleLabel: 'Google AI Studio',
  },
  CLAUDE: {
    id: 'CLAUDE',
    name: 'Anthropic Claude',
    shortName: 'Claude',
    company: 'Anthropic',
    badgeColor: '#d97706',
    envVarName: 'ANTHROPIC_API_KEY',
    dbKeyField: 'claudeApiKey',
    dbModelField: 'claudeModel',
    keyLabel: 'Chave de API Anthropic',
    keyPlaceholder: 'sk-ant-api03-...',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    consoleLabel: 'Anthropic Console',
  },
};

export const PROVIDER_STATUS_LABELS: Record<
  ProviderAuthStatus,
  { label: string; tone: 'neutral' | 'indigo' | 'emerald' | 'amber' | 'rose' }
> = {
  NOT_CONFIGURED: { label: 'Não configurado', tone: 'neutral' },
  UNVERIFIED: { label: 'Não verificado', tone: 'amber' },
  VERIFYING: { label: 'Verificando...', tone: 'indigo' },
  CONNECTED: { label: 'Conectado', tone: 'emerald' },
  OPERATIONAL: { label: 'Operacional', tone: 'emerald' },
  INVALID_CREDENTIALS: { label: 'Credencial inválida', tone: 'rose' },
  ACCESS_RESTRICTED: { label: 'Acesso restrito', tone: 'rose' },
  QUOTA_EXCEEDED: { label: 'Limite atingido', tone: 'amber' },
  UNAVAILABLE: { label: 'Indisponível', tone: 'amber' },
};

export function mapDiagnosticCodeToProviderStatus(
  code?: IntegrationDiagnosticCode
): ProviderAuthStatus {
  if (code === 'VALID') return 'CONNECTED';
  if (code === 'MISSING_CREDENTIALS') return 'NOT_CONFIGURED';
  if (code === 'INVALID_CREDENTIALS') return 'INVALID_CREDENTIALS';
  if (code === 'AUTH_ERROR') return 'ACCESS_RESTRICTED';
  if (code === 'RATE_LIMITED_OR_QUOTA') return 'QUOTA_EXCEEDED';
  if (code === 'MODEL_UNAVAILABLE' || code === 'FEATURE_INCOMPATIBLE') return 'CONNECTED';
  return 'UNAVAILABLE';
}

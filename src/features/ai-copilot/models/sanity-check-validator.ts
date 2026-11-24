import {
  AiModelId,
  AiProviderId,
  getAiModelDescriptor,
  IntegrationDiagnosticCode,
} from '@/features/ai-copilot/models/models-catalog';

/**
 * Pergunta padrão interna de Sanity Check exigida pela arquitetura.
 */
export const SANITY_CHECK_PROMPT = 'Qual é o seu modelo?';

export interface SanityCheckValidationResult {
  passed: boolean;
  diagnosticCode: IntegrationDiagnosticCode;
  selectedModelId: AiModelId;
  selectedModelName: string;
  provider: AiProviderId;
  promptSent: string;
  rawResponse: string;
  matchedKeyword: string | null;
  endpointRouted: string;
  credentialSource: 'USER_DB_KEY' | 'ENV_KEY' | 'NONE';
  authenticatedAccountEmail?: string | null;
  ssoVerified: boolean;
  httpStatus: number;
  error?: string | null;
  latencyMs: number;
  checkedAt: string;
}

/**
 * Classifica falhas reais de HTTP/rede retornadas pelos provedores em códigos de diagnóstico claros (Seção 5.3).
 */
export function classifyProviderError(
  httpStatus: number,
  errorMessage: string
): IntegrationDiagnosticCode {
  const lower = (errorMessage || '').toLowerCase();
  if (
    httpStatus === 401 ||
    lower.includes('invalid api key') ||
    lower.includes('incorrect api key') ||
    lower.includes('api_key_invalid')
  ) {
    return 'INVALID_CREDENTIALS';
  }
  if (httpStatus === 403 || lower.includes('permission') || lower.includes('forbidden')) {
    return 'AUTH_ERROR';
  }
  if (
    httpStatus === 404 ||
    lower.includes('model not found') ||
    lower.includes('not found') ||
    lower.includes('does not exist')
  ) {
    return 'MODEL_UNAVAILABLE';
  }
  if (
    httpStatus === 429 ||
    httpStatus === 402 ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('credit balance') ||
    lower.includes('billing')
  ) {
    return 'RATE_LIMITED_OR_QUOTA';
  }
  if (
    httpStatus === 400 &&
    (lower.includes('unsupported') ||
      lower.includes('response_format') ||
      lower.includes('parameter'))
  ) {
    return 'FEATURE_INCOMPATIBLE';
  }
  if (httpStatus >= 500 && httpStatus <= 599) {
    return 'SERVICE_UNAVAILABLE';
  }
  return 'NETWORK_ERROR';
}

/**
 * Valida se a resposta textual retornada pela IA condiz com o provedor/modelo selecionado no Header.
 */
export function validateModelIdentityResponse(
  selectedModelId: string,
  responseText: string,
  explicitProvider?: AiProviderId
): { passed: boolean; matchedKeyword: string | null } {
  const descriptor = getAiModelDescriptor(selectedModelId, explicitProvider);
  const normalizedResponse = String(responseText || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalizedResponse) {
    return { passed: false, matchedKeyword: null };
  }

  const otherProviderTokens: Record<AiProviderId, string[]> = {
    OPENAI: ['claude', 'anthropic', 'gemini'],
    GEMINI: ['claude', 'anthropic', 'openai', 'chatgpt'],
    CLAUDE: ['openai', 'chatgpt', 'gemini', 'gpt-4'],
  };

  const forbidden = otherProviderTokens[descriptor.provider] || [];
  if (forbidden.some((token) => normalizedResponse.includes(token))) {
    return { passed: false, matchedKeyword: null };
  }

  const matchedKeyword =
    descriptor.expectedIdentityKeywords.find((kw) =>
      normalizedResponse.includes(kw.toLowerCase())
    ) || null;

  return {
    passed: Boolean(matchedKeyword),
    matchedKeyword,
  };
}

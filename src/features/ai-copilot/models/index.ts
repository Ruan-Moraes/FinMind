export {
  type AiProviderId,
  type AiConnectionMode,
  type AiModelId,
  type IntegrationDiagnosticCode,
  type AiModelCapabilities,
  type AiModelDescriptor,
  AI_MODELS_CATALOG,
  DEFAULT_AI_MODEL_ID,
  LEGACY_MODEL_ID_MIGRATION_MAP,
  SSO_POPUP_TOKEN_PREFIX,
  findStrictAiModelDescriptor,
  getAiModelDescriptor,
} from '@/features/ai-copilot/models/models-catalog';

export {
  type ResolvedModelRouteConfig,
  isAuthenticApiKey,
  maskApiKey,
  resolveDynamicModelRoute,
} from '@/features/ai-copilot/models/model-route-resolver';

export {
  SANITY_CHECK_PROMPT,
  type SanityCheckValidationResult,
  classifyProviderError,
  validateModelIdentityResponse,
} from '@/features/ai-copilot/models/sanity-check-validator';

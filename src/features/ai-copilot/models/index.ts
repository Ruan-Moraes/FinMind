export {
  type AiProviderId,
  type AiModelId,
  type IntegrationDiagnosticCode,
  type AiModelCapabilities,
  type AiModelDescriptor,
  DEFAULT_AI_MODEL_ID,
  inferProviderFromModelId,
  buildDynamicModelDescriptor,
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

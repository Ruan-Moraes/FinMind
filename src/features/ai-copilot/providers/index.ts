export {
  AI_MODELS_CATALOG,
  type AiProviderId,
  type AiConnectionMode,
  type AiModelId,
  type AiModelDescriptor,
  type SanityCheckValidationResult,
  type IntegrationDiagnosticCode,
  getAiModelDescriptor,
  findStrictAiModelDescriptor,
  resolveDynamicModelRoute,
  validateModelIdentityResponse,
  classifyProviderError,
  isAuthenticApiKey,
  maskApiKey,
  SANITY_CHECK_PROMPT,
  DEFAULT_AI_MODEL_ID,
} from "@/features/ai-copilot/models";

export {
  type ExtractedStatementItem,
  type AiFinancialStatusAnalysis,
  AI_PROVIDER_META,
  buildSubscriptionStatementPrompt,
  buildSubscriptionStatusPrompt,
  extractJsonFromAiResponse,
} from "@/features/ai-copilot/providers/copilot-types-and-prompts";

export {
  executeModelSanityCheck,
  callProviderApiText,
  callProviderApiJson,
} from "@/features/ai-copilot/providers/provider-http-client";

export { smartParseStatementLocally } from "@/features/ai-copilot/providers/local-statement-parser";
export { generateSmartFinancialStatusAnalysis } from "@/features/ai-copilot/providers/local-financial-health";

import {
  classifyProviderError,
  findStrictAiModelDescriptor,
  resolveDynamicModelRoute,
  SANITY_CHECK_PROMPT,
  validateModelIdentityResponse,
  type AiProviderId,
  type SanityCheckValidationResult,
} from '@/features/ai-copilot/models';
import { callProviderApiText } from '@/features/ai-copilot/providers/provider-http-client';

/**
 * Executa teste operacional real de inferência (sob demanda) contra o endpoint oficial
 * do provedor selecionado usando exatamente o modelo informado.
 */
export async function executeModelSanityCheck(params: {
  modelId: string;
  provider?: AiProviderId;
  customPrompt?: string;
  userKeys?: {
    openaiApiKey?: string | null;
    geminiApiKey?: string | null;
    claudeApiKey?: string | null;
  };
}): Promise<SanityCheckValidationResult> {
  const startTime = Date.now();
  const effectivePrompt =
    params.customPrompt && params.customPrompt.trim().length > 0
      ? params.customPrompt.trim()
      : SANITY_CHECK_PROMPT;

  const strictDescriptor = findStrictAiModelDescriptor(params.modelId, params.provider);
  if (!strictDescriptor) {
    const latencyMs = Math.max(1, Date.now() - startTime);
    return {
      passed: false,
      diagnosticCode: 'MODEL_UNAVAILABLE',
      selectedModelId: String(params.modelId || ''),
      selectedModelName: String(params.modelId || 'Modelo não selecionado'),
      provider: params.provider || 'OPENAI',
      promptSent: effectivePrompt,
      rawResponse: '',
      matchedKeyword: null,
      endpointRouted: '',
      credentialSource: 'NONE',
      ssoVerified: false,
      httpStatus: 400,
      error: 'Selecione um modelo válido antes de executar o teste operacional.',
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  }

  const routeConfig = resolveDynamicModelRoute(
    strictDescriptor.id,
    params.userKeys,
    strictDescriptor.provider
  );
  const { model } = routeConfig;

  if (!routeConfig.hasExternalApiKey) {
    const latencyMs = Math.max(1, Date.now() - startTime);
    return {
      passed: false,
      diagnosticCode: 'MISSING_CREDENTIALS',
      selectedModelId: model.id,
      selectedModelName: model.displayName,
      provider: model.provider,
      promptSent: effectivePrompt,
      rawResponse: '',
      matchedKeyword: null,
      endpointRouted: model.endpointUrl,
      credentialSource: 'NONE',
      ssoVerified: false,
      httpStatus: 401,
      error: `Nenhuma chave de API oficial (${model.envVarName}) configurada para ${model.providerGroupLabel}.`,
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  }

  const systemInstruction =
    'Você é um assistente financeiro integrado ao sistema FinMind. Responda sempre em português do Brasil de forma objetiva e transparente. Se perguntado sobre seu modelo, informe seu modelo e provedor reais sem inventar informações.';

  try {
    const rawResponseText = await callProviderApiText({
      routeConfig,
      systemInstruction,
      userPrompt: effectivePrompt,
    });

    const latencyMs = Math.max(1, Date.now() - startTime);
    const validation = validateModelIdentityResponse(model.id, rawResponseText, model.provider);
    const isCustomQuestion =
      effectivePrompt.toLowerCase() !== SANITY_CHECK_PROMPT.toLowerCase();
    const passed = rawResponseText.trim().length > 0 && (validation.passed || isCustomQuestion);

    return {
      passed,
      diagnosticCode: passed ? 'VALID' : 'FEATURE_INCOMPATIBLE',
      selectedModelId: model.id,
      selectedModelName: model.displayName,
      provider: model.provider,
      promptSent: effectivePrompt,
      rawResponse: rawResponseText,
      matchedKeyword: validation.matchedKeyword || model.displayName,
      endpointRouted: model.endpointUrl,
      credentialSource: routeConfig.resolvedCredentialSource,
      ssoVerified: passed,
      httpStatus: passed ? 200 : 422,
      error: passed
        ? null
        : `A resposta recebida não confirmou a identidade de ${model.displayName}.`,
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    const latencyMs = Math.max(1, Date.now() - startTime);
    const errorMessage =
      err instanceof Error
        ? err.message
        : `Falha na comunicação com ${model.providerGroupLabel}.`;
    const statusMatch = errorMessage.match(/HTTP\s+(\d{3})/i);
    const httpStatus = statusMatch ? Number(statusMatch[1]) : 502;
    const diagnosticCode = classifyProviderError(httpStatus, errorMessage);

    return {
      passed: false,
      diagnosticCode,
      selectedModelId: model.id,
      selectedModelName: model.displayName,
      provider: model.provider,
      promptSent: effectivePrompt,
      rawResponse: '',
      matchedKeyword: null,
      endpointRouted: model.endpointUrl,
      credentialSource: routeConfig.resolvedCredentialSource,
      ssoVerified: false,
      httpStatus,
      error: errorMessage,
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  }
}

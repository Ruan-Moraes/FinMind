import { type SanityCheckValidationResult, getAiModelDescriptor, findStrictAiModelDescriptor, resolveDynamicModelRoute, validateModelIdentityResponse, classifyProviderError, SANITY_CHECK_PROMPT, DEFAULT_AI_MODEL_ID } from "@/features/ai-copilot/models";

import { callProviderApiText } from "@/features/ai-copilot/providers/provider-http-client";

/**
 * Executa o Sanity Check REAL e Autêntico do modelo selecionado:
 * 1. Valida se o modelo solicitado existe no catálogo oficial (rejeita modelos inexistentes com 404).
 * 2. Verifica se o provedor possui uma chave de API real configurada (rejeita imediatamente com 401 se ausente).
 * 3. Executa chamada HTTP real para o endpoint oficial do provedor (OpenAI, Google Gemini ou Anthropic Claude) usando exatamente o modelo selecionado.
 * 4. Distingue credenciais inválidas (401), problemas de permissão (403), modelo indisponível (404), limite de cota (429) e indisponibilidade (502/503).
 */
export async function executeModelSanityCheck(params: {
  modelId: string;
  ssoToken?: string;
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

  // 1. Verifica se o identificador do modelo existe no catálogo
  const strictDescriptor = findStrictAiModelDescriptor(params.modelId);
  if (!strictDescriptor) {
    const fallbackDescriptor = getAiModelDescriptor(DEFAULT_AI_MODEL_ID);
    const latencyMs = Math.max(1, Date.now() - startTime);
    return {
      passed: false,
      diagnosticCode: 'MODEL_UNAVAILABLE',
      selectedModelId: fallbackDescriptor.id,
      selectedModelName: String(params.modelId || 'Modelo Desconhecido'),
      provider: fallbackDescriptor.provider,
      promptSent: effectivePrompt,
      rawResponse: '',
      matchedKeyword: null,
      endpointRouted: fallbackDescriptor.endpointUrl,
      credentialSource: 'NONE',
      authenticatedAccountEmail: null,
      ssoVerified: false,
      httpStatus: 404,
      error: `O modelo "${params.modelId}" não existe ou não é suportado. Selecione um modelo oficial válido no catálogo.`,
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  }

  const routeConfig = resolveDynamicModelRoute(
    strictDescriptor.id,
    params.userKeys,
    params.ssoToken
  );
  const { model } = routeConfig;

  // 2. Verifica se existe chave de API real para ESTE provedor específico
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
      authenticatedAccountEmail: null,
      ssoVerified: false,
      httpStatus: 401,
      error: `Nenhuma chave de API oficial (${model.envVarName}) configurada para ${model.providerGroupLabel}. Configure uma chave válida para testar e usar o modelo ${model.displayName}.`,
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  }

  const systemInstruction =
    'Você é um assistente financeiro integrado ao sistema FinMind. Responda sempre em português do Brasil de forma objetiva, precisa e transparente. Se perguntado sobre seu modelo, informe seu modelo e provedor reais sem inventar informações.';

  // 3. Executa a chamada HTTP REAL para o provedor oficial
  try {
    const rawResponseText = await callProviderApiText({
      routeConfig,
      systemInstruction,
      userPrompt: effectivePrompt,
    });

    const latencyMs = Math.max(1, Date.now() - startTime);
    const validation = validateModelIdentityResponse(model.id, rawResponseText);
    const isCustomQuestion =
      effectivePrompt.toLowerCase() !== SANITY_CHECK_PROMPT.toLowerCase();
    const passed =
      rawResponseText.trim().length > 0 && (validation.passed || isCustomQuestion);

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
      authenticatedAccountEmail: null,
      ssoVerified: passed,
      httpStatus: passed ? 200 : 422,
      error: passed
        ? null
        : `A resposta recebida do provedor ("${rawResponseText.slice(0, 120)}") não confirmou a identidade de ${model.displayName}.`,
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
      authenticatedAccountEmail: null,
      ssoVerified: false,
      httpStatus,
      error: errorMessage,
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  }
}

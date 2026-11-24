'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/lib/prisma';
import { requireAuthenticatedUser } from '@/features/auth';
import { encryptSecret } from '@/features/auth/domain/secret-crypto';
import { type AiProviderId, type AiConnectionMode, type SanityCheckValidationResult, executeModelSanityCheck, getAiModelDescriptor, isAuthenticApiKey, DEFAULT_AI_MODEL_ID } from '@/features/ai-copilot/providers';
import {
  getActiveSsoSession,
  issueSsoSessionCookie,
  revokeSsoSessionCookie,
  type SsoIdentityProvider,
  type SsoSessionPayload,
} from '@/features/auth/sso';
import {
  executeContextualFinancialAssistant,
  type AssistantStructuredResponse,
} from '@/features/ai-copilot/assistant';

export async function authenticateSsoAction(idpProvider: SsoIdentityProvider = 'ENTERPRISE_OIDC'): Promise<{
  ok: boolean;
  session: SsoSessionPayload;
  tokenPreview: string;
}> {
  const user = await requireAuthenticatedUser();
  const { token, session } = await issueSsoSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
    idpProvider,
  });

  revalidatePath('/');
  return {
    ok: true,
    session,
    tokenPreview: `${token.slice(0, 18)}...${token.slice(-10)}`,
  };
}

/**
 * Camada SSO: Revogar Sessão Single Sign-On (bloqueando imediatamente qualquer chamada aos LLMs).
 */
export async function revokeSsoAction(): Promise<{ ok: boolean }> {
  await revokeSsoSessionCookie();
  revalidatePath('/');
  return { ok: true };
}

/**
 * Seletor de Modelos via Input HEADER + Sanity Check ("Qual é o seu modelo?").
 * 1. Verifica a credencial real ativa antes de liberar a requisição.
 * 2. Injeção dinâmica de credenciais e rota para o modelo selecionado.
 * 3. Disparo interno da pergunta "Qual é o seu modelo?" e validação de identidade.
 */
export async function selectHeaderAiModelAndRunSanityCheckAction(modelId: string): Promise<{
  ok: boolean;
  ssoAuthenticated: boolean;
  sanityCheck?: SanityCheckValidationResult;
  error?: string;
}> {
  const user = await requireAuthenticatedUser();
  const ssoState = await getActiveSsoSession();
  const descriptor = getAiModelDescriptor(modelId);

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      aiProvider: descriptor.provider,
      openaiModel: descriptor.provider === 'OPENAI' ? descriptor.id : DEFAULT_AI_MODEL_ID,
      geminiModel: descriptor.provider === 'GEMINI' ? descriptor.id : 'gemini-2.0-flash',
      claudeModel:
        descriptor.provider === 'CLAUDE' ? descriptor.id : 'claude-3-5-sonnet-latest',
    },
    update: {
      aiProvider: descriptor.provider,
      ...(descriptor.provider === 'OPENAI' && { openaiModel: descriptor.id }),
      ...(descriptor.provider === 'GEMINI' && { geminiModel: descriptor.id }),
      ...(descriptor.provider === 'CLAUDE' && { claudeModel: descriptor.id }),
    },
  });

  const sanityCheck = await executeModelSanityCheck({
    modelId: descriptor.id,
    ssoToken: ssoState.token || '',
    userKeys: {
      openaiApiKey: user.settings?.openaiApiKey,
      geminiApiKey: user.settings?.geminiApiKey,
      claudeApiKey: user.settings?.claudeApiKey,
    },
  });

  revalidatePath('/');
  return {
    ok: sanityCheck.passed,
    ssoAuthenticated: sanityCheck.passed,
    sanityCheck,
    error: sanityCheck.error || undefined,
  };
}

/**
 * RF-27: Salvar configurações de conexão com IA no banco (protegendo chaves salvas contra sobrescrita por máscaras).
 */
export async function updateAiSettingsAction(data: {
  aiProvider: AiProviderId;
  aiConnectionMode: AiConnectionMode;
  openaiApiKey?: string;
  geminiApiKey?: string;
  claudeApiKey?: string;
  openaiModel?: string;
  geminiModel?: string;
  claudeModel?: string;
}) {
  const user = await requireAuthenticatedUser();

  const resolveKeyUpdate = (incoming: string | undefined, existing: string | null | undefined) => {
    if (incoming === undefined) return existing ? encryptSecret(existing) : null;
    const trimmed = incoming.trim();
    if (trimmed === '') return null;
    if (isAuthenticApiKey(trimmed)) return encryptSecret(trimmed);
    // Se veio mascarada (ex: "sk-proj...1234"), preserva a chave existente no banco
    return existing ? encryptSecret(existing) : null;
  };

  const nextOpenaiKey = resolveKeyUpdate(data.openaiApiKey, user.settings?.openaiApiKey);
  const nextGeminiKey = resolveKeyUpdate(data.geminiApiKey, user.settings?.geminiApiKey);
  const nextClaudeKey = resolveKeyUpdate(data.claudeApiKey, user.settings?.claudeApiKey);

  const updated = await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      aiProvider: data.aiProvider,
      aiConnectionMode: data.aiConnectionMode,
      openaiApiKey: nextOpenaiKey,
      geminiApiKey: nextGeminiKey,
      claudeApiKey: nextClaudeKey,
      openaiModel: getAiModelDescriptor(data.openaiModel || 'gpt-4o-mini').id,
      geminiModel: getAiModelDescriptor(data.geminiModel || 'gemini-2.0-flash').id,
      claudeModel: getAiModelDescriptor(data.claudeModel || 'claude-3-5-sonnet-latest').id,
    },
    update: {
      aiProvider: data.aiProvider,
      aiConnectionMode: data.aiConnectionMode,
      openaiApiKey: nextOpenaiKey,
      geminiApiKey: nextGeminiKey,
      claudeApiKey: nextClaudeKey,
      ...(data.openaiModel && { openaiModel: getAiModelDescriptor(data.openaiModel).id }),
      ...(data.geminiModel && { geminiModel: getAiModelDescriptor(data.geminiModel).id }),
      ...(data.claudeModel && { claudeModel: getAiModelDescriptor(data.claudeModel).id }),
    },
  });

  revalidatePath('/');
  return { ok: true, settings: updated };
}

/**
 * RF-28: Analisa um extrato financeiro (via API Oficial quando em API_QUOTA ou via Parser Local Determinístico quando em SUBSCRIPTION).
 * Nunca substitui silenciosamente uma falha de API por resultado local fingindo ser IA.
 */

/**
 * Seção 10: Action do Assistente Financeiro Contextualizado (RAG + Cálculos Determinísticos).
 */
export async function askFinancialAssistantAction(data: {
  question: string;
  month?: number;
  year?: number;
  requireLiveLlm?: boolean;
}): Promise<{
  ok: boolean;
  response?: AssistantStructuredResponse;
  error?: string;
}> {
  try {
    const user = await requireAuthenticatedUser();
    if (!data.question || !data.question.trim()) {
      return {
        ok: false,
        error: 'Digite uma pergunta financeira para consultar o assistente.',
      };
    }

    const response = await executeContextualFinancialAssistant({
      userId: user.id,
      question: data.question.trim(),
      referenceMonth: data.month,
      referenceYear: data.year,
      requireLiveLlm: data.requireLiveLlm,
    });

    return {
      ok: true,
      response,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Erro ao processar consulta no assistente financeiro.',
    };
  }
}
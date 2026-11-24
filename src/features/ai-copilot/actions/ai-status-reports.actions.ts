'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/lib/prisma';
import { requireAuthenticatedUser } from '@/features/auth';
import { type AiProviderId, type AiConnectionMode, type AiFinancialStatusAnalysis, buildSubscriptionStatusPrompt, callProviderApiJson, extractJsonFromAiResponse, generateSmartFinancialStatusAnalysis, getAiModelDescriptor, isAuthenticApiKey } from '@/features/ai-copilot/providers';
import { getActiveSsoSession } from '@/features/auth/sso';

export async function runAiFinancialStatusAnalysisAction(data: {
  pastedSubscriptionResponse?: string;
  allowLocalFallback?: boolean;
  context: {
    consolidatedBalanceInCents: number;
    staticIncomeInCents: number;
    staticExpenseInCents: number;
    freeIncomeInCents: number;
    monthIncomeInCents: number;
    monthExpenseInCents: number;
    championCategoryName: string;
    championCategoryAmountInCents: number;
    portfolioGoalTitle?: string;
    portfolioGoalTargetInCents?: number;
    portfolioGoalCurrentInCents?: number;
    portfolioGoalRemainingInCents?: number;
    portfolioGoalRecommendedMonthlyInCents?: number;
    momDiffInCents: number;
    momVariationPercent: number;
  };
}): Promise<{
  ok: boolean;
  report?: {
    id: string;
    provider: string;
    connectionMode: string;
    healthScore: number;
    summary: string;
  };
  error?: string;
}> {
  const user = await requireAuthenticatedUser();
  const ssoState = await getActiveSsoSession();
  const provider = (user.settings?.aiProvider || 'OPENAI') as AiProviderId;
  const mode = (user.settings?.aiConnectionMode || 'SUBSCRIPTION') as AiConnectionMode;

  let analysis: AiFinancialStatusAnalysis | null = null;
  let usedMode: string = mode;
  let usedProvider: string = provider;

  // 1. Se o usuário colou o JSON vindo da assinatura web
  if (data.pastedSubscriptionResponse?.trim()) {
    const parsed = extractJsonFromAiResponse<AiFinancialStatusAnalysis>(
      data.pastedSubscriptionResponse
    );
    if (!parsed || !parsed.summary) {
      return {
        ok: false,
        error: 'O texto colado não é um bloco JSON válido com o diagnóstico financeiro.',
      };
    }
    analysis = {
      healthScore: Number(parsed.healthScore) || 80,
      summary: String(parsed.summary),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
      actionPlan: Array.isArray(parsed.actionPlan) ? parsed.actionPlan.map(String) : [],
    };
    usedMode = 'SUBSCRIPTION_BRIDGE';
    usedProvider = provider;
  }

  // 2. Se está em modo API_QUOTA, executa chamada real ao provedor e modelo selecionados
  if (!analysis && mode === 'API_QUOTA') {
    const rawKey =
      provider === 'OPENAI'
        ? user.settings?.openaiApiKey || process.env.OPENAI_API_KEY
        : provider === 'GEMINI'
        ? user.settings?.geminiApiKey || process.env.GEMINI_API_KEY
        : user.settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY;

    const modelId =
      provider === 'OPENAI'
        ? user.settings?.openaiModel || 'gpt-4o-mini'
        : provider === 'GEMINI'
        ? user.settings?.geminiModel || 'gemini-2.0-flash'
        : user.settings?.claudeModel || 'claude-3-5-sonnet-latest';
    const descriptor = getAiModelDescriptor(modelId);

    if (!isAuthenticApiKey(rawKey)) {
      if (!data.allowLocalFallback) {
        return {
          ok: false,
          error: `Modo API Oficial selecionado, mas nenhuma chave (${descriptor.envVarName}) está configurada para ${descriptor.providerGroupLabel}. Configure sua chave ou mude para o Modo Local / Assinatura.`,
        };
      }
    } else {
      try {
        const prompt = buildSubscriptionStatusPrompt(data.context);
        const rawJson = await callProviderApiJson({
          provider,
          apiKey: rawKey!.trim(),
          model: descriptor.id,
          prompt,
          ssoToken: ssoState.token || undefined,
        });
        const parsed = extractJsonFromAiResponse<AiFinancialStatusAnalysis>(rawJson);
        if (parsed && parsed.summary) {
          analysis = {
            healthScore: Number(parsed.healthScore) || 80,
            summary: String(parsed.summary),
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
            risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
            actionPlan: Array.isArray(parsed.actionPlan) ? parsed.actionPlan.map(String) : [],
          };
          usedMode = 'API_QUOTA';
          usedProvider = provider;
        }
      } catch (err) {
        if (!data.allowLocalFallback) {
          return {
            ok: false,
            error:
              err instanceof Error
                ? `Falha na chamada real à API (${descriptor.displayName}): ${err.message}`
                : 'Erro ao consultar o provedor de IA.',
          };
        }
      }
    }
  }

  // 3. Se estiver no modo local/assinatura sem JSON colado (ou com fallback explícito), usa o motor determinístico rotulado como SMART_LOCAL
  if (!analysis) {
    analysis = generateSmartFinancialStatusAnalysis(data.context);
    usedMode = 'SMART_LOCAL';
    usedProvider = 'MOTOR_DETERMINISTICO';
  }

  const savedReport = await prisma.aiAnalysisReport.create({
    data: {
      userId: user.id,
      provider: usedProvider,
      connectionMode: usedMode,
      healthScore: analysis.healthScore,
      summary: analysis.summary,
      strengthsJson: JSON.stringify(analysis.strengths),
      risksJson: JSON.stringify(analysis.risks),
      actionPlanJson: JSON.stringify(analysis.actionPlan),
    },
  });

  revalidatePath('/');
  return { ok: true, report: savedReport };
}

export async function deleteAiReportAction(id: string) {
  const user = await requireAuthenticatedUser();
  await prisma.aiAnalysisReport.deleteMany({
    where: { id, userId: user.id },
  });
  revalidatePath('/');
  return { ok: true };
}

/**
 * Reset Total do Sistema com Dupla Confirmação (valida o nome do usuário autenticado).
 * Apaga todas as transações, contas, cartões, faturas, metas, orçamentos, regras fixas, relatórios e chunks RAG
 * exclusivamente do usuário autenticado (`userId: user.id`).
 */
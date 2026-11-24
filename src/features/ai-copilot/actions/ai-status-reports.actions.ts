'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/lib/prisma';
import { requireAuthenticatedUser } from '@/features/auth';
import {
  type AiFinancialStatusAnalysis,
  buildSubscriptionStatusPrompt,
  callProviderApiJson,
  extractJsonFromAiResponse,
  generateSmartFinancialStatusAnalysis,
  getAiModelDescriptor,
} from '@/features/ai-copilot/providers';
import { resolveActiveUserAiSelection } from '@/features/ai-copilot/services/ai-credentials-service';

export async function runAiFinancialStatusAnalysisAction(data: {
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
  const ai = await resolveActiveUserAiSelection(user.id);

  let analysis: AiFinancialStatusAnalysis | null = null;
  let usedMode = 'API_KEY';
  let usedProvider: string = ai.provider;

  if (ai.hasKey && ai.modelId) {
    const descriptor = getAiModelDescriptor(ai.modelId, ai.provider);
    try {
      const prompt = buildSubscriptionStatusPrompt(data.context);
      const rawJson = await callProviderApiJson({
        provider: ai.provider,
        apiKey: ai.apiKey,
        model: descriptor.id,
        prompt,
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
        usedMode = 'API_KEY';
        usedProvider = `${ai.provider} (${descriptor.id})`;
      } else if (!data.allowLocalFallback) {
        return {
          ok: false,
          error: `A resposta de ${descriptor.displayName} não veio no formato JSON esperado.`,
        };
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
  } else if (!data.allowLocalFallback) {
    return {
      ok: false,
      error: !ai.hasKey
        ? 'Nenhuma chave de API configurada para o provedor ativo. Cadastre uma chave na Central de IA ou ative o motor determinístico local.'
        : 'Selecione um modelo de IA válido na Central de IA antes de gerar o diagnóstico com IA.',
    };
  }

  if (!analysis) {
    analysis = generateSmartFinancialStatusAnalysis(data.context);
    usedMode = 'SMART_LOCAL';
    usedProvider = 'MOTOR_DETERMINISTICO';
  }

  try {
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
  } catch (err) {
    console.error('[runAiFinancialStatusAnalysisAction]', err);
    return { ok: false, error: 'Não foi possível salvar o diagnóstico financeiro.' };
  }
}

export async function deleteAiReportAction(id: string) {
  try {
    const user = await requireAuthenticatedUser();
    await prisma.aiAnalysisReport.deleteMany({
      where: { id, userId: user.id },
    });
    revalidatePath('/');
    return { ok: true };
  } catch (err) {
    console.error('[deleteAiReportAction]', err);
    return { ok: false, error: 'Não foi possível excluir o relatório.' };
  }
}

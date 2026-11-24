import { formatCentsToBRL } from "@/shared/lib/currency";
import { type AiFinancialStatusAnalysis } from "@/features/ai-copilot/providers/copilot-types-and-prompts";

/**
 * Motor Analítico Determinístico Local para Diagnóstico de Carteira.
 * Quando utilizado sem chamada de API, o relatório salvo recebe connectionMode = 'SMART_LOCAL'
 * para transparência total com o usuário (nunca simulando ter vindo de um LLM externo).
 */
export function generateSmartFinancialStatusAnalysis(context: {
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
}): AiFinancialStatusAnalysis {
  const commitmentRatio =
    context.staticIncomeInCents > 0
      ? (context.staticExpenseInCents / context.staticIncomeInCents) * 100
      : 0;

  const savingsRate =
    context.monthIncomeInCents > 0
      ? ((context.monthIncomeInCents - context.monthExpenseInCents) /
          context.monthIncomeInCents) *
        100
      : 0;

  let score = 75;
  if (commitmentRatio <= 50) score += 10;
  else if (commitmentRatio > 80) score -= 20;

  if (savingsRate >= 20) score += 10;
  else if (savingsRate < 0) score -= 25;

  if (context.momDiffInCents <= 0) score += 5;
  score = Math.min(100, Math.max(15, Math.round(score)));

  const summary = `Seu patrimônio líquido dinâmico atual é de ${formatCentsToBRL(
    context.consolidatedBalanceInCents
  )}, com uma Renda Livre Estática de ${formatCentsToBRL(
    context.freeIncomeInCents
  )} após cobrir seus custos fixos (${commitmentRatio.toFixed(1)}% da renda garantida). ${
    context.portfolioGoalTitle
      ? `Para atingir sua "${context.portfolioGoalTitle}" de ${formatCentsToBRL(
          context.portfolioGoalTargetInCents || 0
        )}, faltam exatamente ${formatCentsToBRL(
          context.portfolioGoalRemainingInCents || 0
        )}.`
      : ''
  }`;

  const strengths: string[] = [];
  const risks: string[] = [];
  const actionPlan: string[] = [];

  if (context.freeIncomeInCents > 0) {
    strengths.push(
      `Margem Estática Positiva: Você possui ${formatCentsToBRL(
        context.freeIncomeInCents
      )} de renda livre após cobrir custos estáticos.`
    );
  } else if (context.staticExpenseInCents > 0) {
    risks.push(
      `Alerta Crítico: Seus custos estáticos (${formatCentsToBRL(
        context.staticExpenseInCents
      )}) estão consumindo 100%+ dos seus ganhos fixos.`
    );
  }

  if (savingsRate >= 15) {
    strengths.push(
      `Boa Capacidade de Poupança: Retenção de ${savingsRate.toFixed(1)}% das entradas no mês.`
    );
  } else if (context.monthIncomeInCents > 0 || context.monthExpenseInCents > 0) {
    risks.push(
      `Taxa de retenção mensal baixa (${savingsRate.toFixed(1)}%): Gastos variáveis estão comprimindo a sobra de caixa.`
    );
  }

  if (context.momDiffInCents > 0) {
    risks.push(
      `Aumento no Comparativo Mensal: Gastos subiram ${formatCentsToBRL(
        context.momDiffInCents
      )} (+${context.momVariationPercent.toFixed(1)}%).`
    );
  } else if (context.momDiffInCents < 0) {
    strengths.push(
      `Redução de Gastos MoM: Economia de ${formatCentsToBRL(
        Math.abs(context.momDiffInCents)
      )} (${context.momVariationPercent.toFixed(1)}%).`
    );
  }

  if (context.championCategoryAmountInCents > 0) {
    risks.push(
      `Concentração de Saídas: "${context.championCategoryName}" somou ${formatCentsToBRL(
        context.championCategoryAmountInCents
      )}.`
    );
    actionPlan.push(
      `Otimizar 15% na categoria "${context.championCategoryName}" (${formatCentsToBRL(
        Math.round(context.championCategoryAmountInCents * 0.15)
      )}/mês).`
    );
  }

  if (context.portfolioGoalTitle && (context.portfolioGoalRemainingInCents || 0) > 0) {
    actionPlan.push(
      `Direcionar aporte de ${formatCentsToBRL(
        context.portfolioGoalRecommendedMonthlyInCents || 0
      )}/mês para a meta "${context.portfolioGoalTitle}".`
    );
  }

  if (actionPlan.length === 0) {
    actionPlan.push(
      'Cadastre suas contas, metas e movimentações dinâmicas para alimentar o motor analítico.'
    );
  }

  return {
    healthScore: score,
    summary,
    strengths:
      strengths.length > 0
        ? strengths
        : ['Estrutura limpa e pronta para receber seus dados dinâmicos.'],
    risks:
      risks.length > 0
        ? risks
        : ['Nenhum risco detectado no conjunto de dados atual.'],
    actionPlan,
  };
}

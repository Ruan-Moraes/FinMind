import { formatCentsToBRL, formatPercent, MONTH_NAMES_PT } from '@/shared/lib/currency';
import {
  getMonthSummary,
  getMoMComparison,
  getStaticBaselineSummary,
  getPortfolioGoalsProgress,
  getSixMonthsHistory,
} from '@/features/analytics';
import { type RetrievedKnowledgeChunk } from '@/features/ai-copilot/rag';

export interface DeterministicSynthesisInput {
  question: string;
  refMonth: number;
  refYear: number;
  consolidatedBalanceInCents: number;
  netWorthInCents: number;
  monthSummary: Awaited<ReturnType<typeof getMonthSummary>>;
  momComparison: Awaited<ReturnType<typeof getMoMComparison>>;
  staticBaseline: Awaited<ReturnType<typeof getStaticBaselineSummary>>;
  portfolioGoals: Awaited<ReturnType<typeof getPortfolioGoalsProgress>>;
  budgets: Array<{ categoryName: string; maxAmountInCents: number; spentInCents: number }>;
  recurrenceRules: Array<{
    description: string;
    type: string;
    amountInCents: number;
    dayOfMonth: number;
  }>;
  sixMonths: Awaited<ReturnType<typeof getSixMonthsHistory>>;
  retrievedChunks: RetrievedKnowledgeChunk[];
}

function buildHistoricalFacts(
  monthLabel: string,
  monthSummary: DeterministicSynthesisInput['monthSummary'],
  topTxChunks: RetrievedKnowledgeChunk[]
): string[] {
  const facts: string[] =
    topTxChunks.length > 0
      ? topTxChunks.map((ch) => `Registro recuperado: ${ch.title}`)
      : [
          `No período de ${monthLabel}, foram registradas receitas de ${formatCentsToBRL(
            monthSummary.totalIncomeInCents
          )} e despesas de ${formatCentsToBRL(monthSummary.totalExpenseInCents)}.`,
        ];

  if (monthSummary.topExpenseItem) {
    facts.push(
      `Maior despesa individual em ${monthLabel}: "${monthSummary.topExpenseItem.description}" no valor de ${formatCentsToBRL(
        monthSummary.topExpenseItem.amountInCents
      )} (${monthSummary.topExpenseItem.categoryName}).`
    );
  }
  return facts;
}

function buildCalculatedResults(
  monthLabel: string,
  params: DeterministicSynthesisInput
): string[] {
  const { consolidatedBalanceInCents, netWorthInCents, monthSummary, staticBaseline, momComparison } =
    params;
  return [
    `Saldo Consolidado nas Contas Ativas: ${formatCentsToBRL(consolidatedBalanceInCents)} (Patrimônio Líquido: ${formatCentsToBRL(netWorthInCents)}).`,
    `Balanço de ${monthLabel}: Receitas de ${formatCentsToBRL(monthSummary.totalIncomeInCents)} vs Despesas de ${formatCentsToBRL(monthSummary.totalExpenseInCents)} (Resultado líquido: ${formatCentsToBRL(monthSummary.netBalanceInCents)}).`,
    `Linha de Base Estática: Ganhos Fixos (${formatCentsToBRL(staticBaseline.staticIncomeInCents)}) - Custos Fixos (${formatCentsToBRL(staticBaseline.staticExpenseInCents)}) = Renda Livre Estática de ${formatCentsToBRL(staticBaseline.freeDiscretionaryIncomeInCents)} (${formatPercent(staticBaseline.commitmentPercent)} comprometido).`,
    `Comparativo entre Meses (${momComparison.monthA.label} → ${momComparison.monthB.label}): Variação nas despesas de ${momComparison.expenseDiffInCents > 0 ? '+' : ''}${formatCentsToBRL(momComparison.expenseDiffInCents)} (${formatPercent(momComparison.expenseVariationPercent)}).`,
  ];
}

function buildProjections(
  monthLabel: string,
  monthSummary: DeterministicSynthesisInput['monthSummary'],
  portfolioGoals: DeterministicSynthesisInput['portfolioGoals']
): string[] {
  if (portfolioGoals.length === 0) {
    const projectedAnnualSavings = Math.max(0, monthSummary.netBalanceInCents) * 12;
    return [
      `Estimativa de acumulação em 12 meses (assumindo manutenção do saldo líquido de ${monthLabel} de ${formatCentsToBRL(monthSummary.netBalanceInCents)}/mês, sem garantia de constância): ${formatCentsToBRL(projectedAnnualSavings)}.`,
    ];
  }

  return portfolioGoals.map((g) => {
    if (g.isAchieved) {
      return `Meta "${g.title}" (${formatCentsToBRL(g.targetAmountInCents)}): Já alcançada com base no patrimônio líquido atual (${formatCentsToBRL(g.currentNetWorthInCents)}).`;
    }
    if (g.estimatedMonthsToReach !== null) {
      return `Estimativa para a meta "${g.title}" (Alvo ${formatCentsToBRL(g.targetAmountInCents)} até ${g.targetMonth}/${g.targetYear}): mantido o ritmo médio estimado de ${formatCentsToBRL(g.currentMonthlyPaceInCents)}/mês, a projeção de alcance é de aproximadamente ${g.estimatedMonthsToReach} mês(es) (${g.estimatedCompletionMonth}/${g.estimatedCompletionYear}) — estimativa sujeita a variações mensais de caixa.`;
    }
    return `Estimativa para a meta "${g.title}": no ritmo atual (${formatCentsToBRL(g.currentMonthlyPaceInCents)}/mês), não há geração líquida positiva suficiente para projetar a data de alcance sem ajuste de gastos ou receitas.`;
  });
}

function buildRecommendations(
  monthLabel: string,
  params: DeterministicSynthesisInput
): string[] {
  const { monthSummary, budgets, portfolioGoals, staticBaseline } = params;
  const recs: string[] = [];

  if (monthSummary.championCategory) {
    const cut15 = Math.round(monthSummary.championCategory.amountInCents * 0.15);
    recs.push(
      `A categoria "${monthSummary.championCategory.name}" concentrou ${formatPercent(monthSummary.championCategory.sharePercent)} das despesas de ${monthLabel} (${formatCentsToBRL(monthSummary.championCategory.amountInCents)}). Uma redução de 15% liberaria ${formatCentsToBRL(cut15)}/mês.`
    );
  }

  for (const b of budgets) {
    const pct = b.maxAmountInCents > 0 ? (b.spentInCents / b.maxAmountInCents) * 100 : 0;
    if (pct >= 80) {
      recs.push(
        `Atenção ao orçamento de "${b.categoryName}": consumo atual em ${formatPercent(pct)} (${formatCentsToBRL(b.spentInCents)} de ${formatCentsToBRL(b.maxAmountInCents)}).`
      );
    }
  }

  if (portfolioGoals[0] && !portfolioGoals[0].isAchieved) {
    const g = portfolioGoals[0];
    recs.push(
      g.monthlyPaceGapInCents > 0
        ? `Para atingir a meta "${g.title}" dentro do prazo (${g.targetMonth}/${g.targetYear}), aumente sua economia mensal em +${formatCentsToBRL(g.monthlyPaceGapInCents)}/mês para alcançar o aporte recomendado de ${formatCentsToBRL(g.recommendedMonthlyContributionInCents)}/mês.`
        : `Reserve prioritariamente ${formatCentsToBRL(g.recommendedMonthlyContributionInCents)}/mês da sua Renda Livre Estática (${formatCentsToBRL(staticBaseline.freeDiscretionaryIncomeInCents)}) para manter a meta "${g.title}" em dia.`
    );
  }

  return recs.length > 0
    ? recs
    : ['Defina tetos de orçamento para as categorias de gasto variável a fim de proteger sua Renda Livre Estática.'];
}

function buildDirectAnswerByIntent(
  qNorm: string,
  monthLabel: string,
  params: DeterministicSynthesisInput,
  topTxChunks: RetrievedKnowledgeChunk[]
): string {
  const {
    consolidatedBalanceInCents,
    netWorthInCents,
    monthSummary,
    momComparison,
    staticBaseline,
    portfolioGoals,
    recurrenceRules,
  } = params;

  if (/\b(meta|objetivo|patrimonio|alcancar|falta|prazo)\b/.test(qNorm)) {
    const g = portfolioGoals[0];
    if (!g) {
      return `Você ainda não possui uma Meta de Carteira cadastrada, mas seu patrimônio líquido atual é de ${formatCentsToBRL(netWorthInCents)} e sua Renda Livre Estática mensal é de ${formatCentsToBRL(staticBaseline.freeDiscretionaryIncomeInCents)}.`;
    }
    return `Em relação à sua meta "${g.title}" (alvo de ${formatCentsToBRL(g.targetAmountInCents)} para ${MONTH_NAMES_PT[g.targetMonth - 1]}/${g.targetYear}), seu patrimônio líquido atual é de ${formatCentsToBRL(g.currentNetWorthInCents)} (${formatPercent(g.progressPercent)} concluído), faltando ${formatCentsToBRL(g.remainingDistanceInCents)}. O aporte mensal recomendado é de ${formatCentsToBRL(g.recommendedMonthlyContributionInCents)}/mês, frente ao seu ritmo calculado de ${formatCentsToBRL(g.currentMonthlyPaceInCents)}/mês.`;
  }

  if (/\b(recorrente|fixo|fixa|estatico|assinatura|aluguel|mensal)\b/.test(qNorm)) {
    const rulesSummary =
      recurrenceRules.length > 0
        ? recurrenceRules.map((r) => `${r.description} (${formatCentsToBRL(r.amountInCents)} no dia ${r.dayOfMonth})`).join(', ')
        : 'nenhuma regra fixa explícita cadastrada';
    return `Sua linha de base estática possui ${formatCentsToBRL(staticBaseline.staticIncomeInCents)} em ganhos fixos e ${formatCentsToBRL(staticBaseline.staticExpenseInCents)} em custos fixos (${formatPercent(staticBaseline.commitmentPercent)} de comprometimento), gerando uma Renda Livre Estática de ${formatCentsToBRL(staticBaseline.freeDiscretionaryIncomeInCents)}. Compromissos recorrentes mapeados: ${rulesSummary}.`;
  }

  if (/\b(compar|mudan|anterior|subiu|caiu|evolu|mom)\b/.test(qNorm)) {
    return `Comparando ${momComparison.monthA.label} (${formatCentsToBRL(momComparison.monthA.totalExpenseInCents)} em despesas) com ${momComparison.monthB.label} (${formatCentsToBRL(momComparison.monthB.totalExpenseInCents)} em despesas), houve uma variação de ${momComparison.expenseDiffInCents > 0 ? '+' : ''}${formatCentsToBRL(momComparison.expenseDiffInCents)} (${formatPercent(momComparison.expenseVariationPercent)}).`;
  }

  const matchedHighlight =
    topTxChunks.length > 0
      ? ` Os registros mais relevantes recuperados no seu histórico incluem: ${topTxChunks.slice(0, 3).map((c) => c.title).join('; ')}.`
      : '';
  const championSuffix = monthSummary.championCategory
    ? ` A categoria de maior gasto foi "${monthSummary.championCategory.name}" (${formatCentsToBRL(monthSummary.championCategory.amountInCents)}).`
    : '';

  return `Com base nos dados reais de ${monthLabel}, seu saldo consolidado em contas é ${formatCentsToBRL(consolidatedBalanceInCents)}, com receitas de ${formatCentsToBRL(monthSummary.totalIncomeInCents)} e despesas de ${formatCentsToBRL(monthSummary.totalExpenseInCents)} (saldo líquido mensal de ${formatCentsToBRL(monthSummary.netBalanceInCents)}).${championSuffix}${matchedHighlight}`;
}

export function buildDeterministicAssistantSynthesis(params: DeterministicSynthesisInput) {
  const qNorm = params.question
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const monthLabel = `${MONTH_NAMES_PT[params.refMonth - 1]}/${params.refYear}`;
  const topTxChunks = params.retrievedChunks
    .filter((c) => c.sourceType === 'TRANSACTION')
    .slice(0, 5);

  return {
    directAnswer: buildDirectAnswerByIntent(qNorm, monthLabel, params, topTxChunks),
    historicalFacts: buildHistoricalFacts(monthLabel, params.monthSummary, topTxChunks),
    calculatedResults: buildCalculatedResults(monthLabel, params),
    projectionsAndEstimates: buildProjections(monthLabel, params.monthSummary, params.portfolioGoals),
    personalizedRecommendations: buildRecommendations(monthLabel, params),
  };
}

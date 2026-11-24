import {
  type MonthSummaryData,
  type PortfolioGoalProgress,
  type StaticBaselineSummary,
} from '@/features/analytics';

export interface AssistantKpiCard {
  label: string;
  valueInCents: number;
  tone: 'neutral' | 'income' | 'expense' | 'indigo';
  hint?: string;
}

export interface AssistantChartDatum {
  name: string;
  valueInCents?: number;
  incomeInCents?: number;
  expenseInCents?: number;
  targetInCents?: number;
  percent?: number;
  color?: string;
}

export interface AssistantChartSpec {
  id: string;
  kind: 'kpi_strip' | 'donut' | 'bar_comparison' | 'progress_bars';
  title: string;
  subtitle?: string;
  kpis?: AssistantKpiCard[];
  data?: AssistantChartDatum[];
}

export function buildDynamicAssistantCharts(params: {
  question: string;
  netWorthInCents: number;
  monthSummary: MonthSummaryData;
  staticBaseline: StaticBaselineSummary;
  portfolioGoals: PortfolioGoalProgress[];
  sixMonths: Array<{ label: string; receitas: number; despesas: number; saldo: number }>;
}): AssistantChartSpec[] {
  const q = params.question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const charts: AssistantChartSpec[] = [];

  // 1. Sempre incluir KPIs reais resumidos do momento
  charts.push({
    id: 'kpi-overview',
    kind: 'kpi_strip',
    title: 'Resumo em Tempo Real',
    kpis: [
      { label: 'Patrimônio Líquido', valueInCents: params.netWorthInCents, tone: 'indigo' },
      { label: 'Receitas do Mês', valueInCents: params.monthSummary.totalIncomeInCents, tone: 'income' },
      { label: 'Despesas do Mês', valueInCents: params.monthSummary.totalExpenseInCents, tone: 'expense' },
      {
        label: 'Margem Fixa Livre',
        valueInCents: params.staticBaseline.freeDiscretionaryIncomeInCents,
        tone: params.staticBaseline.freeDiscretionaryIncomeInCents >= 0 ? 'income' : 'expense',
      },
    ],
  });

  const wantsCategories = /(gast|categori|economiz|onde|distribuic|pizza|donut|despes|maior|grafico)/.test(q);
  const wantsEvolution = /(evoluc|historic|meses|receit|compar|tendenc|fluxo|linha|barra|grafico)/.test(q);
  const wantsGoals = /(meta|objetiv|patrimoni|poup|alcanc|ritmo|quanto falta|carteira)/.test(q);
  const wantsStatic = /(estatic|fixo|fixa|compromiss|margem|orcament|renda livre)/.test(q);

  // 2. Donut de distribuição de gastos por categoria
  if (
    params.monthSummary.categoryBreakdown.length > 0 &&
    (wantsCategories || (!wantsEvolution && !wantsGoals && !wantsStatic))
  ) {
    charts.push({
      id: 'donut-categories',
      kind: 'donut',
      title: 'Gastos por Categoria no Mês',
      subtitle: 'Top categorias com maior impacto real no seu orçamento',
      data: params.monthSummary.categoryBreakdown.slice(0, 6).map((c) => ({
        name: c.name,
        valueInCents: c.amountInCents,
        percent: c.percent,
        color: c.color || '#6366f1',
      })),
    });
  }

  // 3. Barras de Evolução Receitas vs Despesas (últimos 6 meses)
  if (
    params.sixMonths.some((m) => m.receitas > 0 || m.despesas > 0) &&
    (wantsEvolution || (!wantsCategories && !wantsGoals && !wantsStatic))
  ) {
    charts.push({
      id: 'bar-evolution',
      kind: 'bar_comparison',
      title: 'Evolução: Receitas vs Despesas (6 meses)',
      subtitle: 'Comparativo mensal direto do seu histórico',
      data: params.sixMonths.map((m) => ({
        name: m.label,
        incomeInCents: Math.round(m.receitas * 100),
        expenseInCents: Math.round(m.despesas * 100),
      })),
    });
  }

  // 4. Barras de Progresso das Metas de Carteira
  if (params.portfolioGoals.length > 0 && (wantsGoals || charts.length < 2)) {
    charts.push({
      id: 'progress-goals',
      kind: 'progress_bars',
      title: 'Progresso das Suas Metas',
      subtitle: 'Quanto você já acumulou frente ao alvo de cada meta',
      data: params.portfolioGoals.slice(0, 5).map((g) => ({
        name: g.title,
        valueInCents: g.currentNetWorthInCents,
        targetInCents: g.targetAmountInCents,
        percent: g.progressPercent,
        color: g.isAchieved ? '#10b981' : '#6366f1',
      })),
    });
  }

  // 5. Comparativo Fixo vs Variável
  if (
    wantsStatic &&
    (params.staticBaseline.staticIncomeInCents > 0 ||
      params.staticBaseline.staticExpenseInCents > 0)
  ) {
    const totalOut =
      params.staticBaseline.staticExpenseInCents + params.staticBaseline.variableExpenseInCents;
    const commitPct = Math.min(100, Math.max(0, params.staticBaseline.commitmentPercent));
    charts.push({
      id: 'progress-static',
      kind: 'progress_bars',
      title: 'Comprometimento da Renda Fixa',
      subtitle: 'Custos estáticos em relação aos seus ganhos estáticos',
      data: [
        {
          name: 'Custos Estáticos vs Ganhos Estáticos',
          valueInCents: params.staticBaseline.staticExpenseInCents,
          targetInCents: Math.max(1, params.staticBaseline.staticIncomeInCents),
          percent: commitPct,
          color: params.staticBaseline.isOverCommitted ? '#f43f5e' : '#10b981',
        },
        ...(totalOut > 0
          ? [
              {
                name: 'Gastos Variáveis no Total de Saídas',
                valueInCents: params.staticBaseline.variableExpenseInCents,
                targetInCents: totalOut,
                percent: (params.staticBaseline.variableExpenseInCents / totalOut) * 100,
                color: '#8b5cf6',
              },
            ]
          : []),
      ],
    });
  }

  return charts.slice(0, 3);
}

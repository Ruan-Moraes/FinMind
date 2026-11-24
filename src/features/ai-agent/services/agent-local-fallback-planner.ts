import { formatCentsToBRL } from '@/shared/lib/currency';
import {
  CHART_PALETTE,
  type DynamicContentBlock,
} from '@/features/ai-agent/domain/dynamic-content-schemas';
import {
  executeReadAnalyticsTool,
  type AnalyticsExecutionContext,
} from '@/features/ai-agent/tools/tool-executors-analytics';

function norm(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export interface LocalAnalyticalFallbackOutput {
  narrative: string;
  contentBlocks: DynamicContentBlock[];
  readToolsExecuted: string[];
}

export async function runLocalGroundedAnalyticsFallback(
  message: string,
  ctx: AnalyticsExecutionContext
): Promise<LocalAnalyticalFallbackOutput> {
  const q = norm(message);
  const readToolsExecuted: string[] = [];
  const blocks: DynamicContentBlock[] = [];

  const wantsPie = /\b(pizza|pie|setor|rosca|donut)\b/.test(q);
  const wantsLine = /\b(linha[s]?|tendenc|evoluc|proje[ct]|simula)\b/.test(q);
  const wantsTable = /\b(tabela|comparativo|compar[a-z]*)\b/.test(q);
  const wantsReport = /\b(relatorio|diagnostico|saude financeira)\b/.test(q);
  const wantsGoals = /\b(meta[s]?|objetivo[s]?|carteira)\b/.test(q);
  const wantsComparison = /\b(compar[a-z]*|ultimos meses|evoluc[a-z]*|meses|historico)\b/.test(q);
  const wantsForecast = /\b(previs|simula|proje[ct]|futuro|vou ganhar)\b/.test(q);

  if (wantsReport) {
    readToolsExecuted.push('generate_financial_report');
    const data = await executeReadAnalyticsTool('generate_financial_report', { scope: 'full' }, ctx);
    const health = data.healthReport as { healthScore: number; summary: string; strengths: string[]; risks: string[]; actionPlan: string[] };
    blocks.push(
      {
        id: 'local-report-kpis', kind: 'kpi_strip', title: `Indicadores Reais — ${String(data.period)}`,
        kpis: [
          { label: 'Patrimônio Líquido', valueInCents: Number(data.netWorthInCents || 0), tone: 'indigo' },
          { label: 'Receitas do Mês', valueInCents: Number(data.monthIncomeInCents || 0), tone: 'income' },
          { label: 'Despesas do Mês', valueInCents: Number(data.monthExpenseInCents || 0), tone: 'expense' },
          { label: 'Margem Fixa Livre', valueInCents: Number(data.freeIncomeInCents || 0), tone: Number(data.freeIncomeInCents || 0) >= 0 ? 'income' : 'expense' },
        ],
      },
      {
        id: 'local-report-card', kind: 'report_card', title: `Relatório Financeiro — ${String(data.period)}`, periodLabel: String(data.period),
        report: { healthScore: health.healthScore, summary: health.summary, strengths: health.strengths, risks: health.risks, projections: ['Projeções dependem da manutenção do ritmo mensal atual (sem garantia).'], actionPlan: health.actionPlan },
      }
    );
    return { narrative: `Gerei seu relatório financeiro real referente a **${String(data.period)}** (Score: **${health.healthScore}/100**). ${health.summary}`, contentBlocks: blocks, readToolsExecuted };
  }

  if (wantsGoals) {
    readToolsExecuted.push('query_portfolio_goals');
    const data = await executeReadAnalyticsTool('query_portfolio_goals', {}, ctx);
    const goals = (data.goals as Array<{ title: string; targetAmountInCents: number; currentNetWorthInCents: number; remainingDistanceInCents: number; progressPercent: number; targetMonth: number; targetYear: number }>) || [];
    if (goals.length === 0) {
      return { narrative: 'Você ainda não possui metas financeiras ativas cadastradas para montar o gráfico. Se desejar, posso ajudar você a cadastrar sua primeira meta agora mesmo.', contentBlocks: [], readToolsExecuted };
    }
    const totalTarget = Number(data.totalTargetInCents || 0);
    if (wantsPie) {
      const pieSlices =
        goals.length === 1
          ? [
              { name: `Acumulado (${goals[0].title})`, valueInCents: Math.max(0, Math.min(goals[0].currentNetWorthInCents, goals[0].targetAmountInCents)), percent: Math.min(100, Math.max(0, goals[0].progressPercent)), color: '#10b981' },
              { name: 'Restante até o alvo', valueInCents: Math.max(0, goals[0].remainingDistanceInCents), percent: Math.max(0, 100 - Math.min(100, goals[0].progressPercent)), color: '#6366f1' },
            ]
          : goals.map((g, idx) => ({ name: g.title, valueInCents: g.targetAmountInCents, percent: totalTarget > 0 ? Number(((g.targetAmountInCents / totalTarget) * 100).toFixed(1)) : 0, color: CHART_PALETTE[idx % CHART_PALETTE.length] }));
      blocks.push({
        id: 'goals-pie', kind: 'pie',
        title: goals.length === 1 ? `Progresso da Meta: ${goals[0].title}` : 'Distribuição das Metas Financeiras (Alvo)',
        subtitle: goals.length === 1 ? 'Proporção real entre valor já acumulado e saldo restante' : 'Participação real de cada meta sobre o alvo total da carteira',
        periodLabel: String(data.period), unit: 'BRL_CENTS', data: pieSlices,
      });
    }
    blocks.push({
      id: 'goals-progress', kind: 'progress_bars', title: 'Detalhamento do Progresso das Metas', periodLabel: String(data.period),
      data: goals.map((g, idx) => ({ name: `${g.title} (${g.targetMonth}/${g.targetYear})`, valueInCents: g.currentNetWorthInCents, targetInCents: g.targetAmountInCents, percent: g.progressPercent, color: CHART_PALETTE[idx % CHART_PALETTE.length] })),
    });
    const summaryList = goals.map((g) => `**${g.title}** (${g.progressPercent.toFixed(1)}% de ${formatCentsToBRL(g.targetAmountInCents)})`).join(', ');
    return { narrative: `Consultei suas **${goals.length}** meta(s) financeira(s) reais em **${String(data.period)}**: ${summaryList}.`, contentBlocks: blocks, readToolsExecuted };
  }

  if (wantsComparison) {
    readToolsExecuted.push('compare_financial_periods');
    const data = await executeReadAnalyticsTool('compare_financial_periods', { monthsCount: 6 }, ctx);
    const series = (data.monthlySeries as Array<{
      label: string;
      incomeInCents: number;
      expenseInCents: number;
      netBalanceInCents: number;
    }>) || [];
    const mom = data.momComparison as {
      monthA: { label: string; expenseInCents: number };
      monthB: { label: string; expenseInCents: number };
      expenseDiffInCents: number;
      expenseVariationPercent: number;
    };

    blocks.push({
      id: 'compare-chart',
      kind: wantsLine ? 'line' : 'bar',
      title: 'Comparativo Mensal: Receitas vs Despesas',
      subtitle: 'Valores reais consolidados dos últimos meses',
      unit: 'BRL_CENTS',
      series: [
        { key: 'receitas', label: 'Receitas', color: '#10b981' },
        { key: 'despesas', label: 'Despesas', color: '#f43f5e' },
      ],
      points: series.map((m) => ({
        name: m.label,
        values: { receitas: m.incomeInCents, despesas: m.expenseInCents },
      })),
    });

    if (wantsTable) {
      blocks.push({
        id: 'compare-table',
        kind: 'table',
        title: 'Tabela Comparativa por Mês',
        columns: [
          { key: 'mes', label: 'Mês', align: 'left', format: 'text' },
          { key: 'receitas', label: 'Receitas', align: 'right', format: 'currency_cents' },
          { key: 'despesas', label: 'Despesas', align: 'right', format: 'currency_cents' },
          { key: 'saldo', label: 'Saldo Líquido', align: 'right', format: 'currency_cents' },
        ],
        rows: series.map((m) => ({
          mes: m.label,
          receitas: m.incomeInCents,
          despesas: m.expenseInCents,
          saldo: m.netBalanceInCents,
        })),
      });
    }

    return {
      narrative: `Comparei seus últimos meses reais. Entre **${mom.monthA.label}** e **${mom.monthB.label}**, suas despesas variaram **${formatCentsToBRL(mom.expenseDiffInCents)}** (${mom.expenseVariationPercent >= 0 ? '+' : ''}${mom.expenseVariationPercent}%).`,
      contentBlocks: blocks,
      readToolsExecuted,
    };
  }

  if (wantsForecast) {
    readToolsExecuted.push('query_forecasts_and_simulations');
    const data = await executeReadAnalyticsTool('query_forecasts_and_simulations', { monthsAhead: 6 }, ctx);
    const traj = (data.simulatedMonthlyTrajectory as Array<{ monthOffset: number; estimatedNetWorthInCents: number }>) || [];
    blocks.push({
      id: 'forecast-line',
      kind: 'area',
      title: 'Simulação de Evolução Patrimonial (6 meses)',
      subtitle: 'Baseada na margem fixa livre atual — estimativa condicionada, sem garantia',
      isProjection: true,
      unit: 'BRL_CENTS',
      series: [{ key: 'patrimonio', label: 'Patrimônio Estimado', color: '#6366f1' }],
      points: traj.map((p) => ({ name: `+${p.monthOffset}m`, values: { patrimonio: p.estimatedNetWorthInCents } })),
    });
    return {
      narrative: `Com base no seu patrimônio líquido real de **${formatCentsToBRL(Number(data.currentNetWorthInCents || 0))}** e margem fixa mensal de **${formatCentsToBRL(Number(data.monthlyStaticFreeIncomeInCents || 0))}**, projetei uma estimativa para os próximos 6 meses.`,
      contentBlocks: blocks,
      readToolsExecuted,
    };
  }

  // Default: análise real de receitas, despesas e categorias do período selecionado
  readToolsExecuted.push('query_financial_overview');
  const overview = await executeReadAnalyticsTool('query_financial_overview', {}, ctx);
  const summary = overview.monthSummary as {
    totalIncomeInCents: number;
    totalExpenseInCents: number;
    netBalanceInCents: number;
    topCategories: Array<{ name: string; amountInCents: number; percent: number; color?: string }>;
  };
  const staticBase = overview.staticBaseline as { freeDiscretionaryIncomeInCents: number };

  blocks.push({
    id: 'overview-kpis',
    kind: 'kpi_strip',
    title: `Resumo Real — ${String(overview.period)}`,
    kpis: [
      { label: 'Patrimônio Líquido', valueInCents: Number(overview.netWorthInCents || 0), tone: 'indigo' },
      { label: 'Receitas do Mês', valueInCents: summary.totalIncomeInCents, tone: 'income' },
      { label: 'Despesas do Mês', valueInCents: summary.totalExpenseInCents, tone: 'expense' },
      { label: 'Margem Fixa Livre', valueInCents: staticBase.freeDiscretionaryIncomeInCents, tone: staticBase.freeDiscretionaryIncomeInCents >= 0 ? 'income' : 'expense' },
    ],
  });

  if (summary.topCategories.length > 0) {
    blocks.push({
      id: 'expenses-cat',
      kind: wantsPie ? 'pie' : 'donut',
      title: `Despesas por Categoria — ${String(overview.period)}`,
      periodLabel: String(overview.period),
      unit: 'BRL_CENTS',
      data: summary.topCategories.slice(0, 6).map((c, idx) => ({
        name: c.name,
        valueInCents: c.amountInCents,
        percent: c.percent,
        color: c.color || CHART_PALETTE[idx % CHART_PALETTE.length],
      })),
    });
  }

  const topCat = summary.topCategories[0];
  return {
    narrative: `Em **${String(overview.period)}**, suas receitas reais somam **${formatCentsToBRL(summary.totalIncomeInCents)}** e as despesas **${formatCentsToBRL(summary.totalExpenseInCents)}** (saldo líquido mensal de **${formatCentsToBRL(summary.netBalanceInCents)}**).${topCat ? ` A categoria de maior impacto foi **${topCat.name}** (${formatCentsToBRL(topCat.amountInCents)}).` : ''}`,
    contentBlocks: blocks,
    readToolsExecuted,
  };
}

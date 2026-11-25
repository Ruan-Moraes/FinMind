import { prisma } from '@/shared/lib/prisma';
import { MONTH_NAMES_PT } from '@/shared/lib/currency';
import { getMonthSummary } from '@/features/analytics';
import {
  queryBudgetsToolSchema,
  queryCategoriesToolSchema,
  queryInvoicesToolSchema,
  queryHealthReportsToolSchema,
  queryStaticRulesToolSchema,
} from '@/features/ai-agent/tools/tool-catalog-extended';
import type { AnalyticsExecutionContext } from '@/features/ai-agent/tools/tool-executors-analytics';
import {
  formatMonthKey,
  getRuleEffectiveAmountForMonth,
  hasRuleMonthOverride,
  isRuleSkippedInMonth,
} from '@/features/planning/domain/recurrence-month-skip';

function budgetStatus(percent: number): 'OK' | 'ATENCAO' | 'CRITICO' | 'ESTOURADO' {
  if (percent > 100) return 'ESTOURADO';
  if (percent >= 90) return 'CRITICO';
  if (percent >= 70) return 'ATENCAO';
  return 'OK';
}

export async function executeExtendedReadTool(
  toolName: string,
  rawArgs: Record<string, unknown>,
  ctx: AnalyticsExecutionContext
): Promise<Record<string, unknown>> {
  const { userId, selectedMonth, selectedYear, fiscalDay } = ctx;

  if (toolName === 'query_budgets') {
    const args = queryBudgetsToolSchema.parse(rawArgs);
    const month = args.month || selectedMonth;
    const year = args.year || selectedYear;
    const [budgets, summary] = await Promise.all([
      prisma.budget.findMany({ where: { userId, month, year }, include: { category: true } }),
      getMonthSummary(userId, month, year, fiscalDay),
    ]);
    const spentByCategory = new Map(summary.categoryBreakdown.map((c) => [c.categoryId, c.amountInCents]));
    return {
      period: `${MONTH_NAMES_PT[month - 1]}/${year}`,
      budgetsCount: budgets.length,
      budgets: budgets.map((b) => {
        const spent = spentByCategory.get(b.categoryId) ?? 0;
        const percent = b.maxAmountInCents > 0 ? Number(((spent / b.maxAmountInCents) * 100).toFixed(1)) : 0;
        return {
          category: b.category.name,
          limitInCents: b.maxAmountInCents,
          spentInCents: spent,
          remainingInCents: b.maxAmountInCents - spent,
          percentUsed: percent,
          status: budgetStatus(percent),
        };
      }),
      note: budgets.length === 0 ? 'Nenhum limite definido neste mês.' : undefined,
    };
  }

  if (toolName === 'query_static_rules') {
    const args = queryStaticRulesToolSchema.parse(rawArgs);
    const month = args.month || selectedMonth;
    const year = args.year || selectedYear;
    const rules = await prisma.recurrenceRule.findMany({ where: { userId }, include: { category: true, account: true, creditCard: true }, orderBy: { createdAt: 'asc' } });
    return {
      period: `${MONTH_NAMES_PT[month - 1]}/${year}`,
      monthKey: formatMonthKey(year, month),
      rules: rules.map((r) => ({
        description: r.description,
        type: r.type,
        baseAmountInCents: r.amountInCents,
        effectiveAmountInCents: getRuleEffectiveAmountForMonth(r, year, month),
        hasMonthOverride: hasRuleMonthOverride(r, year, month),
        skippedThisMonth: isRuleSkippedInMonth(r, year, month),
        dueDay: r.dayType === 'BUSINESS_DAY' ? `${r.dayOfMonth}º dia útil${r.includeSaturday ? ' (sábado conta)' : ''}` : `dia ${r.dayOfMonth}`,
        category: r.category?.name ?? null,
        account: r.account?.name ?? null,
        creditCard: r.creditCard?.name ?? null,
      })),
    };
  }

  if (toolName === 'query_credit_card_invoices') {
    const args = queryInvoicesToolSchema.parse(rawArgs);
    const cards = await prisma.creditCard.findMany({
      where: { userId, ...(args.cardName ? { name: { contains: args.cardName } } : {}) },
      include: { invoices: { include: { transactions: { select: { amountInCents: true } } }, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 12 } },
    });
    return {
      cards: cards.map((c) => ({
        name: c.name,
        limitInCents: c.limitInCents,
        closingDay: c.closingDay,
        dueDay: c.dueDay,
        invoices: c.invoices
          .map((i) => ({
            month: i.month,
            year: i.year,
            status: i.status,
            totalInCents: i.transactions.reduce((s, t) => s + t.amountInCents, 0),
            paidAmountInCents: i.paidAmountInCents,
            paidAt: i.paidAt ? i.paidAt.toISOString().slice(0, 10) : null,
            dueDate: `${year4(i.year, i.month, c.dueDay, c.closingDay)}`,
          }))
          .filter((i) => !args.onlyUnpaid || i.status !== 'PAID'),
      })),
    };
  }

  if (toolName === 'query_categories') {
    const args = queryCategoriesToolSchema.parse(rawArgs);
    const categories = await prisma.category.findMany({
      where: { userId, ...(args.type !== 'ALL' ? { type: args.type } : {}) },
      orderBy: { name: 'asc' },
    });
    return { count: categories.length, categories: categories.map((c) => ({ name: c.name, type: c.type, defaultNature: c.defaultNature })) };
  }

  if (toolName === 'query_health_reports') {
    const args = queryHealthReportsToolSchema.parse(rawArgs);
    const reports = await prisma.aiAnalysisReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: args.limit,
    });
    const parseList = (raw: string) => {
      try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v.map(String) : [];
      } catch {
        return [];
      }
    };
    return {
      totalReturned: reports.length,
      note: reports.length === 0 ? 'Nenhum diagnóstico salvo. O usuário gera um em Copiloto IA > Diagnóstico (Gerar Diagnóstico Agora).' : undefined,
      reports: reports.map((r) => ({
        createdAt: r.createdAt.toISOString(),
        healthScore: r.healthScore,
        band: r.healthScore >= 70 ? 'Saudável' : r.healthScore >= 40 ? 'Atenção' : 'Crítico',
        provider: r.provider,
        summary: r.summary,
        strengths: parseList(r.strengthsJson),
        risks: parseList(r.risksJson),
        actionPlan: parseList(r.actionPlanJson),
      })),
    };
  }

  throw new Error(`Ferramenta de leitura não suportada: ${toolName}`);
}

/** Data de vencimento da fatura: vence no mês seguinte ao do mês da fatura quando o vencimento é anterior ao fechamento. */
function year4(year: number, month: number, dueDay: number, closingDay: number): string {
  const crossesMonth = dueDay <= closingDay;
  const m = crossesMonth ? (month === 12 ? 1 : month + 1) : month;
  const y = crossesMonth && month === 12 ? year + 1 : year;
  return `${y}-${String(m).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
}

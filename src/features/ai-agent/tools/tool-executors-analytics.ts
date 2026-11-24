import { prisma } from '@/shared/lib/prisma';
import { decryptSecret } from '@/features/auth/domain/secret-crypto';
import { MONTH_NAMES_PT } from '@/shared/lib/currency';
import {
  getAccountsWithBalances,
  getCreditCardsWithSummary,
  getMonthDateRange,
  getMonthSummary,
  getMoMComparison,
  getPortfolioGoalsProgress,
  getSixMonthsHistory,
  getStaticBaselineSummary,
} from '@/features/analytics';
import {
  comparePeriodsToolSchema,
  queryExpensesToolSchema,
  queryGoalsToolSchema,
  queryOverviewToolSchema,
} from '@/features/ai-agent/tools/tool-catalog-analytics';
import {
  executeForecastsTool,
  executeGenerateReportTool,
  executeSearchHistoryTool,
} from '@/features/ai-agent/tools/tool-executors-analytics-extended';

export interface AnalyticsExecutionContext {
  userId: string;
  selectedMonth: number;
  selectedYear: number;
  fiscalDay: number;
  decryptedKeys: {
    openaiApiKey?: string | null;
    geminiApiKey?: string | null;
  };
}

export async function loadAnalyticsExecutionContext(
  userId: string,
  selectedMonth: number,
  selectedYear: number
): Promise<AnalyticsExecutionContext> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  return {
    userId,
    selectedMonth,
    selectedYear,
    fiscalDay: settings?.fiscalMonthStartDay || 1,
    decryptedKeys: {
      openaiApiKey: decryptSecret(settings?.openaiApiKey),
      geminiApiKey: decryptSecret(settings?.geminiApiKey),
    },
  };
}

export async function executeReadAnalyticsTool(
  toolName: string,
  rawArgs: Record<string, unknown>,
  ctx: AnalyticsExecutionContext
): Promise<Record<string, unknown>> {
  const { userId, selectedMonth, selectedYear, fiscalDay } = ctx;

  if (toolName === 'query_financial_overview') {
    const args = queryOverviewToolSchema.parse(rawArgs);
    const month = args.month || selectedMonth;
    const year = args.year || selectedYear;
    const [accounts, creditCards, monthSummary] = await Promise.all([
      getAccountsWithBalances(userId),
      getCreditCardsWithSummary(userId, month, year),
      getMonthSummary(userId, month, year, fiscalDay),
    ]);
    const staticBaseline = await getStaticBaselineSummary(userId, monthSummary);
    const activeAccounts = accounts.filter((a) => !a.isArchived);
    const consolidatedBalanceInCents = activeAccounts.reduce((s, a) => s + a.currentBalanceInCents, 0);
    const totalCardDebtInCents = creditCards.reduce((s, c) => s + c.usedLimitInCents, 0);
    return {
      period: `${MONTH_NAMES_PT[month - 1]}/${year}`,
      consolidatedBalanceInCents,
      totalCardDebtInCents,
      netWorthInCents: consolidatedBalanceInCents - totalCardDebtInCents,
      accounts: activeAccounts.map((a) => ({ name: a.name, type: a.type, balanceInCents: a.currentBalanceInCents })),
      creditCards: creditCards.map((c) => ({ name: c.name, limitInCents: c.limitInCents, usedLimitInCents: c.usedLimitInCents })),
      monthSummary: {
        totalIncomeInCents: monthSummary.totalIncomeInCents,
        totalExpenseInCents: monthSummary.totalExpenseInCents,
        netBalanceInCents: monthSummary.netBalanceInCents,
        staticIncomeInCents: monthSummary.staticIncomeInCents,
        variableIncomeInCents: monthSummary.variableIncomeInCents,
        staticExpenseInCents: monthSummary.staticExpenseInCents,
        variableExpenseInCents: monthSummary.variableExpenseInCents,
        topCategories: monthSummary.categoryBreakdown.slice(0, 8),
      },
      staticBaseline,
    };
  }

  if (toolName === 'query_portfolio_goals') {
    const args = queryGoalsToolSchema.parse(rawArgs);
    const month = args.month || selectedMonth;
    const year = args.year || selectedYear;
    const [accounts, creditCards] = await Promise.all([
      getAccountsWithBalances(userId),
      getCreditCardsWithSummary(userId, month, year),
    ]);
    const goals = await getPortfolioGoalsProgress(userId, accounts, creditCards, month, year);
    return {
      period: `${MONTH_NAMES_PT[month - 1]}/${year}`,
      goalsCount: goals.length,
      totalTargetInCents: goals.reduce((s, g) => s + g.targetAmountInCents, 0),
      totalRemainingInCents: goals.reduce((s, g) => s + g.remainingDistanceInCents, 0),
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        targetAmountInCents: g.targetAmountInCents,
        currentNetWorthInCents: g.currentNetWorthInCents,
        remainingDistanceInCents: g.remainingDistanceInCents,
        progressPercent: Number(g.progressPercent.toFixed(1)),
        targetMonth: g.targetMonth,
        targetYear: g.targetYear,
        monthsRemaining: g.monthsRemaining,
        recommendedMonthlyContributionInCents: g.recommendedMonthlyContributionInCents,
        currentMonthlyPaceInCents: g.currentMonthlyPaceInCents,
        paceStatus: g.paceStatus,
        isAchieved: g.isAchieved,
      })),
    };
  }

  if (toolName === 'query_expenses_and_transactions') {
    const args = queryExpensesToolSchema.parse(rawArgs);
    const month = args.month || selectedMonth;
    const year = args.year || selectedYear;
    const { start, end } = getMonthDateRange(month, year, fiscalDay);
    const [monthSummary, txs] = await Promise.all([
      getMonthSummary(userId, month, year, fiscalDay),
      prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: start, lte: end },
          ...(args.type !== 'ALL' ? { type: args.type } : {}),
          ...(args.nature !== 'ALL' ? { nature: args.nature } : {}),
        },
        include: { category: true, sourceAccount: true, creditCard: true },
        orderBy: [{ amountInCents: 'desc' }, { date: 'desc' }],
        take: 120,
      }),
    ]);
    const filtered = txs.filter((t) => {
      if (args.categoryName && !(t.category?.name || '').toLowerCase().includes(args.categoryName.toLowerCase())) return false;
      if (args.searchQuery && !t.description.toLowerCase().includes(args.searchQuery.toLowerCase())) return false;
      return true;
    });
    return {
      period: `${MONTH_NAMES_PT[month - 1]}/${year}`,
      filters: args,
      matchedCount: filtered.length,
      filteredTotalInCents: filtered.reduce((s, t) => s + t.amountInCents, 0),
      categoryBreakdown: monthSummary.categoryBreakdown.slice(0, 10),
      transactions: filtered.slice(0, args.limit).map((t) => ({
        date: t.date.toISOString().slice(0, 10),
        description: t.description,
        type: t.type,
        nature: t.nature,
        amountInCents: t.amountInCents,
        category: t.category?.name || 'Sem categoria',
        accountOrCard: t.creditCard?.name || t.sourceAccount?.name || 'Padrão',
      })),
    };
  }

  if (toolName === 'compare_financial_periods') {
    const args = comparePeriodsToolSchema.parse(rawArgs);
    const refMonth = args.referenceMonth || selectedMonth;
    const refYear = args.referenceYear || selectedYear;
    const mB = args.monthB || refMonth;
    const yB = args.yearB || refYear;
    const mA = args.monthA || (mB === 1 ? 12 : mB - 1);
    const yA = args.yearA || (mB === 1 ? yB - 1 : yB);
    const [mom, sixMonths] = await Promise.all([
      getMoMComparison(userId, mA, yA, mB, yB, fiscalDay),
      getSixMonthsHistory(userId, refMonth, refYear, fiscalDay),
    ]);
    return {
      momComparison: {
        monthA: { label: mom.monthA.label, incomeInCents: mom.monthA.totalIncomeInCents, expenseInCents: mom.monthA.totalExpenseInCents, netBalanceInCents: mom.monthA.netBalanceInCents },
        monthB: { label: mom.monthB.label, incomeInCents: mom.monthB.totalIncomeInCents, expenseInCents: mom.monthB.totalExpenseInCents, netBalanceInCents: mom.monthB.netBalanceInCents },
        incomeDiffInCents: mom.incomeDiffInCents,
        expenseDiffInCents: mom.expenseDiffInCents,
        expenseVariationPercent: Number(mom.expenseVariationPercent.toFixed(1)),
        categoryDeltas: mom.categoryDeltas.slice(0, 8),
      },
      monthlySeries: sixMonths.slice(-Math.min(args.monthsCount, sixMonths.length)).map((m) => ({
        label: m.label,
        incomeInCents: Math.round(m.receitas * 100),
        expenseInCents: Math.round(m.despesas * 100),
        netBalanceInCents: Math.round(m.saldo * 100),
      })),
    };
  }

  if (toolName === 'query_forecasts_and_simulations') return executeForecastsTool(rawArgs, ctx);
  if (toolName === 'search_financial_history') return executeSearchHistoryTool(rawArgs, ctx);
  if (toolName === 'generate_financial_report') return executeGenerateReportTool(rawArgs, ctx);
  throw new Error(`Ferramenta de leitura não suportada: ${toolName}`);
}

import { prisma } from '@/shared/lib/prisma';
import { MONTH_NAMES_PT } from '@/shared/lib/currency';
import {
  getAccountsWithBalances,
  getCreditCardsWithSummary,
  getMonthSummary,
  getMoMComparison,
  getPortfolioGoalsProgress,
  getStaticBaselineSummary,
} from '@/features/analytics';
import { retrieveFinancialContextForQuery } from '@/features/ai-copilot/rag';
import { generateSmartFinancialStatusAnalysis } from '@/features/ai-copilot/providers/local-financial-health';
import {
  generateReportToolSchema,
  queryForecastsToolSchema,
  searchHistoryToolSchema,
} from '@/features/ai-agent/tools/tool-catalog-analytics';
import type { AnalyticsExecutionContext } from '@/features/ai-agent/tools/tool-executors-analytics';

export async function executeForecastsTool(
  rawArgs: Record<string, unknown>,
  ctx: AnalyticsExecutionContext
): Promise<Record<string, unknown>> {
  const { userId, selectedMonth, selectedYear, fiscalDay } = ctx;
  const args = queryForecastsToolSchema.parse(rawArgs);
  const [items, targets, accounts, creditCards, monthSummary] = await Promise.all([
    prisma.valueForecastItem.findMany({ where: { userId }, orderBy: { expectedDate: 'asc' }, take: 30 }),
    prisma.balanceTargetCheck.findMany({ where: { userId }, orderBy: { targetDate: 'asc' }, take: 15 }),
    getAccountsWithBalances(userId),
    getCreditCardsWithSummary(userId, selectedMonth, selectedYear),
    getMonthSummary(userId, selectedMonth, selectedYear, fiscalDay),
  ]);
  const staticBaseline = await getStaticBaselineSummary(userId, monthSummary);
  const netWorthInCents =
    accounts.filter((a) => !a.isArchived).reduce((s, a) => s + a.currentBalanceInCents, 0) -
    creditCards.reduce((s, c) => s + c.usedLimitInCents, 0);
  return {
    isProjectionDisclaimer: 'Projeções condicionadas ao ritmo atual e eventos cadastrados, sem garantia.',
    currentNetWorthInCents: netWorthInCents,
    monthlyStaticFreeIncomeInCents: staticBaseline.freeDiscretionaryIncomeInCents,
    forecastItems: items.map((i) => ({
      title: i.title,
      type: i.type,
      amountInCents: i.amountInCents,
      expectedDate: i.expectedDate.toISOString().slice(0, 10),
    })),
    balanceTargets: targets.map((t) => ({
      title: t.title,
      plannedBalanceInCents: t.plannedBalanceInCents,
      targetDate: t.targetDate.toISOString().slice(0, 10),
    })),
    simulatedMonthlyTrajectory: Array.from({ length: args.monthsAhead }, (_, idx) => ({
      monthOffset: idx + 1,
      estimatedNetWorthInCents: netWorthInCents + staticBaseline.freeDiscretionaryIncomeInCents * (idx + 1),
    })),
  };
}

export async function executeSearchHistoryTool(
  rawArgs: Record<string, unknown>,
  ctx: AnalyticsExecutionContext
): Promise<Record<string, unknown>> {
  const args = searchHistoryToolSchema.parse(rawArgs);
  const rag = await retrieveFinancialContextForQuery({
    userId: ctx.userId,
    query: args.query,
    topK: args.topK,
    filterMonth: args.month,
    filterYear: args.year,
    userKeys: ctx.decryptedKeys,
  });
  return {
    totalIndexedChunks: rag.totalIndexedChunks,
    matches: rag.chunks.map((c) => ({
      sourceType: c.sourceType,
      title: c.title,
      referenceDate: c.referenceDate,
      amountInCents: c.amountInCents,
      score: Number(c.score.toFixed(2)),
      content: c.contentText.slice(0, 260),
    })),
  };
}

export async function executeGenerateReportTool(
  rawArgs: Record<string, unknown>,
  ctx: AnalyticsExecutionContext
): Promise<Record<string, unknown>> {
  const { userId, selectedMonth, selectedYear, fiscalDay } = ctx;
  const args = generateReportToolSchema.parse(rawArgs);
  const month = args.month || selectedMonth;
  const year = args.year || selectedYear;
  const prevM = month === 1 ? 12 : month - 1;
  const prevY = month === 1 ? year - 1 : year;
  const [accounts, creditCards, monthSummary, mom] = await Promise.all([
    getAccountsWithBalances(userId),
    getCreditCardsWithSummary(userId, month, year),
    getMonthSummary(userId, month, year, fiscalDay),
    getMoMComparison(userId, prevM, prevY, month, year, fiscalDay),
  ]);
  const [goals, staticBaseline] = await Promise.all([
    getPortfolioGoalsProgress(userId, accounts, creditCards, month, year),
    getStaticBaselineSummary(userId, monthSummary),
  ]);
  const consolidatedBalanceInCents = accounts
    .filter((a) => !a.isArchived)
    .reduce((s, a) => s + a.currentBalanceInCents, 0);
  const primaryGoal = goals[0];
  const health = generateSmartFinancialStatusAnalysis({
    consolidatedBalanceInCents,
    staticIncomeInCents: staticBaseline.staticIncomeInCents,
    staticExpenseInCents: staticBaseline.staticExpenseInCents,
    freeIncomeInCents: staticBaseline.freeDiscretionaryIncomeInCents,
    monthIncomeInCents: monthSummary.totalIncomeInCents,
    monthExpenseInCents: monthSummary.totalExpenseInCents,
    championCategoryName: monthSummary.championCategory?.name || 'Sem categoria',
    championCategoryAmountInCents: monthSummary.championCategory?.amountInCents || 0,
    portfolioGoalTitle: primaryGoal?.title,
    portfolioGoalTargetInCents: primaryGoal?.targetAmountInCents,
    portfolioGoalCurrentInCents: primaryGoal?.currentNetWorthInCents,
    portfolioGoalRemainingInCents: primaryGoal?.remainingDistanceInCents,
    portfolioGoalRecommendedMonthlyInCents: primaryGoal?.recommendedMonthlyContributionInCents,
    momDiffInCents: mom.expenseDiffInCents,
    momVariationPercent: mom.expenseVariationPercent,
  });
  return {
    scope: args.scope,
    period: `${MONTH_NAMES_PT[month - 1]}/${year}`,
    consolidatedBalanceInCents,
    netWorthInCents: consolidatedBalanceInCents - creditCards.reduce((s, c) => s + c.usedLimitInCents, 0),
    monthIncomeInCents: monthSummary.totalIncomeInCents,
    monthExpenseInCents: monthSummary.totalExpenseInCents,
    freeIncomeInCents: staticBaseline.freeDiscretionaryIncomeInCents,
    topCategories: monthSummary.categoryBreakdown.slice(0, 6),
    goalsCount: goals.length,
    goals: goals.slice(0, 5),
    healthReport: health,
  };
}

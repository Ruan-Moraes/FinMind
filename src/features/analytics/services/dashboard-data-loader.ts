import { logWarn } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { getAccountsWithBalances, getCreditCardsWithSummary, getPortfolioGoalsProgress, getMonthSummary, getStaticBaselineSummary, getMoMComparison, getSixMonthsHistory, getMonthDateRange } from '@/features/analytics';
import {
  parseMonthlyOverrides,
  parseSkippedMonths,
} from '@/features/planning/domain/recurrence-month-skip';
import { type ensurePersonalUserInitialized } from '@/features/auth';
import { buildAuthoritativeGlobalAiState } from '@/features/ai-copilot/services/ai-provider-state-service';
export async function loadSerializedDashboardData(params: {
  user: Awaited<ReturnType<typeof ensurePersonalUserInitialized>>;
  resolvedParams: { month?: string;
    year?: string;
    compMonthA?: string;
    compYearA?: string;
    compMonthB?: string;
    compYearB?: string;
  };
}) { const { user, resolvedParams } = params;
  const initialAiState = await buildAuthoritativeGlobalAiState(user.id, { validateLive: false });
  const fiscalMonthStartDay = user.settings?.fiscalMonthStartDay ?? 1;
  const now = new Date();
  const defaultMonth = now.getMonth() + 1;
  const defaultYear = now.getFullYear();
  const parseMonth = (raw: string | undefined, fallback: number) => {
    const n = Math.trunc(Number(raw));
    return Number.isFinite(n) && n >= 1 && n <= 12 ? n : fallback;
  };
  const parseYear = (raw: string | undefined, fallback: number) => {
    const n = Math.trunc(Number(raw));
    return Number.isFinite(n) && n >= 2000 && n <= 2100 ? n : fallback;
  };
  const selectedMonth = parseMonth(resolvedParams.month, defaultMonth);
  const selectedYear = parseYear(resolvedParams.year, defaultYear);
  const defaultPrevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
  const defaultPrevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
  const compareMonthA = parseMonth(resolvedParams.compMonthA, defaultPrevMonth);
  const compareYearA = parseYear(resolvedParams.compYearA, defaultPrevYear);
  const compareMonthB = parseMonth(resolvedParams.compMonthB, selectedMonth);
  const compareYearB = parseYear(resolvedParams.compYearB, selectedYear);
  const { start, end } = getMonthDateRange(selectedMonth, selectedYear, fiscalMonthStartDay);
  const [
    accounts, creditCards,
    categories, monthSummary,
    momComparison, sixMonthsHistory,
    rawBudgets, rawRules,
    rawTransactions, rawAiReports,
    rawImportBatches, ] = await Promise.all([
    getAccountsWithBalances(user.id), getCreditCardsWithSummary(user.id, selectedMonth, selectedYear),
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    }), getMonthSummary(user.id, selectedMonth, selectedYear, fiscalMonthStartDay),
    getMoMComparison(user.id, compareMonthA, compareYearA, compareMonthB, compareYearB, fiscalMonthStartDay),
    getSixMonthsHistory(user.id, selectedMonth, selectedYear, fiscalMonthStartDay),
    prisma.budget.findMany({
      where: {
        userId: user.id, month: selectedMonth,
        year: selectedYear, },
      include: { category: true },
    }),
    prisma.recurrenceRule.findMany({
      where: { userId: user.id, isActive: true },
      include: { category: true, account: true },
      orderBy: { dayOfMonth: 'asc' },
    }),
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        date: { gte: start, lte: end },
      },
      include: {
        sourceAccount: true, destinationAccount: true,
        creditCard: true, category: true,
        attachments: true, },
      orderBy: { date: 'desc' },
    }),
    prisma.aiAnalysisReport.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100, }),
    prisma.statementImportBatch.findMany({
      where: { userId: user.id },
      include: { files: true },
      orderBy: { createdAt: 'desc' },
      take: 100, }),
  ]);
  const [portfolioGoals, staticBaseline, rawForecastItems, rawBalanceTargets, rawHolidays] = await Promise.all([
    getPortfolioGoalsProgress(user.id, accounts, creditCards, selectedMonth, selectedYear),
    getStaticBaselineSummary(user.id, monthSummary),
    prisma.valueForecastItem.findMany({ where: { userId: user.id }, orderBy: [{ expectedDate: 'asc' }, { createdAt: 'desc' }] }),
    prisma.balanceTargetCheck.findMany({ where: { userId: user.id }, orderBy: [{ targetDate: 'asc' }, { createdAt: 'desc' }] }),
    prisma.holiday.findMany({ where: { userId: user.id }, orderBy: [{ date: 'asc' }, { name: 'asc' }] }),
  ]);
  const holidays = rawHolidays.map((h) => ({
    id: h.id, date: h.date, year: h.year, name: h.name, scope: h.scope,
    stateCode: h.stateCode, cityName: h.cityName, source: h.source, isActive: h.isActive,
  }));
  const valueForecastItems = rawForecastItems.map((item) => ({
    id: item.id,
    title: item.title,
    type: (item.type === 'INCOME' ? 'INCOME' : 'EXPENSE') as 'INCOME' | 'EXPENSE',
    amountInCents: item.amountInCents,
    expectedDate: item.expectedDate.toISOString(),
    notes: item.notes,
  }));
  const balanceTargetChecks = rawBalanceTargets.map((target) => ({
    id: target.id,
    title: target.title,
    plannedBalanceInCents: target.plannedBalanceInCents,
    targetDate: target.targetDate.toISOString(),
    notes: target.notes,
  }));
  const budgets = rawBudgets.map((b) => {
    const catSpent =
      monthSummary.categoryBreakdown.find((c) => c.categoryId === b.categoryId)
        ?.amountInCents || 0;
    const percent = b.maxAmountInCents > 0 ? (catSpent / b.maxAmountInCents) * 100 : 0;
    return {
      id: b.id, categoryId: b.categoryId,
      categoryName: b.category.name, categoryColor: b.category.color,
      categoryIcon: b.category.icon || 'Tag', maxAmountInCents: b.maxAmountInCents,
      spentInCents: catSpent, percent,
    };
  });
  const recurrenceRules = rawRules.map((r) => ({
    id: r.id, description: r.description,
    type: r.type, nature: r.nature,
    amountInCents: r.amountInCents, dayOfMonth: r.dayOfMonth,
    dayType: r.dayType, includeSaturday: r.includeSaturday,
    skippedMonths: parseSkippedMonths(r.skippedMonths),
    monthlyOverrides: parseMonthlyOverrides(r.monthlyOverrides),
    categoryId: r.categoryId || null, categoryName: r.category?.name || null,
    categoryColor: r.category?.color || null, categoryIcon: r.category?.icon || null,
    accountId: r.accountId || null, accountName: r.account?.name || null,
  }));
  const transactions = rawTransactions.map((tx) => ({
    id: tx.id, type: tx.type,
    nature: tx.nature, amountInCents: tx.amountInCents,
    date: tx.date.toISOString(), description: tx.description,
    status: tx.status, tags: tx.tags,
    sourceAccountId: tx.sourceAccountId, sourceAccountName: tx.sourceAccount?.name || null,
    destinationAccountId: tx.destinationAccountId,
    destinationAccountName: tx.destinationAccount?.name || null, creditCardId: tx.creditCardId,
    creditCardName: tx.creditCard?.name || null, categoryId: tx.categoryId,
    categoryName: tx.category?.name || null, categoryColor: tx.category?.color || null,
    categoryIcon: tx.category?.icon || null, installmentGroupId: tx.installmentGroupId,
    recurrenceRuleId: tx.recurrenceRuleId,
    installmentNumber: tx.installmentNumber, totalInstallments: tx.totalInstallments,
    importBatchId: tx.importBatchId, rawBankDescription: tx.rawBankDescription,
    financialAction: tx.financialAction, counterparty: tx.counterparty,
    paymentMethod: tx.paymentMethod, purpose: tx.purpose,
    aiConfidenceScore: tx.aiConfidenceScore, aiConfidenceLevel: tx.aiConfidenceLevel,
    isAiClassified: tx.isAiClassified, isUserConfirmed: tx.isUserConfirmed,
    attachments: tx.attachments.map((att) => ({
      id: att.id, fileName: att.fileName,
      mimeType: att.mimeType, sizeInBytes: att.sizeInBytes,
      fileDataUrl: att.fileDataUrl, })),
  }));
  const importBatches = rawImportBatches.map((b) => ({
    id: b.id, status: b.status,
    fileCount: b.fileCount, totalMovements: b.totalMovements,
    reconciledCount: b.reconciledCount, createdTransactionsCount: b.createdTransactionsCount,
    skippedDuplicatesCount: b.skippedDuplicatesCount, aiProvider: b.aiProvider,
    aiModelId: b.aiModelId, createdAt: b.createdAt.toISOString(),
    revertedAt: b.revertedAt ? b.revertedAt.toISOString() : null,
    files: b.files.map((f) => ({
      id: f.id, fileName: f.fileName,
      fileFormat: f.fileFormat, bankName: f.bankName,
      itemCount: f.itemCount, status: f.status,
    })), }));
  const aiReports = rawAiReports.map((rep) => { let strengths: string[] = [];
    let risks: string[] = [];
    let actionPlan: string[] = [];
    try { strengths = JSON.parse(rep.strengthsJson);
      risks = JSON.parse(rep.risksJson);
      actionPlan = JSON.parse(rep.actionPlanJson);
    } catch (err) {
      logWarn('DashboardDataLoader', 'Falha ao desserializar JSON de relatório IA', {
        reportId: rep.id,
        error: err,
      });
    }
    return {
      id: rep.id, provider: rep.provider,
      connectionMode: rep.connectionMode, healthScore: rep.healthScore,
      summary: rep.summary, strengths,
      risks, actionPlan,
      createdAt: rep.createdAt.toISOString(), };
  });
  return {
    user: { id: user.id, name: user.name, email: user.email },
    settings: {
          theme: user.settings?.theme || 'DARK', density: user.settings?.density || 'COMFORTABLE',
          hideValuesByDefault: user.settings?.hideValuesByDefault ?? false,
          fiscalMonthStartDay: user.settings?.fiscalMonthStartDay ?? 1,
          defaultAccountId: user.settings?.defaultAccountId ?? null,
          holidayState: user.settings?.holidayState ?? null,
          holidayCity: user.settings?.holidayCity ?? null, },
    initialAiState, aiReports,
    selectedMonth, selectedYear,
    compareMonthA, compareYearA,
    compareMonthB, compareYearB,
    accounts, creditCards,
    categories: categories.map((c) => ({
      id: c.id, name: c.name,
      type: c.type, defaultNature: c.defaultNature,
      color: c.color, icon: c.icon,
    })), portfolioGoals,
    staticBaseline, monthSummary,
    momComparison, sixMonthsHistory,
    budgets, recurrenceRules,
    transactions, importBatches,
    valueForecastItems, balanceTargetChecks, holidays,
  };
}
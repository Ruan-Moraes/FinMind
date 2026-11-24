import { AccountWithBalance, CreditCardWithSummary, MonthSummaryData, MoMComparisonReport, PortfolioGoalProgress, StaticBaselineSummary } from '@/features/analytics/domain/finance-types';
export function computeCurrentNetWorthAndPace(params: {
  accounts: AccountWithBalance[];
  cards: CreditCardWithSummary[];
  completedTransactions: Array<{ type: string; amountInCents: number; date: Date }>;
  staticRules: Array<{ type: string; amountInCents: number }>;
  referenceDate?: Date;
}): {
  currentNetWorthInCents: number;
  currentMonthlyPaceInCents: number;
  currentMonth: number;
  currentYear: number;
} {
  const totalAccountsBalance = params.accounts
    .filter((a) => !a.isArchived)
    .reduce((acc, a) => acc + a.currentBalanceInCents, 0);
  const unpaidCardDebt = params.cards.reduce((acc, c) => acc + c.usedLimitInCents, 0);
  const currentNetWorthInCents = totalAccountsBalance - unpaidCardDebt;
  const now = params.referenceDate || new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const staticInc = params.staticRules.filter((r) => r.type === 'INCOME').reduce((a, r) => a + r.amountInCents, 0);
  const staticExp = params.staticRules.filter((r) => r.type === 'EXPENSE').reduce((a, r) => a + r.amountInCents, 0);
  const monthlyNets = new Map<string, number>();
  const monthlyIncomes = new Map<string, number>();
  for (const tx of params.completedTransactions) {
    const key = `${tx.date.getFullYear()}-${tx.date.getMonth() + 1}`;
    const prev = monthlyNets.get(key) || 0;
    if (tx.type === 'INCOME') {
      monthlyNets.set(key, prev + tx.amountInCents);
      monthlyIncomes.set(key, (monthlyIncomes.get(key) || 0) + tx.amountInCents);
    } else if (tx.type === 'EXPENSE') {
      monthlyNets.set(key, prev - tx.amountInCents);
    }
  }
  let currentMonthlyPaceInCents = 0;
  if (params.staticRules.length > 0) {
    if (staticInc > 0) {
      currentMonthlyPaceInCents = staticInc - staticExp;
    } else if (monthlyIncomes.size > 0) {
      const incValues = Array.from(monthlyIncomes.values());
      const avgIncome = Math.round(incValues.reduce((a, b) => a + b, 0) / incValues.length);
      currentMonthlyPaceInCents = avgIncome - staticExp;
    } else {
      currentMonthlyPaceInCents = -staticExp;
    }
  } else if (monthlyNets.size > 0) {
    const currentKey = `${currentYear}-${currentMonth}`;
    const allValues = Array.from(monthlyNets.values());
    const avgNet = Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length);
    const currentMonthNet = monthlyNets.get(currentKey);
    currentMonthlyPaceInCents =
      currentMonthNet !== undefined ? Math.round((currentMonthNet + avgNet) / 2) : avgNet;
  }
  return {
    currentNetWorthInCents,
    currentMonthlyPaceInCents,
    currentMonth,
    currentYear,
  };
}
export function computeSingleGoalProjection(params: {
  goal: {
    id: string;
    title: string;
    targetAmountInCents: number;
    targetMonth: number;
    targetYear: number;
    notes?: string | null;
  };
  currentNetWorthInCents: number;
  currentMonthlyPaceInCents: number;
  currentMonth: number;
  currentYear: number;
}): PortfolioGoalProgress {
  const { goal, currentNetWorthInCents, currentMonthlyPaceInCents, currentMonth, currentYear } =
    params;
  const progressPercent =
    goal.targetAmountInCents > 0
      ? Math.min(100, Math.max(0, (currentNetWorthInCents / goal.targetAmountInCents) * 100))
      : 100;
  const remainingDistanceInCents = Math.max(0, goal.targetAmountInCents - currentNetWorthInCents);
  const isAchieved = currentNetWorthInCents >= goal.targetAmountInCents;
  const monthsDiff = (goal.targetYear - currentYear) * 12 + (goal.targetMonth - currentMonth);
  const monthsRemaining = Math.max(1, monthsDiff);
  const recommendedMonthlyContributionInCents = isAchieved
    ? 0
    : Math.ceil(remainingDistanceInCents / monthsRemaining);
  let estimatedMonthsToReach: number | null = null;
  let estimatedCompletionMonth: number | null = null;
  let estimatedCompletionYear: number | null = null;
  let willReachOnTime = false;
  let paceStatus: PortfolioGoalProgress['paceStatus'] = 'STALLED';
  if (isAchieved) {
    estimatedMonthsToReach = 0;
    estimatedCompletionMonth = currentMonth;
    estimatedCompletionYear = currentYear;
    willReachOnTime = true;
    paceStatus = 'ACHIEVED';
  } else if (currentMonthlyPaceInCents > 0) {
    estimatedMonthsToReach = Math.ceil(remainingDistanceInCents / currentMonthlyPaceInCents);
    let estM = currentMonth + estimatedMonthsToReach;
    let estY = currentYear;
    while (estM > 12) {
      estM -= 12;
      estY += 1;
    }
    estimatedCompletionMonth = estM;
    estimatedCompletionYear = estY;
    const targetTotalMonths = Math.max(0, monthsDiff);
    if (estimatedMonthsToReach < targetTotalMonths) {
      willReachOnTime = true;
      paceStatus = 'AHEAD';
    } else if (
      estimatedMonthsToReach === targetTotalMonths ||
      (targetTotalMonths === 0 && estimatedMonthsToReach <= 1)
    ) {
      willReachOnTime = true;
      paceStatus = 'ON_TRACK';
    } else {
      willReachOnTime = false;
      paceStatus = 'BEHIND';
    }
  } else {
    estimatedMonthsToReach = null;
    willReachOnTime = false;
    paceStatus = 'STALLED';
  }
  const monthlyPaceGapInCents = isAchieved
    ? 0
    : Math.max(0, recommendedMonthlyContributionInCents - Math.max(0, currentMonthlyPaceInCents));
  return {
    id: goal.id,
    title: goal.title,
    targetAmountInCents: goal.targetAmountInCents,
    currentNetWorthInCents,
    progressPercent,
    remainingDistanceInCents,
    isAchieved,
    targetMonth: goal.targetMonth,
    targetYear: goal.targetYear,
    monthsRemaining: Math.max(0, monthsDiff),
    recommendedMonthlyContributionInCents,
    currentMonthlyPaceInCents,
    estimatedMonthsToReach,
    estimatedCompletionMonth,
    estimatedCompletionYear,
    willReachOnTime,
    paceStatus,
    monthlyPaceGapInCents,
    notes: goal.notes,
  };
}
export function computeStaticBaselineMetrics(
  monthSummary: MonthSummaryData,
  rules: Array<{ type: string; amountInCents: number }>
): StaticBaselineSummary {
  const rulesStaticIncome = rules
    .filter((r) => r.type === 'INCOME')
    .reduce((acc, r) => acc + r.amountInCents, 0);
  const rulesStaticExpense = rules
    .filter((r) => r.type === 'EXPENSE')
    .reduce((acc, r) => acc + r.amountInCents, 0);
  const staticIncomeInCents = Math.max(monthSummary.staticIncomeInCents, rulesStaticIncome);
  const staticExpenseInCents = Math.max(monthSummary.staticExpenseInCents, rulesStaticExpense);
  const freeDiscretionaryIncomeInCents = staticIncomeInCents - staticExpenseInCents;
  const isOverCommitted = staticExpenseInCents > staticIncomeInCents && staticIncomeInCents > 0;
  const commitmentPercent =
    staticIncomeInCents > 0 ? (staticExpenseInCents / staticIncomeInCents) * 100 : 0;
  return {
    staticIncomeInCents,
    staticExpenseInCents,
    variableIncomeInCents: monthSummary.variableIncomeInCents,
    variableExpenseInCents: monthSummary.variableExpenseInCents,
    freeDiscretionaryIncomeInCents,
    isOverCommitted,
    commitmentPercent,
  };
}
export function computeMoMComparisonFromSummaries(
  summaryA: MonthSummaryData,
  summaryB: MonthSummaryData
): MoMComparisonReport {
  const expenseDiffInCents = summaryB.totalExpenseInCents - summaryA.totalExpenseInCents;
  const expenseVariationPercent =
    summaryA.totalExpenseInCents > 0
      ? ((summaryB.totalExpenseInCents - summaryA.totalExpenseInCents) /
          summaryA.totalExpenseInCents) *
        100
      : summaryB.totalExpenseInCents > 0
      ? 100
      : 0;
  const incomeDiffInCents = summaryB.totalIncomeInCents - summaryA.totalIncomeInCents;
  const incomeVariationPercent =
    summaryA.totalIncomeInCents > 0
      ? ((summaryB.totalIncomeInCents - summaryA.totalIncomeInCents) /
          summaryA.totalIncomeInCents) *
        100
      : summaryB.totalIncomeInCents > 0
      ? 100
      : 0;
  const allCatIds = new Set<string>();
  const catMeta = new Map<string, { name: string; color: string }>();
  for (const item of summaryA.categoryBreakdown) {
    allCatIds.add(item.categoryId);
    catMeta.set(item.categoryId, { name: item.name, color: item.color });
  }
  for (const item of summaryB.categoryBreakdown) {
    allCatIds.add(item.categoryId);
    catMeta.set(item.categoryId, { name: item.name, color: item.color });
  }
  const categoryDeltas = Array.from(allCatIds)
    .map((categoryId) => {
      const meta = catMeta.get(categoryId) || { name: 'Sem Categoria', color: '#64748b' };
      const monthAAmountInCents =
        summaryA.categoryBreakdown.find((c) => c.categoryId === categoryId)?.amountInCents || 0;
      const monthBAmountInCents =
        summaryB.categoryBreakdown.find((c) => c.categoryId === categoryId)?.amountInCents || 0;
      const diffInCents = monthBAmountInCents - monthAAmountInCents;
      const variationPercent =
        monthAAmountInCents > 0
          ? ((monthBAmountInCents - monthAAmountInCents) / monthAAmountInCents) * 100
          : monthBAmountInCents > 0
          ? 100
          : 0;
      return {
        categoryId,
        name: meta.name,
        color: meta.color,
        monthAAmountInCents,
        monthBAmountInCents,
        diffInCents,
        variationPercent,
      };
    })
    .sort(
      (a, b) =>
        Math.max(b.monthAAmountInCents, b.monthBAmountInCents) -
        Math.max(a.monthAAmountInCents, a.monthBAmountInCents)
    );
  return {
    monthA: summaryA,
    monthB: summaryB,
    expenseDiffInCents,
    expenseVariationPercent,
    incomeDiffInCents,
    incomeVariationPercent,
    categoryDeltas,
  };
}

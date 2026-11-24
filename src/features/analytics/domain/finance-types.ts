export interface AccountWithBalance {
  id: string;
  name: string;
  type: string;
  initialBalanceInCents: number;
  currentBalanceInCents: number;
  color: string;
  isArchived: boolean;
}

export interface CreditCardWithSummary {
  id: string;
  name: string;
  brand: string;
  limitInCents: number;
  usedLimitInCents: number;
  availableLimitInCents: number;
  closingDay: number;
  dueDay: number;
  color: string;
  currentInvoiceInCents: number;
  currentInvoiceStatus: string;
  currentInvoiceId?: string;
}

export interface PortfolioGoalProgress {
  id: string;
  title: string;
  targetAmountInCents: number;
  currentNetWorthInCents: number;
  progressPercent: number;
  remainingDistanceInCents: number;
  isAchieved: boolean;
  targetMonth: number;
  targetYear: number;
  monthsRemaining: number;
  recommendedMonthlyContributionInCents: number;
  currentMonthlyPaceInCents: number;
  estimatedMonthsToReach: number | null;
  estimatedCompletionMonth: number | null;
  estimatedCompletionYear: number | null;
  willReachOnTime: boolean;
  paceStatus: 'ACHIEVED' | 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'STALLED';
  monthlyPaceGapInCents: number;
  notes?: string | null;
}

export interface StaticBaselineSummary {
  staticIncomeInCents: number;
  staticExpenseInCents: number;
  variableIncomeInCents: number;
  variableExpenseInCents: number;
  freeDiscretionaryIncomeInCents: number;
  isOverCommitted: boolean;
  commitmentPercent: number;
}

export interface MonthSummaryData {
  month: number;
  year: number;
  label: string;
  totalIncomeInCents: number;
  totalExpenseInCents: number;
  netBalanceInCents: number;
  staticExpenseInCents: number;
  variableExpenseInCents: number;
  staticIncomeInCents: number;
  variableIncomeInCents: number;
  championCategory: {
    id: string;
    name: string;
    color: string;
    amountInCents: number;
    sharePercent: number;
  } | null;
  topExpenseItem: {
    id: string;
    description: string;
    amountInCents: number;
    categoryName: string;
    date: string;
  } | null;
  categoryBreakdown: Array<{
    categoryId: string;
    name: string;
    color: string;
    amountInCents: number;
    percent: number;
  }>;
}

export interface MoMComparisonReport {
  monthA: MonthSummaryData;
  monthB: MonthSummaryData;
  expenseDiffInCents: number;
  expenseVariationPercent: number;
  incomeDiffInCents: number;
  incomeVariationPercent: number;
  categoryDeltas: Array<{
    categoryId: string;
    name: string;
    color: string;
    monthAAmountInCents: number;
    monthBAmountInCents: number;
    diffInCents: number;
    variationPercent: number;
  }>;
}

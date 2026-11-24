export interface SerializedValueForecastItem {
  id: string;
  title: string;
  type: 'INCOME' | 'EXPENSE';
  amountInCents: number;
  expectedDate: string; // ISO string
  notes: string | null;
}

export interface SerializedBalanceTargetCheck {
  id: string;
  title: string;
  plannedBalanceInCents: number;
  targetDate: string; // ISO string
  notes: string | null;
}

export type BalanceVerificationStatus = 'PENDING' | 'EXACT' | 'ABOVE' | 'BELOW';

export interface EvaluatedBalanceTarget {
  target: SerializedBalanceTargetCheck;
  daysUntilTarget: number;
  isDue: boolean;
  verificationStatus: BalanceVerificationStatus;
  actualBalanceInCents: number;
  actualDiffInCents: number;
  projectedBalanceAtTargetInCents: number;
  projectedDiffVsPlannedInCents: number;
  includedItemsCount: number;
}

export interface ValueForecastSummary {
  currentBalanceInCents: number;
  totalPredictedIncomeInCents: number;
  totalPredictedExpenseInCents: number;
  netPredictedDeltaInCents: number;
  projectedFinalBalanceInCents: number;
  evaluatedTargets: EvaluatedBalanceTarget[];
}

const MS_PER_DAY = 86_400_000;

export function toCalendarDayUtcMs(input: Date | string): number {
  if (typeof input === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(input.trim());
    if (match) {
      return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    const parsed = new Date(input);
    return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return Date.UTC(input.getFullYear(), input.getMonth(), input.getDate());
}

export function formatIsoDatePtBR(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function evaluateBalanceTarget(params: {
  target: SerializedBalanceTargetCheck;
  currentBalanceInCents: number;
  items: SerializedValueForecastItem[];
  referenceDate?: Date;
}): EvaluatedBalanceTarget {
  const todayMs = toCalendarDayUtcMs(params.referenceDate || new Date());
  const targetMs = toCalendarDayUtcMs(params.target.targetDate);
  const daysUntilTarget = Math.round((targetMs - todayMs) / MS_PER_DAY);
  const isDue = daysUntilTarget <= 0;

  let includedDelta = 0;
  let includedItemsCount = 0;
  for (const item of params.items) {
    if (toCalendarDayUtcMs(item.expectedDate) <= targetMs) {
      includedItemsCount += 1;
      includedDelta += item.type === 'INCOME' ? item.amountInCents : -item.amountInCents;
    }
  }

  const projectedBalanceAtTargetInCents = params.currentBalanceInCents + includedDelta;
  const projectedDiffVsPlannedInCents =
    projectedBalanceAtTargetInCents - params.target.plannedBalanceInCents;

  const actualBalanceInCents = params.currentBalanceInCents;
  const actualDiffInCents = actualBalanceInCents - params.target.plannedBalanceInCents;

  let verificationStatus: BalanceVerificationStatus = 'PENDING';
  if (isDue) {
    if (actualDiffInCents === 0) {
      verificationStatus = 'EXACT';
    } else if (actualDiffInCents > 0) {
      verificationStatus = 'ABOVE';
    } else {
      verificationStatus = 'BELOW';
    }
  }

  return {
    target: params.target,
    daysUntilTarget,
    isDue,
    verificationStatus,
    actualBalanceInCents,
    actualDiffInCents,
    projectedBalanceAtTargetInCents,
    projectedDiffVsPlannedInCents,
    includedItemsCount,
  };
}

export function computeValueForecastSummary(params: {
  currentBalanceInCents: number;
  items: SerializedValueForecastItem[];
  targets: SerializedBalanceTargetCheck[];
  referenceDate?: Date;
}): ValueForecastSummary {
  const totalPredictedIncomeInCents = params.items
    .filter((i) => i.type === 'INCOME')
    .reduce((acc, i) => acc + i.amountInCents, 0);
  const totalPredictedExpenseInCents = params.items
    .filter((i) => i.type === 'EXPENSE')
    .reduce((acc, i) => acc + i.amountInCents, 0);
  const netPredictedDeltaInCents = totalPredictedIncomeInCents - totalPredictedExpenseInCents;
  const projectedFinalBalanceInCents = params.currentBalanceInCents + netPredictedDeltaInCents;

  const evaluatedTargets = params.targets.map((target) =>
    evaluateBalanceTarget({
      target,
      currentBalanceInCents: params.currentBalanceInCents,
      items: params.items,
      referenceDate: params.referenceDate,
    })
  );

  return {
    currentBalanceInCents: params.currentBalanceInCents,
    totalPredictedIncomeInCents,
    totalPredictedExpenseInCents,
    netPredictedDeltaInCents,
    projectedFinalBalanceInCents,
    evaluatedTargets,
  };
}

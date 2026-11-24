export interface CombinedGoalsInput {
  goals: Array<{
    id: string;
    title: string;
    targetAmountInCents: number;
  }>;
  currentNetWorthInCents: number;
  staticIncomeInCents: number;
  staticExpenseInCents: number;
  extraMonthlyIncomeInCents?: number;
  extraMonthlyExpenseInCents?: number;
  oneTimeExtraIncomeInCents?: number;
  oneTimeExtraExpenseInCents?: number;
  referenceDate?: Date;
}

export interface CombinedGoalsProjection {
  goalsCount: number;
  totalTargetInCents: number;
  currentNetWorthInCents: number;
  effectiveStartingInCents: number;
  remainingInCents: number;
  progressPercent: number;
  staticIncomeInCents: number;
  staticExpenseInCents: number;
  staticMonthlyPaceInCents: number;
  extraMonthlyIncomeInCents: number;
  extraMonthlyExpenseInCents: number;
  oneTimeExtraIncomeInCents: number;
  oneTimeExtraExpenseInCents: number;
  effectiveMonthlyPaceInCents: number;
  isAchieved: boolean;
  estimatedMonthsToComplete: number | null;
  completionMonth: number | null;
  completionYear: number | null;
  baseEstimatedMonths: number | null;
  monthsDeltaVsStatic: number | null;
}

function advanceMonths(
  startMonth: number,
  startYear: number,
  monthsToAdd: number
): { month: number; year: number } {
  const totalZeroBased = startMonth - 1 + monthsToAdd;
  return {
    month: (totalZeroBased % 12) + 1,
    year: startYear + Math.floor(totalZeroBased / 12),
  };
}

export function formatMonthsDurationPt(totalMonths: number): string {
  if (totalMonths <= 0) return 'Concluído (0 meses)';
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) {
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  }
  const yearPart = `${years} ${years === 1 ? 'ano' : 'anos'}`;
  if (months === 0) return yearPart;
  return `${yearPart} e ${months} ${months === 1 ? 'mês' : 'meses'}`;
}

export function computeCombinedGoalsProjection(
  input: CombinedGoalsInput
): CombinedGoalsProjection {
  const extraMonthlyIncomeInCents = Math.max(0, Math.round(input.extraMonthlyIncomeInCents || 0));
  const extraMonthlyExpenseInCents = Math.max(0, Math.round(input.extraMonthlyExpenseInCents || 0));
  const oneTimeExtraIncomeInCents = Math.max(0, Math.round(input.oneTimeExtraIncomeInCents || 0));
  const oneTimeExtraExpenseInCents = Math.max(0, Math.round(input.oneTimeExtraExpenseInCents || 0));

  const totalTargetInCents = input.goals.reduce((acc, g) => acc + g.targetAmountInCents, 0);
  const effectiveStartingInCents =
    input.currentNetWorthInCents + oneTimeExtraIncomeInCents - oneTimeExtraExpenseInCents;
  const remainingInCents = Math.max(0, totalTargetInCents - effectiveStartingInCents);
  const progressPercent =
    totalTargetInCents > 0
      ? Math.min(100, Math.max(0, (effectiveStartingInCents / totalTargetInCents) * 100))
      : 100;

  const staticMonthlyPaceInCents = input.staticIncomeInCents - input.staticExpenseInCents;
  const effectiveMonthlyPaceInCents =
    staticMonthlyPaceInCents + extraMonthlyIncomeInCents - extraMonthlyExpenseInCents;

  const now = input.referenceDate || new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const isAchieved = totalTargetInCents > 0 ? remainingInCents === 0 : true;
  let estimatedMonthsToComplete: number | null = null;
  let completionMonth: number | null = null;
  let completionYear: number | null = null;

  if (isAchieved) {
    estimatedMonthsToComplete = 0;
    completionMonth = currentMonth;
    completionYear = currentYear;
  } else if (effectiveMonthlyPaceInCents > 0) {
    estimatedMonthsToComplete = Math.ceil(remainingInCents / effectiveMonthlyPaceInCents);
    const completion = advanceMonths(currentMonth, currentYear, estimatedMonthsToComplete);
    completionMonth = completion.month;
    completionYear = completion.year;
  }

  const baseRemaining = Math.max(0, totalTargetInCents - input.currentNetWorthInCents);
  let baseEstimatedMonths: number | null = null;
  if (totalTargetInCents > 0 && baseRemaining === 0) {
    baseEstimatedMonths = 0;
  } else if (staticMonthlyPaceInCents > 0 && baseRemaining > 0) {
    baseEstimatedMonths = Math.ceil(baseRemaining / staticMonthlyPaceInCents);
  }

  const monthsDeltaVsStatic =
    estimatedMonthsToComplete !== null && baseEstimatedMonths !== null
      ? estimatedMonthsToComplete - baseEstimatedMonths
      : null;

  return {
    goalsCount: input.goals.length,
    totalTargetInCents,
    currentNetWorthInCents: input.currentNetWorthInCents,
    effectiveStartingInCents,
    remainingInCents,
    progressPercent,
    staticIncomeInCents: input.staticIncomeInCents,
    staticExpenseInCents: input.staticExpenseInCents,
    staticMonthlyPaceInCents,
    extraMonthlyIncomeInCents,
    extraMonthlyExpenseInCents,
    oneTimeExtraIncomeInCents,
    oneTimeExtraExpenseInCents,
    effectiveMonthlyPaceInCents,
    isAchieved,
    estimatedMonthsToComplete,
    completionMonth,
    completionYear,
    baseEstimatedMonths,
    monthsDeltaVsStatic,
  };
}

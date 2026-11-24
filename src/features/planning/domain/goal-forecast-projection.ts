import type { PortfolioGoalProgress } from '@/features/analytics/domain/finance-types';
import type { SerializedValueForecastItem } from '@/features/planning/domain/value-forecast-calculator';

export interface GoalWithValueForecastProjection {
  hasForecastItems: boolean;
  itemsCount: number;
  totalPredictedIncomeInCents: number;
  totalPredictedExpenseInCents: number;
  netPredictedDeltaInCents: number;
  projectedBalanceWithForecastInCents: number;
  projectedRemainingInCents: number;
  projectedProgressPercent: number;
  estimatedMonthsToReach: number | null;
  estimatedCompletionMonth: number | null;
  estimatedCompletionYear: number | null;
  monthsDeltaVsNormal: number | null;
  paceStatus: PortfolioGoalProgress['paceStatus'];
}

function advanceCalendarMonths(
  startMonth: number,
  startYear: number,
  monthsToAdd: number
): { month: number; year: number } {
  const zeroBased = startMonth - 1 + monthsToAdd;
  return {
    month: (zeroBased % 12) + 1,
    year: startYear + Math.floor(zeroBased / 12),
  };
}

function extractYearMonth(isoDate: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate.trim());
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]) };
  }
  const d = new Date(isoDate);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * Calcula uma projeção fictícia de tempo para alcançar uma meta (individual ou soma de metas)
 * incorporando os itens cadastrados na aba Previsão de Valor (Vou Ganhar / Provável Gasto)
 * no mês exato em que cada evento está previsto para ocorrer.
 *
 * Quando não há itens de previsão (`items.length === 0`), retorna `hasForecastItems: false`
 * para que a interface siga o cálculo normal da meta.
 */
export function computeGoalWithValueForecast(params: {
  targetAmountInCents: number;
  currentNetWorthInCents: number;
  monthlyPaceInCents: number;
  normalEstimatedMonths: number | null;
  targetMonth?: number;
  targetYear?: number;
  items: SerializedValueForecastItem[];
  referenceDate?: Date;
}): GoalWithValueForecastProjection {
  const {
    targetAmountInCents,
    currentNetWorthInCents,
    monthlyPaceInCents,
    normalEstimatedMonths,
    targetMonth,
    targetYear,
    items,
  } = params;

  const now = params.referenceDate || new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (items.length === 0) {
    const remaining = Math.max(0, targetAmountInCents - currentNetWorthInCents);
    const progress =
      targetAmountInCents > 0
        ? Math.min(100, Math.max(0, (currentNetWorthInCents / targetAmountInCents) * 100))
        : 100;
    const comp =
      normalEstimatedMonths !== null
        ? advanceCalendarMonths(currentMonth, currentYear, normalEstimatedMonths)
        : null;
    return {
      hasForecastItems: false,
      itemsCount: 0,
      totalPredictedIncomeInCents: 0,
      totalPredictedExpenseInCents: 0,
      netPredictedDeltaInCents: 0,
      projectedBalanceWithForecastInCents: currentNetWorthInCents,
      projectedRemainingInCents: remaining,
      projectedProgressPercent: progress,
      estimatedMonthsToReach: normalEstimatedMonths,
      estimatedCompletionMonth: comp?.month ?? null,
      estimatedCompletionYear: comp?.year ?? null,
      monthsDeltaVsNormal: 0,
      paceStatus: remaining === 0 ? 'ACHIEVED' : normalEstimatedMonths !== null ? 'ON_TRACK' : 'STALLED',
    };
  }

  let totalPredictedIncomeInCents = 0;
  let totalPredictedExpenseInCents = 0;
  const deltaByMonthOffset = new Map<number, number>();
  let maxForecastOffset = 0;

  for (const item of items) {
    const signed = item.type === 'INCOME' ? item.amountInCents : -item.amountInCents;
    if (item.type === 'INCOME') totalPredictedIncomeInCents += item.amountInCents;
    else totalPredictedExpenseInCents += item.amountInCents;

    const ym = extractYearMonth(item.expectedDate);
    const rawOffset = (ym.year - currentYear) * 12 + (ym.month - currentMonth);
    const offset = Math.max(0, rawOffset);
    if (offset > maxForecastOffset) maxForecastOffset = offset;
    deltaByMonthOffset.set(offset, (deltaByMonthOffset.get(offset) || 0) + signed);
  }

  const netPredictedDeltaInCents = totalPredictedIncomeInCents - totalPredictedExpenseInCents;
  const projectedBalanceWithForecastInCents = currentNetWorthInCents + netPredictedDeltaInCents;
  const projectedRemainingInCents = Math.max(0, targetAmountInCents - projectedBalanceWithForecastInCents);
  const projectedProgressPercent =
    targetAmountInCents > 0
      ? Math.min(100, Math.max(0, (projectedBalanceWithForecastInCents / targetAmountInCents) * 100))
      : 100;

  // Simulação mês a mês até ultrapassar o último evento previsto; depois usa cálculo fechado exato
  let runningBalance = currentNetWorthInCents + (deltaByMonthOffset.get(0) || 0);
  let estimatedMonthsToReach: number | null = null;

  if (runningBalance >= targetAmountInCents && projectedBalanceWithForecastInCents >= targetAmountInCents) {
    estimatedMonthsToReach = 0;
  } else {
    const simulationCap = Math.min(maxForecastOffset, 240);
    for (let m = 1; m <= simulationCap; m += 1) {
      runningBalance += monthlyPaceInCents + (deltaByMonthOffset.get(m) || 0);
      if (runningBalance >= targetAmountInCents) {
        estimatedMonthsToReach = m;
        break;
      }
    }

    if (estimatedMonthsToReach === null && monthlyPaceInCents > 0) {
      const stillMissing = targetAmountInCents - runningBalance;
      estimatedMonthsToReach = simulationCap + Math.ceil(stillMissing / monthlyPaceInCents);
    }
  }

  let estimatedCompletionMonth: number | null = null;
  let estimatedCompletionYear: number | null = null;
  if (estimatedMonthsToReach !== null) {
    const comp = advanceCalendarMonths(currentMonth, currentYear, estimatedMonthsToReach);
    estimatedCompletionMonth = comp.month;
    estimatedCompletionYear = comp.year;
  }

  let paceStatus: PortfolioGoalProgress['paceStatus'] = 'STALLED';
  if (estimatedMonthsToReach === 0) {
    paceStatus = 'ACHIEVED';
  } else if (estimatedMonthsToReach !== null) {
    if (targetMonth && targetYear) {
      const targetDiff = Math.max(0, (targetYear - currentYear) * 12 + (targetMonth - currentMonth));
      if (estimatedMonthsToReach < targetDiff) paceStatus = 'AHEAD';
      else if (estimatedMonthsToReach === targetDiff || (targetDiff === 0 && estimatedMonthsToReach <= 1)) {
        paceStatus = 'ON_TRACK';
      } else {
        paceStatus = 'BEHIND';
      }
    } else {
      paceStatus = 'ON_TRACK';
    }
  }

  const monthsDeltaVsNormal =
    estimatedMonthsToReach !== null && normalEstimatedMonths !== null
      ? estimatedMonthsToReach - normalEstimatedMonths
      : null;

  return {
    hasForecastItems: true,
    itemsCount: items.length,
    totalPredictedIncomeInCents,
    totalPredictedExpenseInCents,
    netPredictedDeltaInCents,
    projectedBalanceWithForecastInCents,
    projectedRemainingInCents,
    projectedProgressPercent,
    estimatedMonthsToReach,
    estimatedCompletionMonth,
    estimatedCompletionYear,
    monthsDeltaVsNormal,
    paceStatus,
  };
}

'use client';

import * as React from 'react';
import { ArrowRight, CalendarClock, Sparkles } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { formatCentsToBRL, MONTH_NAMES_PT } from '@/shared/lib/currency';
import type { SerializedValueForecastItem } from '@/features/planning/domain/value-forecast-calculator';
import { computeGoalWithValueForecast } from '@/features/planning/domain/goal-forecast-projection';
import { formatMonthsDurationPt } from '@/features/planning/domain/combined-goals-calculator';

export function CombinedGoalsForecastBanner(props: {
  totalTargetInCents: number;
  currentNetWorthInCents: number;
  effectiveMonthlyPaceInCents: number;
  normalEstimatedMonths: number | null;
  forecastItems: SerializedValueForecastItem[];
  hideValues: boolean;
  onOpenForecastTab: () => void;
}) {
  const {
    totalTargetInCents,
    currentNetWorthInCents,
    effectiveMonthlyPaceInCents,
    normalEstimatedMonths,
    forecastItems,
    hideValues,
    onOpenForecastTab,
  } = props;

  const proj = React.useMemo(
    () =>
      computeGoalWithValueForecast({
        targetAmountInCents: totalTargetInCents,
        currentNetWorthInCents,
        monthlyPaceInCents: effectiveMonthlyPaceInCents,
        normalEstimatedMonths,
        items: forecastItems,
      }),
    [
      totalTargetInCents,
      currentNetWorthInCents,
      effectiveMonthlyPaceInCents,
      normalEstimatedMonths,
      forecastItems,
    ]
  );

  if (!proj.hasForecastItems) return null;

  const deltaLabel =
    proj.monthsDeltaVsNormal !== null && proj.monthsDeltaVsNormal < 0
      ? `${Math.abs(proj.monthsDeltaVsNormal)} ${Math.abs(proj.monthsDeltaVsNormal) === 1 ? 'mês' : 'meses'} mais rápido`
      : proj.monthsDeltaVsNormal !== null && proj.monthsDeltaVsNormal > 0
      ? `+${proj.monthsDeltaVsNormal} ${proj.monthsDeltaVsNormal === 1 ? 'mês' : 'meses'} vs ritmo normal`
      : proj.estimatedMonthsToReach !== null && normalEstimatedMonths === null
      ? 'Alcançável com previsões'
      : 'Mesmo prazo normal';

  const deltaVariant =
    proj.monthsDeltaVsNormal !== null && proj.monthsDeltaVsNormal < 0
      ? ('income' as const)
      : proj.monthsDeltaVsNormal !== null && proj.monthsDeltaVsNormal > 0
      ? ('warning' as const)
      : ('transfer' as const);

  return (
    <div className="rounded-xl border border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/45 dark:bg-indigo-950/30 p-4 space-y-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-indigo-900 dark:text-indigo-200">
          <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
          <span>Cenário Fictício Consolidado (Com Previsão de Valor)</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={deltaVariant}>{deltaLabel}</Badge>
          <button
            type="button"
            onClick={onOpenForecastTab}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <span>Previsão de Valor</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 tabular-nums">
        <div className="text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span>
            Considerando{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              +{formatCentsToBRL(proj.totalPredictedIncomeInCents, hideValues)}
            </strong>{' '}
            em ganhos previstos e{' '}
            <strong className="text-rose-600 dark:text-rose-400">
              -{formatCentsToBRL(proj.totalPredictedExpenseInCents, hideValues)}
            </strong>{' '}
            em prováveis gastos ({proj.itemsCount}{' '}
            {proj.itemsCount === 1 ? 'item' : 'itens'}):
          </span>
        </div>

        <div className="font-semibold text-indigo-700 dark:text-indigo-300">
          {proj.estimatedMonthsToReach === 0
            ? 'Todas as metas concluídas c/ previsões'
            : proj.estimatedMonthsToReach !== null &&
              proj.estimatedCompletionMonth &&
              proj.estimatedCompletionYear
            ? `Conclusão em ${formatMonthsDurationPt(proj.estimatedMonthsToReach)} (${MONTH_NAMES_PT[proj.estimatedCompletionMonth - 1]}/${proj.estimatedCompletionYear})`
            : 'Prazo indeterminado mesmo c/ previsões'}
        </div>
      </div>
    </div>
  );
}

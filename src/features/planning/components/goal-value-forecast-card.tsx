'use client';

import * as React from 'react';
import { ArrowRight, CalendarClock, Sparkles } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { formatCentsToBRL, MONTH_NAMES_PT } from '@/shared/lib/currency';
import type { PortfolioGoalProgress } from '@/features/analytics';
import type { SerializedValueForecastItem } from '@/features/planning/domain/value-forecast-calculator';
import { computeGoalWithValueForecast } from '@/features/planning/domain/goal-forecast-projection';
import { formatMonthsDurationPt } from '@/features/planning/domain/combined-goals-calculator';

export function GoalValueForecastCard(props: {
  goal: PortfolioGoalProgress;
  forecastItems: SerializedValueForecastItem[];
  hideValues: boolean;
  onOpenForecastTab: () => void;
}) {
  const { goal, forecastItems, hideValues, onOpenForecastTab } = props;

  const proj = React.useMemo(
    () =>
      computeGoalWithValueForecast({
        targetAmountInCents: goal.targetAmountInCents,
        currentNetWorthInCents: goal.currentNetWorthInCents,
        monthlyPaceInCents: goal.currentMonthlyPaceInCents,
        normalEstimatedMonths: goal.estimatedMonthsToReach,
        targetMonth: goal.targetMonth,
        targetYear: goal.targetYear,
        items: forecastItems,
      }),
    [goal, forecastItems]
  );

  // Se não houver nenhuma previsão cadastrada, segue a meta normal sem exibir card extra
  if (!proj.hasForecastItems) return null;

  const deltaBadge = (() => {
    if (proj.estimatedMonthsToReach === 0 && !goal.isAchieved) {
      return { variant: 'income' as const, label: 'Alcança já c/ previsões' };
    }
    if (proj.monthsDeltaVsNormal !== null && proj.monthsDeltaVsNormal < 0) {
      const saved = Math.abs(proj.monthsDeltaVsNormal);
      return {
        variant: 'income' as const,
        label: `${saved} ${saved === 1 ? 'mês' : 'meses'} mais rápido`,
      };
    }
    if (proj.monthsDeltaVsNormal !== null && proj.monthsDeltaVsNormal > 0) {
      return {
        variant: 'warning' as const,
        label: `+${proj.monthsDeltaVsNormal} ${proj.monthsDeltaVsNormal === 1 ? 'mês' : 'meses'} vs normal`,
      };
    }
    if (proj.estimatedMonthsToReach !== null && goal.estimatedMonthsToReach === null) {
      return { variant: 'income' as const, label: 'Viabilizada c/ previsões' };
    }
    if (proj.estimatedMonthsToReach === null) {
      return { variant: 'expense' as const, label: 'Não alcança c/ previsões' };
    }
    return { variant: 'transfer' as const, label: 'Mesmo prazo normal' };
  })();

  const completionLabel =
    proj.estimatedMonthsToReach === 0
      ? 'Alcançada com as previsões'
      : proj.estimatedMonthsToReach !== null && proj.estimatedCompletionMonth && proj.estimatedCompletionYear
      ? `${formatMonthsDurationPt(proj.estimatedMonthsToReach)} (${MONTH_NAMES_PT[proj.estimatedCompletionMonth - 1]}/${proj.estimatedCompletionYear})`
      : 'Indeterminado';

  return (
    <div className="rounded-xl border border-dashed border-indigo-300 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/25 p-3.5 space-y-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-indigo-800 dark:text-indigo-200">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span>Meta Fictícia (Com Previsão de Valor)</span>
        </div>
        <Badge variant={deltaBadge.variant}>{deltaBadge.label}</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 tabular-nums">
        <div className="rounded-lg bg-white/85 dark:bg-zinc-950/80 border border-indigo-200/60 dark:border-indigo-900/50 p-2">
          <span className="text-[10px] text-slate-400 block">Saldo c/ Previsões</span>
          <strong className="text-xs text-slate-900 dark:text-zinc-100">
            {formatCentsToBRL(proj.projectedBalanceWithForecastInCents, hideValues)}
          </strong>
        </div>
        <div className="rounded-lg bg-white/85 dark:bg-zinc-950/80 border border-indigo-200/60 dark:border-indigo-900/50 p-2">
          <span className="text-[10px] text-slate-400 block">Falta c/ Previsões</span>
          <strong className="text-xs text-amber-600 dark:text-amber-400">
            {formatCentsToBRL(proj.projectedRemainingInCents, hideValues)}
          </strong>
        </div>
        <div className="rounded-lg bg-white/85 dark:bg-zinc-950/80 border border-indigo-200/60 dark:border-indigo-900/50 p-2">
          <span className="text-[10px] text-slate-400 block">Tempo c/ Previsão</span>
          <strong className="text-xs text-indigo-700 dark:text-indigo-300">{completionLabel}</strong>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-zinc-400 tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span>
            {proj.itemsCount} {proj.itemsCount === 1 ? 'evento previsto' : 'eventos previstos'}:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              +{formatCentsToBRL(proj.totalPredictedIncomeInCents, hideValues)}
            </strong>{' '}
            /{' '}
            <strong className="text-rose-600 dark:text-rose-400">
              -{formatCentsToBRL(proj.totalPredictedExpenseInCents, hideValues)}
            </strong>
          </span>
        </span>

        <button
          type="button"
          onClick={onOpenForecastTab}
          className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <span>Ajustar Previsões</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

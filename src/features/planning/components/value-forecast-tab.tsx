'use client';

import * as React from 'react';
import { Wallet, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { formatCentsToBRL } from '@/shared/lib/currency';
import { computeValueForecastSummary } from '@/features/planning/domain/value-forecast-calculator';
import { ValueForecastTargetsSection } from '@/features/planning/components/value-forecast-targets-section';
import { ValueForecastItemsSection } from '@/features/planning/components/value-forecast-items-section';

export function ValueForecastTab() {
  const { props, wb } = useWorkbench();
  const items = props.valueForecastItems ?? [];
  const targets = props.balanceTargetChecks ?? [];
  const { hideValues, totalConsolidatedBalanceInCents } = wb;

  const summary = computeValueForecastSummary({
    currentBalanceInCents: totalConsolidatedBalanceInCents,
    items,
    targets,
  });

  return (
    <div className="space-y-6">
      {/* KPIs de Previsão de Valor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>Saldo Atual Real</span>
            <Wallet className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-2xl font-semibold text-slate-900 dark:text-zinc-100">
            {formatCentsToBRL(summary.currentBalanceInCents, hideValues)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>Ganhos Previstos</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
            +{formatCentsToBRL(summary.totalPredictedIncomeInCents, hideValues)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>Gastos Previstos</span>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-semibold text-rose-600 dark:text-rose-400">
            -{formatCentsToBRL(summary.totalPredictedExpenseInCents, hideValues)}
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300 font-medium">
            <span>Saldo Projetado Final</span>
            <Sparkles className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-semibold text-indigo-700 dark:text-indigo-200">
            {formatCentsToBRL(summary.projectedFinalBalanceInCents, hideValues)}
          </div>
        </div>
      </div>

      {/* Seção 1: Metas de Saldo por Data */}
      <ValueForecastTargetsSection
        evaluatedTargets={summary.evaluatedTargets}
        projectedFinalBalanceInCents={summary.projectedFinalBalanceInCents}
        hideValues={hideValues}
      />

      {/* Seção 2: Previsões de Ganhos e Gastos */}
      <ValueForecastItemsSection items={items} hideValues={hideValues} />
    </div>
  );
}

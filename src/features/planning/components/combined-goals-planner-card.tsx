'use client';

import * as React from 'react';
import { Layers } from 'lucide-react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { Badge } from '@/shared/ui/badge';
import {
  formatCentsToBRL,
  formatPercent,
  MONTH_NAMES_PT,
  parseInputToCents,
} from '@/shared/lib/currency';
import {
  computeCombinedGoalsProjection,
  formatMonthsDurationPt,
} from '@/features/planning/domain/combined-goals-calculator';
import { CombinedGoalsSimulator } from '@/features/planning/components/combined-goals-simulator';
import { CombinedGoalsForecastBanner } from '@/features/planning/components/combined-goals-forecast-banner';

export function CombinedGoalsPlannerCard() {
  const { props, wb } = useWorkbench();
  const { portfolioGoals, staticBaseline, valueForecastItems = [] } = props;
  const { hideValues, setActiveTab } = wb;

  const [extraMonthlyIncome, setExtraMonthlyIncome] = React.useState('');
  const [extraMonthlyExpense, setExtraMonthlyExpense] = React.useState('');
  const [oneTimeIncome, setOneTimeIncome] = React.useState('');
  const [oneTimeExpense, setOneTimeExpense] = React.useState('');

  if (portfolioGoals.length === 0) return null;

  const currentNetWorthInCents = portfolioGoals[0]?.currentNetWorthInCents ?? 0;
  const projection = computeCombinedGoalsProjection({
    goals: portfolioGoals,
    currentNetWorthInCents,
    staticIncomeInCents: staticBaseline.staticIncomeInCents,
    staticExpenseInCents: staticBaseline.staticExpenseInCents,
    extraMonthlyIncomeInCents: parseInputToCents(extraMonthlyIncome),
    extraMonthlyExpenseInCents: parseInputToCents(extraMonthlyExpense),
    oneTimeExtraIncomeInCents: parseInputToCents(oneTimeIncome),
    oneTimeExtraExpenseInCents: parseInputToCents(oneTimeExpense),
  });

  const hasSimulation =
    projection.extraMonthlyIncomeInCents > 0 ||
    projection.extraMonthlyExpenseInCents > 0 ||
    projection.oneTimeExtraIncomeInCents > 0 ||
    projection.oneTimeExtraExpenseInCents > 0;

  const clearSimulation = () => {
    setExtraMonthlyIncome('');
    setExtraMonthlyExpense('');
    setOneTimeIncome('');
    setOneTimeExpense('');
  };

  return (
    <div data-agent-id="goals.section.combined" className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-white dark:bg-zinc-950 p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-500 shrink-0" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
              Metas Juntas — Projeção Consolidada
            </h3>
            <Badge variant="transfer">
              {projection.goalsCount} {projection.goalsCount === 1 ? 'meta' : 'metas somadas'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Tempo estimado para concluir todas as suas metas juntas com base nos seus ganhos e custos estáticos, simulando outros ganhos e custos no caminho.
          </p>
        </div>

        <Badge
          variant={
            projection.isAchieved
              ? 'income'
              : projection.estimatedMonthsToComplete !== null
              ? 'transfer'
              : 'expense'
          }
        >
          {projection.isAchieved
            ? 'Todas as metas alcançadas'
            : projection.estimatedMonthsToComplete !== null
            ? `Conclusão em ${formatMonthsDurationPt(projection.estimatedMonthsToComplete)}`
            : 'Sobra mensal insuficiente'}
        </Badge>
      </div>

      {/* KPIs Consolidados */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs tabular-nums">
        <div className="rounded-xl bg-slate-50 dark:bg-zinc-900 p-3">
          <span className="text-slate-400 block">Soma de Todas as Metas</span>
          <strong className="text-base text-slate-900 dark:text-zinc-100">
            {formatCentsToBRL(projection.totalTargetInCents, hideValues)}
          </strong>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-zinc-900 p-3">
          <span className="text-slate-400 block">
            {projection.oneTimeExtraIncomeInCents > 0 || projection.oneTimeExtraExpenseInCents > 0
              ? 'Saldo Base (c/ Pontuais)'
              : 'Você Tem Agora'}
          </span>
          <strong className="text-base text-emerald-600 dark:text-emerald-400">
            {formatCentsToBRL(projection.effectiveStartingInCents, hideValues)}
          </strong>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-zinc-900 p-3">
          <span className="text-slate-400 block">Falta no Total</span>
          <strong className="text-base text-amber-600 dark:text-amber-400">
            {formatCentsToBRL(projection.remainingInCents, hideValues)}
          </strong>
        </div>
        <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60 p-3">
          <span className="text-indigo-600 dark:text-indigo-300 block">Tempo p/ Completar Tudo</span>
          <strong className="text-base text-indigo-700 dark:text-indigo-200 block">
            {projection.isAchieved
              ? 'Concluído'
              : projection.estimatedMonthsToComplete !== null
              ? formatMonthsDurationPt(projection.estimatedMonthsToComplete)
              : 'Indeterminado'}
          </strong>
          {!projection.isAchieved &&
            projection.completionMonth !== null &&
            projection.completionYear !== null && (
              <span className="text-[11px] text-indigo-600/80 dark:text-indigo-300/80">
                Previsão: {MONTH_NAMES_PT[projection.completionMonth - 1]}/
                {projection.completionYear}
              </span>
            )}
        </div>
      </div>

      {/* Barra de Progresso Total */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap justify-between gap-2 text-xs font-medium tabular-nums">
          <span>Progresso total: {formatPercent(projection.progressPercent)}</span>
          <span className="text-slate-500 dark:text-zinc-400">
            Base estática:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              +{formatCentsToBRL(projection.staticIncomeInCents, hideValues)}
            </strong>{' '}
            −{' '}
            <strong className="text-rose-600 dark:text-rose-400">
              {formatCentsToBRL(projection.staticExpenseInCents, hideValues)}
            </strong>{' '}
            ={' '}
            <strong className="text-slate-900 dark:text-zinc-100">
              {formatCentsToBRL(projection.staticMonthlyPaceInCents, hideValues)}/mês
            </strong>
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${Math.min(100, projection.progressPercent)}%` }}
          />
        </div>
      </div>

      <CombinedGoalsForecastBanner
        totalTargetInCents={projection.totalTargetInCents}
        currentNetWorthInCents={projection.effectiveStartingInCents}
        effectiveMonthlyPaceInCents={projection.effectiveMonthlyPaceInCents}
        normalEstimatedMonths={projection.estimatedMonthsToComplete}
        forecastItems={valueForecastItems}
        hideValues={hideValues}
        onOpenForecastTab={() => setActiveTab('forecast')}
      />

      <CombinedGoalsSimulator
        projection={projection}
        variableIncomeInCents={staticBaseline.variableIncomeInCents}
        variableExpenseInCents={staticBaseline.variableExpenseInCents}
        hideValues={hideValues}
        extraMonthlyIncome={extraMonthlyIncome}
        setExtraMonthlyIncome={setExtraMonthlyIncome}
        extraMonthlyExpense={extraMonthlyExpense}
        setExtraMonthlyExpense={setExtraMonthlyExpense}
        oneTimeIncome={oneTimeIncome}
        setOneTimeIncome={setOneTimeIncome}
        oneTimeExpense={oneTimeExpense}
        setOneTimeExpense={setOneTimeExpense}
        hasSimulation={hasSimulation}
        onClear={clearSimulation}
      />
    </div>
  );
}

'use client';

import * as React from 'react';
import { RotateCcw, SlidersHorizontal, TrendingDown, TrendingUp } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { formatCentsToBRL } from '@/shared/lib/currency';
import {
  CombinedGoalsProjection,
  formatMonthsDurationPt,
} from '@/features/planning/domain/combined-goals-calculator';

export interface CombinedGoalsSimulatorProps {
  projection: CombinedGoalsProjection;
  variableIncomeInCents: number;
  variableExpenseInCents: number;
  hideValues: boolean;
  extraMonthlyIncome: string;
  setExtraMonthlyIncome: (v: string) => void;
  extraMonthlyExpense: string;
  setExtraMonthlyExpense: (v: string) => void;
  oneTimeIncome: string;
  setOneTimeIncome: (v: string) => void;
  oneTimeExpense: string;
  setOneTimeExpense: (v: string) => void;
  hasSimulation: boolean;
  onClear: () => void;
}

const formatCentsInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

export function CombinedGoalsSimulator({
  projection,
  variableIncomeInCents,
  variableExpenseInCents,
  hideValues,
  extraMonthlyIncome,
  setExtraMonthlyIncome,
  extraMonthlyExpense,
  setExtraMonthlyExpense,
  oneTimeIncome,
  setOneTimeIncome,
  oneTimeExpense,
  setOneTimeExpense,
  hasSimulation,
  onClear,
}: CombinedGoalsSimulatorProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-zinc-200">
          <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span>Simular outros ganhos e custos ao longo do caminho</span>
        </div>
        <div className="flex items-center gap-3 text-xs tabular-nums">
          <span>
            Ritmo considerado:{' '}
            <strong
              className={
                projection.effectiveMonthlyPaceInCents > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }
            >
              {projection.effectiveMonthlyPaceInCents > 0 ? '+' : ''}
              {formatCentsToBRL(projection.effectiveMonthlyPaceInCents, hideValues)}/mês
            </strong>
          </span>
          {hasSimulation && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <RotateCcw className="h-3 w-3" />
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1">
            <label
              htmlFor="sim-extra-monthly-income"
              className="text-[11px] font-medium text-slate-600 dark:text-zinc-300"
            >
              Outros ganhos / mês (R$)
            </label>
            {variableIncomeInCents > 0 && (
              <button
                type="button"
                onClick={() => setExtraMonthlyIncome(formatCentsInput(variableIncomeInCents))}
                className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Usar mês ({formatCentsToBRL(variableIncomeInCents, hideValues)})
              </button>
            )}
          </div>
          <Input
            id="sim-extra-monthly-income"
            inputMode="decimal"
            placeholder="Ex: 500,00"
            value={extraMonthlyIncome}
            onChange={(e) => setExtraMonthlyIncome(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1">
            <label
              htmlFor="sim-extra-monthly-expense"
              className="text-[11px] font-medium text-slate-600 dark:text-zinc-300"
            >
              Outros custos / mês (R$)
            </label>
            {variableExpenseInCents > 0 && (
              <button
                type="button"
                onClick={() => setExtraMonthlyExpense(formatCentsInput(variableExpenseInCents))}
                className="text-[10px] font-medium text-rose-600 dark:text-rose-400 hover:underline"
              >
                Usar mês ({formatCentsToBRL(variableExpenseInCents, hideValues)})
              </button>
            )}
          </div>
          <Input
            id="sim-extra-monthly-expense"
            inputMode="decimal"
            placeholder="Ex: 300,00"
            value={extraMonthlyExpense}
            onChange={(e) => setExtraMonthlyExpense(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="sim-onetime-income"
            className="text-[11px] font-medium text-slate-600 dark:text-zinc-300 block"
          >
            Ganhos pontuais (R$)
          </label>
          <Input
            id="sim-onetime-income"
            inputMode="decimal"
            placeholder="Ex: 13º, freela..."
            value={oneTimeIncome}
            onChange={(e) => setOneTimeIncome(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="sim-onetime-expense"
            className="text-[11px] font-medium text-slate-600 dark:text-zinc-300 block"
          >
            Custos pontuais (R$)
          </label>
          <Input
            id="sim-onetime-expense"
            inputMode="decimal"
            placeholder="Ex: viagem, IPVA..."
            value={oneTimeExpense}
            onChange={(e) => setOneTimeExpense(e.target.value)}
          />
        </div>
      </div>

      {hasSimulation &&
        projection.monthsDeltaVsStatic !== null &&
        projection.monthsDeltaVsStatic !== 0 && (
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
              projection.monthsDeltaVsStatic < 0
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            }`}
          >
            {projection.monthsDeltaVsStatic < 0 ? (
              <>
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Com essa simulação, você antecipa a conclusão de todas as metas em{' '}
                  <strong>{formatMonthsDurationPt(Math.abs(projection.monthsDeltaVsStatic))}</strong>.
                </span>
              </>
            ) : (
              <>
                <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Com esses custos extras, a conclusão de todas as metas atrasa em{' '}
                  <strong>{formatMonthsDurationPt(projection.monthsDeltaVsStatic)}</strong>.
                </span>
              </>
            )}
          </div>
        )}
    </div>
  );
}

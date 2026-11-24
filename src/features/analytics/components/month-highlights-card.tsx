'use client';

import * as React from 'react';
import { Award, ArrowRight, Flame, Lock, Receipt, Sliders } from 'lucide-react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { formatCentsToBRL, formatPercent, MONTH_NAMES_PT } from '@/shared/lib/currency';

export function MonthHighlightsCard() {
  const { props, wb } = useWorkbench();
  const { monthSummary, staticBaseline, selectedMonth } = props;
  const { hideValues, setActiveTab } = wb;

  const totalSplit =
    staticBaseline.staticExpenseInCents + monthSummary.variableExpenseInCents;
  const staticPct =
    totalSplit > 0 ? (staticBaseline.staticExpenseInCents / totalSplit) * 100 : 0;
  const variablePct =
    totalSplit > 0 ? (monthSummary.variableExpenseInCents / totalSplit) * 100 : 0;

  return (
    <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-6 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500 shrink-0" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
              Destaques do Mês
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Onde seu dinheiro foi mais consumido em {MONTH_NAMES_PT[selectedMonth - 1]}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('comparison')}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0"
        >
          <span>Comparativo</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Categoria Campeã de Gasto */}
        <div className="rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                <Flame className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                Categoria Campeã
              </span>
              <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2 truncate">
                {monthSummary.championCategory ? (
                  <>
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: monthSummary.championCategory.color }}
                    />
                    <span className="truncate">{monthSummary.championCategory.name}</span>
                  </>
                ) : (
                  'Sem registros'
                )}
              </div>
            </div>
            {monthSummary.championCategory && (
              <div className="text-right tabular-nums shrink-0">
                <div className="text-base font-bold text-rose-600 dark:text-rose-400">
                  {formatCentsToBRL(monthSummary.championCategory.amountInCents, hideValues)}
                </div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                  {formatPercent(monthSummary.championCategory.sharePercent)} do total
                </span>
              </div>
            )}
          </div>
          {monthSummary.championCategory && (
            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.max(4, monthSummary.championCategory.sharePercent))}%`,
                  backgroundColor: monthSummary.championCategory.color || '#f43f5e',
                }}
              />
            </div>
          )}
        </div>

        {/* Maior Item Individual */}
        <div className="rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Receipt className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500 block">
                Item Mais Caro
              </span>
              <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                {monthSummary.topExpenseItem ? monthSummary.topExpenseItem.description : 'Nenhum item'}
              </div>
              {monthSummary.topExpenseItem && (
                <span className="text-xs text-slate-500 dark:text-zinc-400 truncate block">
                  {monthSummary.topExpenseItem.categoryName}
                </span>
              )}
            </div>
          </div>
          {monthSummary.topExpenseItem && (
            <div className="text-base font-bold tabular-nums text-rose-600 dark:text-rose-400 shrink-0">
              {formatCentsToBRL(monthSummary.topExpenseItem.amountInCents, hideValues)}
            </div>
          )}
        </div>

        {/* Divisão Custos Estáticos vs Variáveis */}
        <div className="rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 tabular-nums">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                <Lock className="h-3 w-3 text-indigo-500 shrink-0" />
                Custos Fixos ({formatPercent(staticPct)})
              </span>
              <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">
                {formatCentsToBRL(staticBaseline.staticExpenseInCents, hideValues)}
              </div>
            </div>
            <div className="space-y-1 text-right">
              <span className="inline-flex items-center justify-end gap-1.5 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                <Sliders className="h-3 w-3 text-violet-500 shrink-0" />
                Variáveis ({formatPercent(variablePct)})
              </span>
              <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">
                {formatCentsToBRL(monthSummary.variableExpenseInCents, hideValues)}
              </div>
            </div>
          </div>
          {totalSplit > 0 && (
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden flex">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${Math.min(100, staticPct)}%` }}
              />
              <div
                className="h-full bg-violet-500 transition-all duration-300"
                style={{ width: `${Math.min(100, variablePct)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

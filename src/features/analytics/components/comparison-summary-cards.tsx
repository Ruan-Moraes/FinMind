'use client';

import * as React from 'react';
import { Flame, Receipt, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { formatCentsToBRL, formatPercent, MONTH_NAMES_PT } from '@/shared/lib/currency';
import type { MoMComparisonReport, MonthSummaryData } from '@/features/analytics';

function PeriodSummaryCard({
  summary,
  roleLabel,
  badgeVariant,
  hideValues,
}: {
  summary: MonthSummaryData;
  roleLabel: string;
  badgeVariant: 'neutral' | 'transfer';
  hideValues: boolean;
}) {
  const champ = summary.championCategory;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 flex flex-col justify-between gap-4 shadow-sm">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={badgeVariant}>{summary.label}</Badge>
          <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">
            {roleLabel}
          </span>
        </div>

        <div className="flex items-end justify-between gap-2 tabular-nums">
          <div>
            <span className="text-xs text-slate-500 dark:text-zinc-400 block">Total Gasto</span>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {formatCentsToBRL(summary.totalExpenseInCents, hideValues)}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wide text-slate-400 block">
              Receitas
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              +{formatCentsToBRL(summary.totalIncomeInCents, hideValues)}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-2.5">
        <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
          Maior gasto em {MONTH_NAMES_PT[summary.month - 1]}
        </div>

        {champ ? (
          <div className="rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 tabular-nums">
              <div className="flex items-center gap-2 min-w-0">
                <Flame className="h-4 w-4 text-rose-500 shrink-0" />
                <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">
                  {champ.name}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 shrink-0">
                {formatCentsToBRL(champ.amountInCents, hideValues)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(4, champ.sharePercent))}%`,
                    backgroundColor: champ.color || '#f43f5e',
                  }}
                />
              </div>
              <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 tabular-nums shrink-0">
                {formatPercent(champ.sharePercent)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-2">Sem despesas no período.</p>
        )}

        {summary.topExpenseItem && (
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
            <div className="flex items-center gap-1.5 min-w-0">
              <Receipt className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate font-medium text-slate-700 dark:text-zinc-300">
                {summary.topExpenseItem.description}
              </span>
            </div>
            <span className="font-semibold text-slate-700 dark:text-zinc-200 shrink-0">
              {formatCentsToBRL(summary.topExpenseItem.amountInCents, hideValues)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ComparisonSummaryCards({
  momComparison,
  hideValues,
}: {
  momComparison: MoMComparisonReport;
  hideValues: boolean;
}) {
  const saved = momComparison.expenseDiffInCents < 0;
  const spentMore = momComparison.expenseDiffInCents > 0;
  const maxExpense = Math.max(
    1,
    momComparison.monthA.totalExpenseInCents,
    momComparison.monthB.totalExpenseInCents
  );
  const pctA = (momComparison.monthA.totalExpenseInCents / maxExpense) * 100;
  const pctB = (momComparison.monthB.totalExpenseInCents / maxExpense) * 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <PeriodSummaryCard
        summary={momComparison.monthA}
        roleLabel="Período Base"
        badgeVariant="neutral"
        hideValues={hideValues}
      />

      <PeriodSummaryCard
        summary={momComparison.monthB}
        roleLabel="Período Comparado"
        badgeVariant="transfer"
        hideValues={hideValues}
      />

      {/* Diagnóstico da Diferença */}
      <div
        className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 shadow-sm ${
          saved
            ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20'
            : spentMore
            ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20'
            : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
        }`}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">
              Diferença de Gastos
            </span>
            <Badge variant={saved ? 'income' : spentMore ? 'expense' : 'neutral'}>
              {saved ? (
                <>
                  <TrendingDown className="h-3 w-3 shrink-0" /> Economia
                </>
              ) : spentMore ? (
                <>
                  <TrendingUp className="h-3 w-3 shrink-0" /> Aumento
                </>
              ) : (
                'Estável'
              )}
            </Badge>
          </div>

          <div className="flex items-baseline gap-2.5 flex-wrap tabular-nums">
            <div
              className={`text-2xl sm:text-3xl font-bold ${
                saved
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : spentMore
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-800 dark:text-zinc-100'
              }`}
            >
              {momComparison.expenseDiffInCents > 0 ? '+' : ''}
              {formatCentsToBRL(momComparison.expenseDiffInCents, hideValues)}
            </div>
            <Badge variant={saved ? 'income' : spentMore ? 'expense' : 'neutral'}>
              {momComparison.expenseVariationPercent > 0 ? '+' : ''}
              {formatPercent(momComparison.expenseVariationPercent)}
            </Badge>
          </div>
        </div>

        {/* Mini comparativo visual de barras entre os 2 meses */}
        <div className="rounded-xl bg-white/85 dark:bg-zinc-950/80 border border-slate-200/70 dark:border-zinc-800 p-3 space-y-2.5 tabular-nums">
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500 dark:text-zinc-400">{momComparison.monthA.label}</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200">
                {formatCentsToBRL(momComparison.monthA.totalExpenseInCents, hideValues)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-400 dark:bg-zinc-500"
                style={{ width: `${Math.min(100, Math.max(3, pctA))}%` }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500 dark:text-zinc-400">{momComparison.monthB.label}</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200">
                {formatCentsToBRL(momComparison.monthB.totalExpenseInCents, hideValues)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${saved ? 'bg-emerald-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(100, Math.max(3, pctB))}%` }}
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
          {spentMore
            ? `Você gastou mais em ${momComparison.monthB.label} do que em ${momComparison.monthA.label}.`
            : saved
            ? `Excelente! Você economizou em ${momComparison.monthB.label} comparado a ${momComparison.monthA.label}.`
            : 'Os gastos ficaram exatamente estáveis entre os dois meses.'}
        </p>
      </div>
    </div>
  );
}

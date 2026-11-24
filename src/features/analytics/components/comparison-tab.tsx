'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';

import { Badge } from '@/shared/ui/badge';
import { formatCentsToBRL, formatPercent } from '@/shared/lib/currency';
import { ComparisonSelectorsBar } from '@/features/analytics/components/comparison-selectors-bar';
import { ComparisonSummaryCards } from '@/features/analytics/components/comparison-summary-cards';

export function ComparisonTab() {
  const { props, wb } = useWorkbench();
  const { momComparison } = props;
  const { hideValues, cellPadding, headerCellPadding } = wb;
  return (
    <div className="space-y-6">
      <ComparisonSelectorsBar />
      <ComparisonSummaryCards momComparison={momComparison} hideValues={hideValues} />

            {/* Tabela Comparativa por Categoria (Comida, Peças, Moradia, etc.) */}
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800">
                <h3 className="text-base font-semibold">
                  Comparativo Detalhado por Categoria ({momComparison.monthA.label} vs{' '}
                  {momComparison.monthB.label})
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Veja exatamente quanto cada categoria subiu ou desceu entre os meses
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <colgroup>
                    <col className="w-[36%]" />
                    <col className="w-[16%]" />
                    <col className="w-[16%]" />
                    <col className="w-[16%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead className="text-[11px] font-medium uppercase tracking-wider bg-slate-50 dark:bg-zinc-950/60 text-slate-400 dark:text-zinc-500 border-b border-slate-200 dark:border-zinc-800">
                    <tr>
                      <th className={`${headerCellPadding} align-middle text-left`}>Categoria</th>
                      <th className={`${headerCellPadding} align-middle text-right whitespace-nowrap`}>{momComparison.monthA.label}</th>
                      <th className={`${headerCellPadding} align-middle text-right whitespace-nowrap`}>{momComparison.monthB.label}</th>
                      <th className={`${headerCellPadding} align-middle text-right whitespace-nowrap`}>Diferença (R$)</th>
                      <th className={`${headerCellPadding} align-middle text-right whitespace-nowrap`}>Variação (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-zinc-800 tabular-nums">
                    {momComparison.categoryDeltas.map((row) => (
                      <tr
                        key={row.categoryId}
                        className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40"
                      >
                        <td className={`${cellPadding} align-middle font-medium`}>
                          <div className="inline-flex items-center gap-2.5">
                            <span
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: row.color }}
                            />
                            <span>{row.name}</span>
                          </div>
                        </td>
                        <td className={`${cellPadding} align-middle text-right whitespace-nowrap`}>
                          {formatCentsToBRL(row.monthAAmountInCents, hideValues)}
                        </td>
                        <td className={`${cellPadding} align-middle text-right whitespace-nowrap font-semibold`}>
                          {formatCentsToBRL(row.monthBAmountInCents, hideValues)}
                        </td>
                        <td
                          className={`${cellPadding} align-middle text-right whitespace-nowrap font-medium ${
                            row.diffInCents > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : row.diffInCents < 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {row.diffInCents > 0 ? '+' : ''}
                          {formatCentsToBRL(row.diffInCents, hideValues)}
                        </td>
                        <td className={`${cellPadding} align-middle text-right whitespace-nowrap`}>
                          <Badge
                            variant={
                              row.diffInCents > 0
                                ? 'expense'
                                : row.diffInCents < 0
                                ? 'income'
                                : 'neutral'
                            }
                          >
                            {row.variationPercent > 0 ? '+' : ''}
                            {formatPercent(row.variationPercent)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
  );
}
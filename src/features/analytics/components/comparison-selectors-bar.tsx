'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';

import { ArrowLeftRight, ChevronDown } from 'lucide-react';

import { MONTH_NAMES_PT } from '@/shared/lib/currency';



export function ComparisonSelectorsBar() {
  const { props, wb } = useWorkbench();
  const { selectedYear, compareMonthA, compareYearA, compareMonthB, compareYearB } = props;
  const { updatePeriodParams } = wb;
  return (
            <div className="w-full rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/70 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-indigo-500 shrink-0" />
                  Comparativo Direto Entre Meses (Month-over-Month)
                </h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                  Compare o que você gastou em um mês vs outro e identifique se o maior gasto foi comida, peças, moradia, etc.
                </p>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2.5 shrink-0 lg:ml-auto">
                {/* Seletor Padronizado Mês Base A */}
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-1.5 pr-3 h-11 shadow-sm">
                  <span className="h-8 px-2.5 rounded-lg bg-slate-100 dark:bg-zinc-900 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 flex items-center whitespace-nowrap shrink-0">
                    Mês A
                  </span>

                  <div className="relative flex items-center">
                    <select
                      aria-label="Mês Base A"
                      value={compareMonthA}
                      onChange={(e) => updatePeriodParams({ compMonthA: Number(e.target.value) })}
                      className="appearance-none bg-transparent text-sm font-semibold text-slate-900 dark:text-zinc-100 focus:outline-none cursor-pointer pl-1.5 pr-6"
                    >
                      {MONTH_NAMES_PT.map((m, idx) => (
                        <option key={m} value={idx + 1} className="bg-white dark:bg-zinc-900">
                          {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                  </div>

                  <span className="h-4 w-px bg-slate-200 dark:bg-zinc-800" />

                  <div className="relative flex items-center">
                    <select
                      aria-label="Ano Base A"
                      value={compareYearA}
                      onChange={(e) => updatePeriodParams({ compYearA: Number(e.target.value) })}
                      className="appearance-none bg-transparent text-sm font-semibold tabular-nums text-slate-900 dark:text-zinc-100 focus:outline-none cursor-pointer pl-1 pr-5"
                    >
                      {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
                        <option key={y} value={y} className="bg-white dark:bg-zinc-900">
                          {y}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-0 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                  </div>
                </div>

                {/* Badge VS Centralizado */}
                <div className="h-9 px-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  VS
                </div>

                {/* Seletor Padronizado Mês Comparado B */}
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-1.5 pr-3 h-11 shadow-sm">
                  <span className="h-8 px-2.5 rounded-lg bg-indigo-500/10 text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center whitespace-nowrap shrink-0">
                    Mês B
                  </span>

                  <div className="relative flex items-center">
                    <select
                      aria-label="Mês Comparado B"
                      value={compareMonthB}
                      onChange={(e) => updatePeriodParams({ compMonthB: Number(e.target.value) })}
                      className="appearance-none bg-transparent text-sm font-semibold text-slate-900 dark:text-zinc-100 focus:outline-none cursor-pointer pl-1.5 pr-6"
                    >
                      {MONTH_NAMES_PT.map((m, idx) => (
                        <option key={m} value={idx + 1} className="bg-white dark:bg-zinc-900">
                          {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                  </div>

                  <span className="h-4 w-px bg-slate-200 dark:bg-zinc-800" />

                  <div className="relative flex items-center">
                    <select
                      aria-label="Ano Comparado B"
                      value={compareYearB}
                      onChange={(e) => updatePeriodParams({ compYearB: Number(e.target.value) })}
                      className="appearance-none bg-transparent text-sm font-semibold tabular-nums text-slate-900 dark:text-zinc-100 focus:outline-none cursor-pointer pl-1 pr-5"
                    >
                      {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
                        <option key={y} value={y} className="bg-white dark:bg-zinc-900">
                          {y}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-0 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                  </div>
                </div>
              </div>
            </div>
  );
}
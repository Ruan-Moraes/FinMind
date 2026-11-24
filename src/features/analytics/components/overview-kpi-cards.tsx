'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';

import { Wallet, CreditCard as CreditCardIcon, TrendingUp, Lock, Pencil } from 'lucide-react';

import { formatCentsToBRL, formatPercent, MONTH_NAMES_PT } from '@/shared/lib/currency';



export function OverviewKpiCards() {
  const { props, wb } = useWorkbench();
  const { selectedMonth, creditCards, staticBaseline, monthSummary } = props;
  const { setActiveTab, hideValues, handleOpenCreateAccountModal, handleOpenEditAccountModal, activeAccounts, totalConsolidatedBalanceInCents, totalOpenInvoicesInCents } = wb;
  return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Saldo Consolidado */}
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/80 p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Saldo em Contas
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        activeAccounts[0]
                          ? handleOpenEditAccountModal(activeAccounts[0])
                          : handleOpenCreateAccountModal()
                      }
                      className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[11px] font-medium text-slate-600 dark:text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 inline-flex items-center gap-1 transition-colors"
                      title="Editar conta bancária ou ajustar saldo"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Editar</span>
                    </button>
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <Wallet className="h-4 w-4" />
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-semibold tabular-nums tracking-tight">
                    {formatCentsToBRL(totalConsolidatedBalanceInCents, hideValues)}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Soma de {activeAccounts.length} contas ativas
                  </p>
                </div>
              </div>

              {/* Card 2: Receitas vs Despesas do Mês */}
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/80 p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Balanço de {MONTH_NAMES_PT[selectedMonth - 1]}
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div
                    className={`text-3xl font-semibold tabular-nums tracking-tight ${
                      monthSummary.netBalanceInCents >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCentsToBRL(monthSummary.netBalanceInCents, hideValues)}
                  </div>
                  <div className="flex items-center gap-3 text-xs mt-1 tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      +{formatCentsToBRL(monthSummary.totalIncomeInCents, hideValues)}
                    </span>
                    <span className="text-rose-600 dark:text-rose-400">
                      -{formatCentsToBRL(monthSummary.totalExpenseInCents, hideValues)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Renda Livre (Ganhos Estáticos - Custos Estáticos) */}
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/80 p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Renda Livre (Estática)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('goals')}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[11px] font-medium text-slate-600 dark:text-zinc-300 hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1 transition-colors"
                      title="Gerenciar ganhos e custos estáticos"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Editar Fixos</span>
                    </button>
                    <div className="h-8 w-8 rounded-lg bg-slate-500/10 text-slate-500 dark:text-zinc-400 flex items-center justify-center">
                      <Lock className="h-4 w-4" />
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-semibold tabular-nums tracking-tight">
                    {formatCentsToBRL(staticBaseline.freeDiscretionaryIncomeInCents, hideValues)}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 tabular-nums">
                    Fixos consomem {formatPercent(staticBaseline.commitmentPercent)} da renda fixa
                  </p>
                </div>
              </div>

              {/* Card 4: Faturas de Cartão no Mês */}
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/80 p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Faturas do Mês
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
                    <CreditCardIcon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-semibold tabular-nums tracking-tight text-rose-600 dark:text-rose-400">
                    {formatCentsToBRL(totalOpenInvoicesInCents, hideValues)}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    {creditCards.length} cartão(ões) monitorados
                  </p>
                </div>
              </div>
            </div>
  );
}
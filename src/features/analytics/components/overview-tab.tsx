'use client';
import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { Target, Plus, Pencil } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { CashFlowBarChart, CategoryDonutChart } from '@/shared/charts/financial-charts';
import { formatCentsToBRL, formatPercent, MONTH_NAMES_PT } from '@/shared/lib/currency';
import { GoalForecastBanner } from '@/features/dashboard/components/workbench-shared-cards';
import { OverviewKpiCards } from '@/features/analytics/components/overview-kpi-cards';
import { MonthHighlightsCard } from '@/features/analytics/components/month-highlights-card';
export function OverviewTab() {
  const { props, wb } = useWorkbench();
  const { selectedMonth, monthSummary, sixMonthsHistory } = props;
  const { hideValues, handleOpenCreateGoalModal, handleOpenEditGoalModal, primaryGoal } = wb;
  return (
    <div className="space-y-6">
      <div data-agent-id="overview.kpis">
        <OverviewKpiCards />
      </div>
            {/* Destaque: Meta de Carteira & Linha de Base Estática */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Meta de Carteira (RF-20 & RF-21) */}
              <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-6 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-emerald-500" />
                      <h2 className="text-lg font-semibold">
                        {primaryGoal ? primaryGoal.title : 'Meta de Carteira / Patrimônio'}
                      </h2>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                      Acompanhamento de proximidade e distância para o objetivo patrimonial
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {primaryGoal && (
                      <Button
                        variant="secondary"
                        size="sm" onClick={() => handleOpenEditGoalModal(primaryGoal)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar Meta
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={handleOpenCreateGoalModal}>
                      <Plus className="h-3.5 w-3.5" />
                      Nova Meta
                    </Button>
                  </div>
                </div>
                {primaryGoal ? (
                  <div className="mt-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5">
                        <span className="text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap block truncate">
                          Patrimônio Líquido Atual
                        </span>
                        <div className="text-xl font-semibold tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">
                          {formatCentsToBRL(primaryGoal.currentNetWorthInCents, hideValues)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5">
                        <span className="text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap block truncate">
                          Meta Alvo ({MONTH_NAMES_PT[primaryGoal.targetMonth - 1]}/{primaryGoal.targetYear})
                        </span>
                        <div className="text-xl font-semibold tabular-nums mt-1">
                          {formatCentsToBRL(primaryGoal.targetAmountInCents, hideValues)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5">
                        <span className="text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap block truncate">
                          Distância Restante (Falta)
                        </span>
                        <div className="text-xl font-semibold tabular-nums mt-1 text-amber-600 dark:text-amber-400">
                          {primaryGoal.isAchieved
                            ? 'Meta Atingida!'
                            : formatCentsToBRL(primaryGoal.remainingDistanceInCents, hideValues)}
                        </div>
                      </div>
                    </div>
                    {/* Barra de Progresso Padronizada */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium tabular-nums">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Quão próximo: {formatPercent(primaryGoal.progressPercent)} concluído
                        </span>
                        <span className="text-slate-500 dark:text-zinc-400">
                          Quão distante: {formatPercent(Math.max(0, 100 - primaryGoal.progressPercent))} restante
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, primaryGoal.progressPercent)}%` }}
                        />
                      </div>
                    </div>
                    {/* Previsão da Meta ("Do jeito que estou indo...") */}
                    <GoalForecastBanner goal={primaryGoal} hideValues={hideValues} />
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-slate-500">
                    Nenhuma meta de carteira cadastrada. Defina sua primeira meta (ex: R$ 7.000,00).
                  </div>
                )}
              </div>
              <MonthHighlightsCard />
            </div>
            {/* Gráficos: Fluxo de Caixa 6 Meses & Distribuição por Categoria */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-6">
                <div className="mb-4">
                  <h3 className="text-base font-semibold">Evolução nos Últimos 6 Meses</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Comparativo histórico de Receitas (Verde) vs Despesas (Vermelho)
                  </p>
                </div>
                <CashFlowBarChart data={sixMonthsHistory} hideValues={hideValues} />
              </div>
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-6">
                <div className="mb-2">
                  <h3 className="text-base font-semibold">Despesas por Categoria</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Distribuição percentual em {MONTH_NAMES_PT[selectedMonth - 1]}
                  </p>
                </div>
                <CategoryDonutChart data={monthSummary.categoryBreakdown} hideValues={hideValues}
                />
                <div className="space-y-2 mt-2 max-h-36 overflow-y-auto pr-1">
                  {monthSummary.categoryBreakdown.map((item) => (
                    <div key={item.categoryId}
                      className="flex items-center justify-between text-xs tabular-nums"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {formatCentsToBRL(item.amountInCents, hideValues)}
                        </span>
                        <span className="text-slate-400 w-12 text-right">
                          {formatPercent(item.percent)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
  );
}
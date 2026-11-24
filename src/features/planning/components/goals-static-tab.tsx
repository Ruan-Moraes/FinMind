'use client';
import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { Target, Plus, Lock, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { formatCentsToBRL, formatPercent, MONTH_NAMES_PT } from '@/shared/lib/currency';
import { deletePortfolioGoalAction } from '@/features/planning/actions/goals-budgets.actions';
import { GoalForecastBanner } from '@/features/dashboard/components/workbench-shared-cards';
import { StaticRulesSection } from '@/features/planning/components/static-rules-section';
import { GoalsBudgetsAndCategoriesSection } from '@/features/planning/components/goals-budgets-and-categories-section';
import { CombinedGoalsPlannerCard } from '@/features/planning/components/combined-goals-planner-card';
import { GoalValueForecastCard } from '@/features/planning/components/goal-value-forecast-card';
export function GoalsStaticTab() {
  const { props, wb } = useWorkbench();
  const { portfolioGoals, staticBaseline, recurrenceRules, transactions, valueForecastItems = [] } = props;
  const { hideValues, setActiveTab, setPendingDelete, handleOpenEditTxModal, handleOpenCreateGoalModal, handleOpenEditGoalModal, handleOpenCreateStaticRuleModal, handleOpenEditStaticRuleModal } = wb;
  return (
          <div className="space-y-6">
            {/* Seção 1: Metas de Carteira (Ex: Ter R$ 7.000 em tal mês) */}
            <div data-agent-id="goals.section.goals" className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-6 space-y-5">
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Target className="h-5 w-5 text-emerald-500 shrink-0" />
                    Metas de Carteira & Patrimônio
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Defina quanto você precisa ter acumulado na carteira em determinado mês e acompanhe o quão próximo ou distante está.
                  </p>
                </div>
                <div className="flex items-center justify-end shrink-0 sm:ml-auto">
                  <Button data-agent-id="goals.btn.create" variant="primary" size="md" onClick={handleOpenCreateGoalModal}>
                    <Plus className="h-4 w-4" />
                    Definir Meta de Carteira
                  </Button>
                </div>
              </div>
              <CombinedGoalsPlannerCard />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {portfolioGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold">{goal.title}</h3>
                          <Badge variant={goal.isAchieved ? 'income' : 'transfer'}>
                            Alvo: {MONTH_NAMES_PT[goal.targetMonth - 1]}/{goal.targetYear}
                          </Badge>
                        </div>
                        {goal.notes && (
                          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                            {goal.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditGoalModal(goal)}
                          className="h-8 w-8 text-slate-400 hover:text-indigo-500"
                          title="Editar meta"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setPendingDelete({
                              title: 'Excluir Meta de Carteira',
                              entityName: goal.title,
                              description:
                                'Tem certeza que deseja excluir esta meta patrimonial? O acompanhamento de progresso desta meta será removido.',
                              confirmLabel: 'Sim, Excluir Meta',
                              onConfirm: () => deletePortfolioGoalAction(goal.id),
                            })
                          }
                          className="h-8 w-8 text-slate-400 hover:text-rose-500"
                          title="Excluir meta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
                      <div className="rounded-xl bg-slate-50 dark:bg-zinc-900 p-3">
                        <span className="text-slate-400 block">Tenho Agora</span>
                        <strong className="text-sm text-emerald-600 dark:text-emerald-400">
                          {formatCentsToBRL(goal.currentNetWorthInCents, hideValues)}
                        </strong>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-zinc-900 p-3">
                        <span className="text-slate-400 block">Meta Alvo</span>
                        <strong className="text-sm">
                          {formatCentsToBRL(goal.targetAmountInCents, hideValues)}
                        </strong>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-zinc-900 p-3">
                        <span className="text-slate-400 block">Distância (Falta)</span>
                        <strong className="text-sm text-amber-600 dark:text-amber-400">
                          {formatCentsToBRL(goal.remainingDistanceInCents, hideValues)}
                        </strong>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap justify-between gap-2 text-xs font-medium tabular-nums">
                        <span>Proximidade: {formatPercent(goal.progressPercent)}</span>
                        <span>
                          Falta: {formatPercent(Math.max(0, 100 - goal.progressPercent))}
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(100, goal.progressPercent)}%` }}
                        />
                      </div>
                    </div>
                    {/* Previsão da Meta ("Do jeito que estou indo...") */}
                    <GoalForecastBanner goal={goal} hideValues={hideValues} />
                    {/* Meta Fictícia com base na aba Previsão de Valor (exibida apenas se houver itens) */}
                    <GoalValueForecastCard
                      goal={goal}
                      forecastItems={valueForecastItems}
                      hideValues={hideValues}
                      onOpenForecastTab={() => setActiveTab('forecast')}
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* Seção 2: Custos Estáticos & Ganhos Estáticos (Inflexíveis) */}
            <div data-agent-id="goals.section.staticRules" className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-6 space-y-5">
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Lock className="h-5 w-5 text-slate-600 dark:text-zinc-300 shrink-0" />
                    Custos Estáticos & Ganhos Estáticos (Linha de Base Fixa)
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Custos que você não consegue diminuir no curto prazo e ganhos fixos garantidos que sempre são calculados no seu orçamento.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 sm:ml-auto">
                  <Button
                    data-agent-id="goals.btn.createIncomeRule"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenCreateStaticRuleModal('INCOME')}
                  >
                    <Plus className="h-3.5 w-3.5 text-emerald-500" />
                    Novo Ganho Estático
                  </Button>
                  <Button
                    data-agent-id="goals.btn.createExpenseRule"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenCreateStaticRuleModal('EXPENSE')}
                  >
                    <Plus className="h-3.5 w-3.5 text-rose-500" />
                    Novo Custo Estático
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 tabular-nums">
                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                      Ganhos Estáticos Mensais
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const firstIncomeRule = recurrenceRules.find((r) => r.type === 'INCOME');
                        const firstStaticIncomeTx = transactions.find(
                          (t) => t.type === 'INCOME' && t.nature === 'STATIC'
                        );
                        if (firstIncomeRule) {
                          handleOpenEditStaticRuleModal(firstIncomeRule);
                        } else if (firstStaticIncomeTx) {
                          handleOpenEditTxModal(firstStaticIncomeTx);
                        } else {
                          handleOpenCreateStaticRuleModal('INCOME');
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar / + Ganho
                    </button>
                  </div>
                  <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCentsToBRL(staticBaseline.staticIncomeInCents, hideValues)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                      Custos Estáticos (Inflexíveis)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const firstExpenseRule = recurrenceRules.find((r) => r.type === 'EXPENSE');
                        const firstStaticExpenseTx = transactions.find(
                          (t) => t.type === 'EXPENSE' && t.nature === 'STATIC'
                        );
                        if (firstExpenseRule) {
                          handleOpenEditStaticRuleModal(firstExpenseRule);
                        } else if (firstStaticExpenseTx) {
                          handleOpenEditTxModal(firstStaticExpenseTx);
                        } else {
                          handleOpenCreateStaticRuleModal('EXPENSE');
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar / + Custo
                    </button>
                  </div>
                  <div className="text-2xl font-semibold text-rose-600 dark:text-rose-400">
                    {formatCentsToBRL(staticBaseline.staticExpenseInCents, hideValues)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex flex-col justify-between gap-2">
                  <span className="text-xs text-slate-500 dark:text-zinc-400">
                    Margem Livre (Ganhos - Custos Fixos)
                  </span>
                  <div className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400">
                    {formatCentsToBRL(staticBaseline.freeDiscretionaryIncomeInCents, hideValues)}
                  </div>
                </div>
              </div>
              <StaticRulesSection />
            </div>
            <GoalsBudgetsAndCategoriesSection />
          </div>
  );
}
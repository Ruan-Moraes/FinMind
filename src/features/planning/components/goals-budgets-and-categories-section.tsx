'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';

import { Plus, Trash2, Pencil, Tag } from 'lucide-react';
import { Button } from '@/shared/ui/button';

import { Badge } from '@/shared/ui/badge';

import { formatCentsToBRL, formatPercent } from '@/shared/lib/currency';
import { CategoryIconBadge } from '@/shared/ui/entity-icons';
import { deleteBudgetAction } from '@/features/planning/actions/goals-budgets.actions';
import { deleteCategoryAction } from '@/features/planning/actions/recurrence-categories.actions';

import { CategoryCardItem } from '@/features/dashboard/components/workbench-shared-cards';

export function GoalsBudgetsAndCategoriesSection() {
  const { props, wb } = useWorkbench();
  const { categories, budgets } = props;
  const { hideValues, setIsBudgetModalOpen, setPendingDelete, handleOpenEditBudgetModal, handleOpenCreateCategoryModal, handleOpenEditCategoryModal } = wb;
  return (
    <>
            {/* Seção 3: Tetos de Orçamento por Categoria (RF-13 & RF-14) */}
            <div data-agent-id="goals.section.budgets" className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-6 space-y-4">
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">Limites de Gastos por Categoria</h2>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Alertas visuais automáticos em 70% (Atenção) e 90%+ (Crítico)
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2.5 shrink-0 sm:ml-auto">
                  <Button
                    data-agent-id="goals.btn.createCategory"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenCreateCategoryModal('EXPENSE')}
                  >
                    + Nova Categoria
                  </Button>
                  <Button
                    data-agent-id="goals.btn.createBudget"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsBudgetModalOpen(true)}
                  >
                    + Definir Limite Mensal
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {budgets.map((b) => {
                  const barColor =
                    b.percent > 90
                      ? 'bg-rose-500'
                      : b.percent > 70
                      ? 'bg-amber-500'
                      : 'bg-emerald-500';
                  return (
                    <div
                      key={b.id}
                      className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3 tabular-nums"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CategoryIconBadge
                            icon={b.categoryIcon}
                            name={b.categoryName}
                            color={b.categoryColor}
                            size="sm"
                          />
                          <span className="font-semibold text-sm truncate">{b.categoryName}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge
                            variant={
                              b.percent > 90 ? 'expense' : b.percent > 70 ? 'warning' : 'income'
                            }
                          >
                            {formatPercent(b.percent)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditBudgetModal(b)}
                            className="h-7 w-7 text-slate-400 hover:text-indigo-500"
                            title="Editar limite mensal"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setPendingDelete({
                                title: 'Excluir Limite de Orçamento',
                                entityName: `Teto de ${b.categoryName}`,
                                description:
                                  'Tem certeza que deseja remover o limite mensal de gastos definido para esta categoria?',
                                confirmLabel: 'Sim, Excluir Limite',
                                onConfirm: () => deleteBudgetAction(b.id),
                              })
                            }
                            className="h-7 w-7 text-slate-400 hover:text-rose-500"
                            title="Excluir limite mensal"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${Math.min(100, b.percent)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500 dark:text-zinc-400">
                        <span>Gasto: {formatCentsToBRL(b.spentInCents, hideValues)}</span>
                        <span>Teto: {formatCentsToBRL(b.maxAmountInCents, hideValues)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Seção 4: Categorias Cadastradas (Gastos & Ganhos) — Totalmente Editáveis */}
            <div data-agent-id="goals.section.categories" className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-6 space-y-4">
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Tag className="h-5 w-5 text-indigo-500 shrink-0" />
                    Categorias de Gastos & Ganhos (Editáveis)
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Edite o nome, o ícone, a cor, o tipo (Despesa ou Receita) e a natureza padrão (Estático ou Variável) de qualquer categoria.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 shrink-0 sm:ml-auto">
                  <Button
                    data-agent-id="goals.btn.createIncomeCategory"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenCreateCategoryModal('INCOME')}
                  >
                    <Plus className="h-3.5 w-3.5 text-emerald-500" />
                    Nova Categoria de Ganho
                  </Button>
                  <Button
                    data-agent-id="goals.btn.createExpenseCategory"
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenCreateCategoryModal('EXPENSE')}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nova Categoria de Gasto
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {categories.map((cat) => (
                  <CategoryCardItem
                    key={cat.id}
                    cat={cat}
                    onEdit={() => handleOpenEditCategoryModal(cat)}
                    onDelete={() =>
                      setPendingDelete({
                        title: 'Excluir Categoria',
                        entityName: cat.name,
                        description:
                          'Tem certeza que deseja excluir esta categoria? Os lançamentos já cadastrados não serão perdidos, apenas ficarão sem categoria vinculada.',
                        confirmLabel: 'Sim, Excluir Categoria',
                        onConfirm: () => deleteCategoryAction(cat.id),
                      })
                    }
                  />
                ))}
              </div>
            </div>
    </>
  );
}
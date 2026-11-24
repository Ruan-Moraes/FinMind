'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';

import { Wallet, Plus, Trash2, Pencil, Tag } from 'lucide-react';
import { Button } from '@/shared/ui/button';

import { formatCentsToBRL } from '@/shared/lib/currency';
import { AccountIconBadge } from '@/shared/ui/entity-icons';
import { archiveOrDeleteAccountAction } from '@/features/accounts/actions/accounts.actions';
import { deleteCategoryAction } from '@/features/planning/actions/recurrence-categories.actions';

import { CategoryCardItem } from '@/features/dashboard/components/workbench-shared-cards';
import { CreditCardsSection } from '@/features/credit-cards/components/credit-cards-section';

export function AccountsCardsTab() {
  const { props, wb } = useWorkbench();
  const { categories } = props;
  const { hideValues, setPendingDelete, handleOpenCreateAccountModal, handleOpenEditAccountModal, handleOpenCreateCategoryModal, handleOpenEditCategoryModal, activeAccounts } = wb;
  return (
          <div className="space-y-6">
            {/* Contas Bancárias e Dinheiro */}
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-6 space-y-4">
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-emerald-500 shrink-0" />
                    Contas Bancárias & Carteira em Mãos
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Edite o nome, tipo, cor ou ajuste diretamente o saldo consolidado de qualquer conta
                  </p>
                </div>
                <div className="flex items-center justify-end shrink-0 sm:ml-auto">
                  <Button data-agent-id="accounts.btn.createAccount" variant="primary" size="md" onClick={handleOpenCreateAccountModal}>
                    <Plus className="h-4 w-4" />
                    Nova Conta
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {activeAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <AccountIconBadge type={acc.type} color={acc.color} size="lg" />
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">{acc.name}</h3>
                          <span className="text-xs text-slate-400 block">
                            {acc.type === 'CHECKING'
                              ? 'Conta Corrente'
                              : acc.type === 'SAVINGS'
                              ? 'Poupança / Reserva'
                              : 'Dinheiro Físico'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditAccountModal(acc)}
                          className="h-8 w-8 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-800 flex items-center justify-center transition-colors"
                          title="Editar conta bancária e ajustar saldo"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              title: 'Excluir ou Arquivar Conta Bancária',
                              entityName: acc.name,
                              description:
                                'Tem certeza que deseja remover esta conta? Se ela já possuir movimentações históricas vinculadas, será arquivada com segurança; caso contrário, será excluída definitivamente.',
                              confirmLabel: 'Sim, Remover Conta',
                              onConfirm: () => archiveOrDeleteAccountAction(acc.id),
                            })
                          }
                          className="h-8 w-8 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 flex items-center justify-center transition-colors"
                          title="Arquivar ou excluir conta"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="tabular-nums space-y-2">
                      <div>
                        <span className="text-xs text-slate-400">Saldo Consolidado Atual</span>
                        <div className="text-2xl font-semibold mt-0.5">
                          {formatCentsToBRL(acc.currentBalanceInCents, hideValues)}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-900 flex items-center justify-between text-xs text-slate-400">
                        <span>
                          Saldo inicial: {formatCentsToBRL(acc.initialBalanceInCents, hideValues)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEditAccountModal(acc)}
                          className="text-indigo-500 hover:underline font-medium inline-flex items-center gap-1"
                        >
                          <Pencil className="h-3 w-3" />
                          Editar Saldo
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <CreditCardsSection />
            {/* Categorias Cadastradas (Atalho também na aba Contas & Cartões) */}
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-6 space-y-4">
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Tag className="h-5 w-5 text-indigo-500 shrink-0" />
                    Categorias Cadastradas (Gastos & Ganhos)
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Gerencie e edite todas as categorias vinculadas às suas contas e cartões
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 shrink-0 sm:ml-auto">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenCreateCategoryModal('INCOME')}
                  >
                    <Plus className="h-3.5 w-3.5 text-emerald-500" />
                    Nova de Ganho
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenCreateCategoryModal('EXPENSE')}
                  >
                    <Plus className="h-3.5 w-3.5 text-rose-500" />
                    Nova de Gasto
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {categories.map((cat) => (
                  <CategoryCardItem
                    key={`acc-cat-${cat.id}`}
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
          </div>
  );
}
'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';

import { Paperclip, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/shared/ui/button';

import { TransactionCategoryCell } from '@/features/transactions/components/transaction-category-cell';

import { formatCentsToBRL } from '@/shared/lib/currency';
import { CategoryIconBadge } from '@/shared/ui/entity-icons';
import { deleteTransactionAction } from '@/features/transactions/actions/transactions-manage.actions';



export function TransactionsMobileCards() {
  const { wb } = useWorkbench();
  const { hideValues, setPreviewAttachment, setPendingDelete, handleOpenEditTxModal, filteredTransactions } = wb;
  return (
            <div className="md:hidden space-y-2.5 tabular-nums">
              {filteredTransactions.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-xs text-slate-400">
                  Nenhum lançamento encontrado para os filtros selecionados.
                </div>
              ) : (
                filteredTransactions.map((tx) => (
                  <div
                    key={`mob-tx-${tx.id}`}
                    className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CategoryIconBadge
                          icon={tx.categoryIcon}
                          name={tx.categoryName || tx.description}
                          color={
                            tx.categoryColor ||
                            (tx.type === 'INCOME'
                              ? '#10b981'
                              : tx.type === 'EXPENSE'
                              ? '#f43f5e'
                              : '#6366f1')
                          }
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-slate-900 dark:text-zinc-100 truncate">
                            {tx.description}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                            {new Date(tx.date).toLocaleDateString('pt-BR')} •{' '}
                            {tx.creditCardName
                              ? `Cartão ${tx.creditCardName}`
                              : tx.sourceAccountName || 'Conta'}
                            {tx.paymentMethod ? ` (${tx.paymentMethod})` : ''}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`text-sm font-semibold shrink-0 ${
                          tx.type === 'INCOME'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.type === 'EXPENSE'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-indigo-500'
                        }`}
                      >
                        {tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '-' : ''}
                        {formatCentsToBRL(tx.amountInCents, hideValues)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                      <TransactionCategoryCell
                        categoryName={tx.categoryName}
                        categoryColor={tx.categoryColor}
                        nature={tx.nature}
                        isUserConfirmed={tx.isUserConfirmed}
                        isAiClassified={tx.isAiClassified}
                        layout="inline"
                      />

                      <div className="flex items-center gap-1">
                        {tx.attachments.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPreviewAttachment(tx.attachments[0])}
                            className="h-7 w-7 text-indigo-500"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditTxModal(tx)}
                          className="h-7 w-7 text-slate-400 hover:text-indigo-500"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setPendingDelete({
                              title: 'Excluir Lançamento Financeiro',
                              entityName: `${tx.description} (${formatCentsToBRL(
                                tx.amountInCents,
                                false
                              )})`,
                              description: tx.installmentGroupId
                                ? 'Este lançamento faz parte de um parcelamento. Ao confirmar, todas as parcelas vinculadas também serão excluídas.'
                                : 'Tem certeza que deseja excluir este lançamento?',
                              confirmLabel: 'Sim, Excluir Lançamento',
                              onConfirm: () =>
                                deleteTransactionAction(tx.id, Boolean(tx.installmentGroupId)),
                            })
                          }
                          className="h-7 w-7 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
  );
}
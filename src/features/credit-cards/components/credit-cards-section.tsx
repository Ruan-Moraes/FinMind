'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';

import { CreditCard as CreditCardIcon, Plus, Trash2, CheckCircle2, Pencil } from 'lucide-react';
import { Button } from '@/shared/ui/button';

import { Badge } from '@/shared/ui/badge';

import { formatCentsToBRL, formatPercent, MONTH_NAMES_PT } from '@/shared/lib/currency';

import { deleteCreditCardAction } from '@/features/credit-cards/actions/credit-cards.actions';



export function CreditCardsSection() {
  const { props, wb } = useWorkbench();
  const { selectedMonth, creditCards } = props;
  const { hideValues, setIsPayInvoiceModalOpen, setPendingDelete, handleOpenCreateCardModal, handleOpenEditCardModal } = wb;
  return (
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-6 space-y-4">
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <CreditCardIcon className="h-5 w-5 text-indigo-500 shrink-0" />
                    Cartões de Crédito & Ciclo de Faturas
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Controle e edite limite disponível, dia de fechamento, vencimento e parcelamentos
                  </p>
                </div>
                <div className="flex items-center justify-end shrink-0 sm:ml-auto">
                  <Button variant="secondary" size="md" onClick={handleOpenCreateCardModal}>
                    <Plus className="h-4 w-4" />
                    Novo Cartão
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {creditCards.map((card) => {
                  const usedPct =
                    card.limitInCents > 0 ? (card.usedLimitInCents / card.limitInCents) * 100 : 0;
                  return (
                    <div
                      key={card.id}
                      className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4 tabular-nums shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="h-11 w-11 rounded-xl border flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: `${card.color}18`,
                              borderColor: `${card.color}38`,
                              color: card.color,
                            }}
                          >
                            <CreditCardIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-base">{card.name}</h3>
                              <Badge variant="neutral">{card.brand}</Badge>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            variant={card.currentInvoiceStatus === 'PAID' ? 'income' : 'warning'}
                          >
                            Fatura {MONTH_NAMES_PT[selectedMonth - 1]}:{' '}
                            {card.currentInvoiceStatus === 'PAID' ? 'Paga' : 'Aberta'}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => handleOpenEditCardModal(card)}
                            className="h-8 w-8 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-800 flex items-center justify-center transition-colors"
                            title="Editar cartão de crédito"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingDelete({
                                title: 'Excluir Cartão de Crédito',
                                entityName: `${card.name} (${card.brand})`,
                                description:
                                  'Tem certeza que deseja excluir este cartão de crédito e suas faturas associadas?',
                                confirmLabel: 'Sim, Excluir Cartão',
                                onConfirm: () => deleteCreditCardAction(card.id),
                              })
                            }
                            className="h-8 w-8 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 flex items-center justify-center transition-colors"
                            title="Excluir cartão de crédito"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-50 dark:bg-zinc-900 p-3">
                          <span className="text-slate-400 block">Fatura do Mês</span>
                          <strong className="text-sm text-rose-600 dark:text-rose-400">
                            {formatCentsToBRL(card.currentInvoiceInCents, hideValues)}
                          </strong>
                        </div>
                        <div className="rounded-xl bg-slate-50 dark:bg-zinc-900 p-3">
                          <span className="text-slate-400 block">Limite Disponível</span>
                          <strong className="text-sm text-emerald-600 dark:text-emerald-400">
                            {formatCentsToBRL(card.availableLimitInCents, hideValues)}
                          </strong>
                        </div>
                        <div className="rounded-xl bg-slate-50 dark:bg-zinc-900 p-3">
                          <span className="text-slate-400 block">Limite Total</span>
                          <strong className="text-sm">
                            {formatCentsToBRL(card.limitInCents, hideValues)}
                          </strong>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>Limite comprometido (incluindo parcelas futuras)</span>
                          <span>{formatPercent(usedPct)}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${Math.min(100, usedPct)}%` }}
                          />
                        </div>
                      </div>

                      {card.currentInvoiceInCents > 0 && card.currentInvoiceStatus !== 'PAID' && (
                        <div className="pt-2 flex justify-end">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setIsPayInvoiceModalOpen(card)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Pagar Fatura ({formatCentsToBRL(card.currentInvoiceInCents, hideValues)})
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
  );
}
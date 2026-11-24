'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';

import { Paperclip, Trash2, Search, Pencil, Download } from 'lucide-react';
import { Button } from '@/shared/ui/button';

import { Input, Select } from '@/shared/ui/input';
import { TransactionCategoryCell } from '@/features/transactions/components/transaction-category-cell';

import { formatCentsToBRL } from '@/shared/lib/currency';
import { CategoryIconBadge } from '@/shared/ui/entity-icons';
import { deleteTransactionAction } from '@/features/transactions/actions/transactions-manage.actions';


import { TransactionsMobileCards } from '@/features/transactions/components/transactions-mobile-cards';

export function TransactionsTab() {
  const { props, wb } = useWorkbench();
  const { categories, selectedMonth, selectedYear } = props;
  const { hideValues, setPreviewAttachment, setPendingDelete, searchQuery, setSearchQuery, filterType, setFilterType, filterNature, setFilterNature, filterCategoryId, setFilterCategoryId, handleOpenEditTxModal, filteredTransactions, cellPadding, headerCellPadding } = wb;
  return (
          <div className="space-y-5">
            {/* Barra de Filtros Padronizada */}
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
              <div className="relative" data-agent-id="transactions.filter.search">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
                <Input
                  placeholder="Buscar descrição ou #tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div data-agent-id="transactions.filter.type">
                <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="ALL">Todos os Tipos</option>
                  <option value="EXPENSE">Apenas Despesas</option>
                  <option value="INCOME">Apenas Receitas</option>
                  <option value="TRANSFER">Transferências</option>
                </Select>
              </div>

              <div data-agent-id="transactions.filter.nature">
                <Select value={filterNature} onChange={(e) => setFilterNature(e.target.value)}>
                  <option value="ALL">Estáticos + Variáveis</option>
                  <option value="STATIC">Apenas Custos/Ganhos Estáticos</option>
                  <option value="VARIABLE">Apenas Variáveis</option>
                </Select>
              </div>

              <div data-agent-id="transactions.filter.category">
                <Select
                  value={filterCategoryId}
                  onChange={(e) => setFilterCategoryId(e.target.value)}
                >
                  <option value="ALL">Todas as Categorias</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <a
                href={`/api/export?format=csv&month=${selectedMonth}&year=${selectedYear}`}
                download
                className="inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap leading-none transition-all duration-150 border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 h-10 px-4 text-xs"
              >
                <Download className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Exportar CSV</span>
              </a>
            </div>
            <div data-agent-id="transactions.table">
              <TransactionsMobileCards />
              {/* Tabela Desktop de Lançamentos */}
              <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="text-[11px] font-medium uppercase tracking-wider bg-slate-50 dark:bg-zinc-950/60 text-slate-400 dark:text-zinc-500 border-b border-slate-200 dark:border-zinc-800">
                    <tr>
                      <th className={`${headerCellPadding} align-middle text-left whitespace-nowrap`}>Data</th>
                      <th className={`${headerCellPadding} align-middle text-left`}>Descrição & Enriquecimento</th>
                      <th className={`${headerCellPadding} align-middle text-left`}>Categoria / Natureza</th>
                      <th className={`${headerCellPadding} align-middle text-left`}>Meio de Pagamento</th>
                      <th className={`${headerCellPadding} align-middle text-right whitespace-nowrap`}>Valor</th>
                      <th className={`${headerCellPadding} align-middle text-center w-[1%] whitespace-nowrap`}>Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-zinc-800 tabular-nums">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-10 text-center text-slate-400 dark:text-zinc-500"
                        >
                          Nenhum lançamento encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className={`${cellPadding} align-middle whitespace-nowrap text-xs text-slate-500`}>
                            {new Date(tx.date).toLocaleDateString('pt-BR')}
                          </td>
                          <td className={`${cellPadding} align-middle`}>
                            <div className="flex items-center gap-2.5">
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
                              <div>
                                <div className="font-medium text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                                  {tx.description}
                                  {tx.attachments.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewAttachment(tx.attachments[0])}
                                      className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:underline"
                                      title="Visualizar comprovante anexado"
                                    >
                                      <Paperclip className="h-3.5 w-3.5" />
                                      Recibo
                                    </button>
                                  )}
                                </div>
                                {(tx.counterparty || tx.purpose || tx.tags) && (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">
                                    {tx.counterparty && (
                                      <span>{tx.counterparty}</span>
                                    )}
                                    {tx.purpose && (
                                      <span>• {tx.purpose}</span>
                                    )}
                                    {tx.tags &&
                                      tx.tags
                                        .split(',')
                                        .filter(Boolean)
                                        .map((t) => (
                                          <span key={t}>#{t.trim()}</span>
                                        ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={`${cellPadding} align-middle`}>
                            <TransactionCategoryCell
                              categoryName={tx.categoryName}
                              categoryColor={tx.categoryColor}
                              nature={tx.nature}
                              isUserConfirmed={tx.isUserConfirmed}
                              isAiClassified={tx.isAiClassified}
                            />
                          </td>
                          <td className={`${cellPadding} align-middle text-xs text-slate-500 dark:text-zinc-400`}>
                            <div>
                              {tx.creditCardName
                                ? `Cartão: ${tx.creditCardName}`
                                : tx.type === 'TRANSFER'
                                ? `${tx.sourceAccountName || 'Origem'} → ${
                                    tx.destinationAccountName || 'Destino'
                                  }`
                                : tx.sourceAccountName || 'Conta'}
                            </div>
                            {tx.paymentMethod && (
                              <div className="text-[11px] text-slate-400">
                                Meio: {tx.paymentMethod}
                              </div>
                            )}
                          </td>
                          <td
                            className={`${cellPadding} align-middle text-right font-semibold whitespace-nowrap ${
                              tx.type === 'INCOME'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : tx.type === 'EXPENSE'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-indigo-500'
                            }`}
                          >
                            {tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '-' : ''}
                            {formatCentsToBRL(tx.amountInCents, hideValues)}
                          </td>
                          <td className={`${cellPadding} align-middle text-center w-[1%] whitespace-nowrap`}>
                            <div className="inline-flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditTxModal(tx)}
                                className="h-8 w-8 text-slate-400 hover:text-indigo-500"
                                title="Editar lançamento"
                              >
                                <Pencil className="h-4 w-4" />
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
                                      ? 'Este lançamento faz parte de um parcelamento. Ao confirmar, todas as parcelas vinculadas também serão excluídas e o saldo/limite será recalculado.'
                                      : 'Tem certeza que deseja excluir este lançamento? O saldo da conta ou fatura do cartão será atualizado imediatamente.',
                                    confirmLabel: 'Sim, Excluir Lançamento',
                                    onConfirm: () =>
                                      deleteTransactionAction(
                                        tx.id,
                                        Boolean(tx.installmentGroupId)
                                      ),
                                  })
                                }
                                className="h-8 w-8 text-slate-400 hover:text-rose-500"
                                title="Excluir lançamento"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          </div>
  );
}
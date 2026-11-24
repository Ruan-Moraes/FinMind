'use client';

import * as React from 'react';
import { Receipt, Pencil, Trash2 } from 'lucide-react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { formatCentsToBRL } from '@/shared/lib/currency';
import { CategoryIconBadge } from '@/shared/ui/entity-icons';
import { deleteTransactionAction } from '@/features/transactions/actions/transactions-manage.actions';

export function StaticPaidTxTable() {
  const { props, wb } = useWorkbench();
  const { transactions } = props;
  const { hideValues, setPendingDelete, handleOpenEditTxModal } = wb;

  const staticTxs = transactions.filter((tx) => tx.nature === 'STATIC');
  if (staticTxs.length === 0) return null;

  const totalExpense = staticTxs
    .filter((t) => t.type === 'EXPENSE')
    .reduce((acc, t) => acc + t.amountInCents, 0);
  const totalIncome = staticTxs
    .filter((t) => t.type === 'INCOME')
    .reduce((acc, t) => acc + t.amountInCents, 0);

  return (
    <div className="hidden md:block rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50/80 dark:bg-zinc-900/70 border-b border-slate-200 dark:border-zinc-800">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-zinc-100">
            <Receipt className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>Lançamentos Fixos Já Caídos no Mês (Extrato)</span>
            <Badge variant="neutral">{staticTxs.length}</Badge>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            Movimentações reais do extrato marcadas como fixas — exibidas separadamente para não somar em dobro com as regras mensais acima.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs tabular-nums">
          {totalIncome > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              +{formatCentsToBRL(totalIncome, hideValues)}
            </span>
          )}
          {totalExpense > 0 && (
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              −{formatCentsToBRL(totalExpense, hideValues)}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-[11px] font-medium uppercase tracking-wider bg-slate-50/50 dark:bg-zinc-900/35 text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800/80">
            <tr>
              <th className="py-2.5 px-5 align-middle text-left">Descrição</th>
              <th className="py-2.5 px-4 align-middle text-left">Categoria / Conta</th>
              <th className="py-2.5 px-4 align-middle text-left whitespace-nowrap">Tipo</th>
              <th className="py-2.5 px-4 align-middle text-left whitespace-nowrap">Data no Extrato</th>
              <th className="py-2.5 px-4 align-middle text-right whitespace-nowrap">Valor</th>
              <th className="py-2.5 px-5 align-middle text-center w-[1%] whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70 tabular-nums">
            {staticTxs.map((tx) => (
              <tr
                key={`static-tx-${tx.id}`}
                className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/50 transition-colors"
              >
                <td className="py-3.5 px-5 align-middle font-medium">
                  <div className="flex items-center gap-3">
                    <CategoryIconBadge
                      icon={tx.categoryIcon}
                      name={tx.categoryName || tx.description}
                      color={
                        tx.categoryColor || (tx.type === 'INCOME' ? '#10b981' : '#f43f5e')
                      }
                      size="sm"
                    />
                    <span>{tx.description}</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 align-middle text-xs text-slate-500 dark:text-zinc-400">
                  {[
                    tx.categoryName,
                    tx.creditCardName ? `Cartão ${tx.creditCardName}` : tx.sourceAccountName,
                  ]
                    .filter(Boolean)
                    .join(' • ') || 'Conta'}
                </td>
                <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                  <Badge variant={tx.type === 'INCOME' ? 'income' : 'expense'}>
                    {tx.type === 'INCOME' ? 'Ganho Real' : 'Gasto Real'}
                  </Badge>
                </td>
                <td className="py-3.5 px-4 align-middle whitespace-nowrap text-xs text-slate-600 dark:text-zinc-300">
                  {new Date(tx.date).toLocaleDateString('pt-BR')}
                </td>
                <td
                  className={`py-3.5 px-4 align-middle text-right whitespace-nowrap font-semibold ${
                    tx.type === 'INCOME'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {tx.type === 'INCOME' ? '+' : '-'}
                  {formatCentsToBRL(tx.amountInCents, hideValues)}
                </td>
                <td className="py-3.5 px-5 align-middle text-center w-[1%] whitespace-nowrap">
                  <div className="inline-flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEditTxModal(tx)}
                      className="h-8 w-8 text-slate-400 hover:text-indigo-500"
                      title="Editar lançamento estático"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setPendingDelete({
                          title: 'Excluir Lançamento Estático',
                          entityName: `${tx.description} (${formatCentsToBRL(
                            tx.amountInCents,
                            false
                          )})`,
                          description: tx.installmentGroupId
                            ? 'Este lançamento faz parte de um parcelamento. Ao confirmar, todas as parcelas vinculadas também serão excluídas e o saldo/limite será recalculado.'
                            : 'Tem certeza que deseja excluir este lançamento estático? O saldo da conta ou fatura será recalculado imediatamente.',
                          confirmLabel: 'Sim, Excluir Lançamento',
                          onConfirm: () =>
                            deleteTransactionAction(tx.id, Boolean(tx.installmentGroupId)),
                        })
                      }
                      className="h-8 w-8 text-slate-400 hover:text-rose-500"
                      title="Excluir lançamento estático"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

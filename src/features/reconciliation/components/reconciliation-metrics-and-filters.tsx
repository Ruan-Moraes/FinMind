'use client';
import * as React from 'react';
import { TrendingUp, TrendingDown, Link2, Plus, AlertTriangle, Layers, CheckCircle2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { formatCentsToBRL } from '@/shared/lib/currency';
import type { ReconciledStatementItem, StatementImportReviewPlan } from '@/features/reconciliation/engine';
import type { ReviewFilterTab } from '@/features/reconciliation/components/reconciliation-ui-helpers';
import { ReconciledMovementCard } from '@/features/reconciliation/components/reconciled-movement-card';
export function ReconciliationMetricsAndFilters(props: {
  reviewPlan: StatementImportReviewPlan;
  reviewItems: ReconciledStatementItem[];
  filteredReviewItems: ReconciledStatementItem[];
  selectedItemsForConfirm: ReconciledStatementItem[];
  selectedIncomesCents: number;
  selectedExpensesCents: number;
  selectedReconciledCount: number;
  selectedNewCount: number;
  activeFilter: ReviewFilterTab;
  setActiveFilter: (tab: ReviewFilterTab) => void;
  setReviewItems: React.Dispatch<React.SetStateAction<ReconciledStatementItem[]>>;
  setIsConfirmModalOpen: (open: boolean) => void;
  hideValues: boolean;
  categories: Array<{ id: string; name: string }>;
  recurrenceRules: Array<{ id: string; description: string; amountInCents: number }>;
  existingTransactions: Array<{ id: string; description: string; amountInCents: number; date: string; status: string }>;
  handleUpdateReviewItem: (itemId: string, patch: Partial<ReconciledStatementItem>) => void;
  handleChangeReconciliationLink: (itemId: string, val: string) => void;
}) {
  const {
    reviewPlan, reviewItems, filteredReviewItems, selectedItemsForConfirm,
    selectedIncomesCents, selectedExpensesCents, selectedReconciledCount, selectedNewCount,
    activeFilter, setActiveFilter, setReviewItems, setIsConfirmModalOpen, hideValues,
    categories, recurrenceRules, existingTransactions, handleUpdateReviewItem, handleChangeReconciliationLink,
  } = props;
  return (
        <div className="space-y-5 pt-2 border-t border-slate-200 dark:border-zinc-800">
          {/* Cards de Métricas do Lote */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 tabular-nums">
            <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3">
              <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" /> Receitas Identificadas
              </div>
              <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                +{formatCentsToBRL(selectedIncomesCents, hideValues)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                {reviewPlan.summary.identifiedIncomesCount} entrada(s)
              </div>
            </div>
            <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-3">
              <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400 flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5" /> Despesas Identificadas
              </div>
              <div className="text-sm font-bold text-rose-700 dark:text-rose-300 mt-1">
                -{formatCentsToBRL(selectedExpensesCents, hideValues)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                {reviewPlan.summary.identifiedExpensesCount} saída(s)
              </div>
            </div>
            <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 p-3">
              <div className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5" /> Conciliados com Existentes
              </div>
              <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mt-1">
                {selectedReconciledCount} lançamento(s)
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                Fixos, previstos e faturas
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
              <div className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Novos Lançamentos
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-zinc-100 mt-1">
                {selectedNewCount} novo(s)
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                Classificados pela IA
              </div>
            </div>
            <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-3">
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Precisam de Revisão
              </div>
              <div className="text-sm font-bold text-amber-700 dark:text-amber-300 mt-1">
                {
                  reviewItems.filter(
                    (i) =>
                      i.decisionType !== 'SKIP_DUPLICATE' &&
                      (i.requiresUserAttention || i.confidenceLevel !== 'HIGH')
                  ).length
                }{' '}
                item(ns)
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                Média ou baixa confiança
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
              <div className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" /> Duplicados Ignorados
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-zinc-100 mt-1">
                {reviewPlan.summary.duplicatesCount} item(ns)
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                Proteção anti-duplicação
              </div>
            </div>
          </div>
          {/* Barra de Filtros e Ações em Lote */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: `Todas (${reviewItems.length})` },
                  {
                    id: 'RECONCILED',
                    label: `Conciliadas (${
                      reviewItems.filter(
                        (i) =>
                          i.decisionType === 'RECONCILE_RULE' ||
                          i.decisionType === 'RECONCILE_TRANSACTION' ||
                          i.decisionType === 'PAY_CREDIT_CARD_INVOICE'
                      ).length
                    })`,
                  },
                  {
                    id: 'NEW',
                    label: `Novos (${
                      reviewItems.filter((i) => i.decisionType === 'CREATE_NEW').length
                    })`,
                  },
                  {
                    id: 'NEEDS_REVIEW',
                    label: `Revisão Necessária (${
                      reviewItems.filter(
                        (i) =>
                          i.decisionType !== 'SKIP_DUPLICATE' &&
                          (i.requiresUserAttention || i.confidenceLevel !== 'HIGH')
                      ).length
                    })`,
                  },
                  {
                    id: 'INCOME',
                    label: `Receitas (${
                      reviewItems.filter(
                        (i) => i.type === 'INCOME' && i.decisionType !== 'SKIP_DUPLICATE'
                      ).length
                    })`,
                  },
                  {
                    id: 'EXPENSE',
                    label: `Despesas (${
                      reviewItems.filter(
                        (i) => i.type === 'EXPENSE' && i.decisionType !== 'SKIP_DUPLICATE'
                      ).length
                    })`,
                  },
                  {
                    id: 'DUPLICATES',
                    label: `Duplicadas (${
                      reviewItems.filter((i) => i.decisionType === 'SKIP_DUPLICATE').length
                    })`,
                  },
                ] as Array<{ id: ReviewFilterTab; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    activeFilter === tab.id
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-white dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setReviewItems((prev) =>
                    prev.map((i) => ({
                      ...i,
                      selectedForImport:
                        i.decisionType !== 'SKIP_DUPLICATE' && i.confidenceLevel === 'HIGH',
                    }))
                  )
                }
              >
                Selecionar Apenas Alta Confiança
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setReviewItems((prev) =>
                    prev.map((i) => ({
                      ...i,
                      selectedForImport: i.decisionType !== 'SKIP_DUPLICATE',
                    }))
                  )
                }
              >
                Selecionar Todos Não-Duplicados
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={selectedItemsForConfirm.length === 0}
                onClick={() => setIsConfirmModalOpen(true)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Revisar Resumo & Confirmar ({selectedItemsForConfirm.length})
              </Button>
            </div>
          </div>
          {/* Lista Detalhada de Movimentações com Explicabilidade da IA */}
          <div className="space-y-3">
            {filteredReviewItems.map((item) => (
              <ReconciledMovementCard
                key={item.itemId}
                item={item}
                hideValues={hideValues}
                categories={categories}
                recurrenceRules={recurrenceRules}
                existingTransactions={existingTransactions}
                handleUpdateReviewItem={handleUpdateReviewItem}
                handleChangeReconciliationLink={handleChangeReconciliationLink}
              />
            ))}
          </div>
        </div>
  );
}
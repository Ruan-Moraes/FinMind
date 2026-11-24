'use client';
import * as React from 'react';
import { RotateCcw, Check } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';
import { formatCentsToBRL } from '@/shared/lib/currency';
import type { ReconciledStatementItem, StatementImportReviewPlan } from '@/features/reconciliation/engine';
import type { SerializedImportBatch } from '@/features/reconciliation/components/statement-reconciliation-workbench';
import { ImportBatchesHistoryList } from '@/features/reconciliation/components/import-batches-history-list';
export function ImportBatchesHistoryAndModals(props: {
  importBatches: SerializedImportBatch[];
  isConfirmModalOpen: boolean;
  setIsConfirmModalOpen: (open: boolean) => void;
  isCommitting: boolean;
  handleConfirmBatchImport: () => void;
  selectedIncomesCents: number;
  selectedExpensesCents: number;
  selectedItemsForConfirm: ReconciledStatementItem[];
  selectedReconciledCount: number;
  selectedNewCount: number;
  reviewItems: ReconciledStatementItem[];
  targetType: 'ACCOUNT' | 'CREDIT_CARD';
  reviewPlan: StatementImportReviewPlan | null;
  calibrateBalanceFromStatement: boolean;
  setCalibrateBalanceFromStatement: (v: boolean) => void;
  pendingRevertBatch: SerializedImportBatch | null;
  setPendingRevertBatch: (b: SerializedImportBatch | null) => void;
  isReverting: boolean;
  handleConfirmRevertBatch: () => void;
  hideValues: boolean;
}) {
  const {
    importBatches, isConfirmModalOpen, setIsConfirmModalOpen, isCommitting,
    handleConfirmBatchImport, selectedIncomesCents, selectedExpensesCents,
    selectedItemsForConfirm, selectedReconciledCount, selectedNewCount, reviewItems,
    targetType, reviewPlan, calibrateBalanceFromStatement, setCalibrateBalanceFromStatement,
    pendingRevertBatch, setPendingRevertBatch, isReverting, handleConfirmRevertBatch, hideValues,
  } = props;
  return (
    <>
      <ImportBatchesHistoryList
        importBatches={importBatches}
        onRequestRevert={setPendingRevertBatch}
      />
      {/* =====================================================================
          MODAL DE RESUMO PRÉ-CONFIRMAÇÃO (SEÇÃO 8.4)
         ===================================================================== */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          if (!isCommitting) setIsConfirmModalOpen(false);
        }}
        title="Confirmar Importação e Conciliação Financeira"
        subtitle="Revise o resumo consolidado antes de confirmar os lançamentos no seu extrato."
        footer={
          <>
            <Button
              variant="secondary"
              type="button"
              disabled={isCommitting}
              onClick={() => setIsConfirmModalOpen(false)}
            >
              Voltar para Revisão
            </Button>
            <Button
              variant="primary"
              type="button"
              isLoading={isCommitting}
              onClick={handleConfirmBatchImport}
            >
              <Check className="h-4 w-4" />
              Confirmar e Atualizar Dados Financeiros
            </Button>
          </>
        }
      >
        <div className="space-y-4 tabular-nums">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 p-3">
              <div className="text-xs text-emerald-700 dark:text-emerald-400">
                Total de Entradas a Registrar
              </div>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                +{formatCentsToBRL(selectedIncomesCents, hideValues)}
              </div>
            </div>
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 p-3">
              <div className="text-xs text-rose-700 dark:text-rose-400">
                Total de Saídas a Registrar
              </div>
              <div className="text-base font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                -{formatCentsToBRL(selectedExpensesCents, hideValues)}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Movimentações selecionadas:</span>
              <span className="font-semibold">{selectedItemsForConfirm.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Obrigações fixas / previstas conciliadas:</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {selectedReconciledCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Novos lançamentos classificados:</span>
              <span className="font-semibold">{selectedNewCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Duplicadas / descartadas ignoradas:</span>
              <span className="font-semibold">
                {reviewItems.length - selectedItemsForConfirm.length}
              </span>
            </div>
          </div>
          {targetType === 'ACCOUNT' &&
            reviewPlan?.files.some(
              (f) => f.closingBalanceInCents !== null && f.closingBalanceInCents !== undefined
            ) && (
              <label className="flex items-start gap-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-3 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={calibrateBalanceFromStatement}
                  onChange={(e) => setCalibrateBalanceFromStatement(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                  <strong>Calibrar saldo da conta pelo saldo final oficial do extrato:</strong>{' '}
                  ajusta a base da conta considerando apenas lançamentos até a data final do extrato para que o saldo bata exatamente com o banco.
                </span>
              </label>
            )}
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Suas confirmações e correções serão aprendidas automaticamente pelo motor de conciliação para futuras importações. Você poderá reverter este lote a qualquer momento no histórico de auditoria.
          </p>
        </div>
      </Modal>
      {/* =====================================================================
          MODAL DE REVERSÃO CONTROLADA DE IMPORTAÇÃO (SEÇÃO 12)
         ===================================================================== */}
      <Modal
        isOpen={Boolean(pendingRevertBatch)}
        onClose={() => {
          if (!isReverting) setPendingRevertBatch(null);
        }}
        title="Reverter Lote de Importação"
        subtitle="Esta ação desfaz todas as alterações financeiras realizadas por este lote."
        footer={
          <>
            <Button
              variant="secondary"
              type="button"
              disabled={isReverting}
              onClick={() => setPendingRevertBatch(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              type="button"
              isLoading={isReverting}
              onClick={handleConfirmRevertBatch}
            >
              <RotateCcw className="h-4 w-4" />
              Confirmar Reversão
            </Button>
          </>
        }
      >
        {pendingRevertBatch && (
          <div className="space-y-3 text-xs text-slate-600 dark:text-zinc-300">
            <p>
              Você está prestes a reverter o lote importado em{' '}
              <strong>{new Date(pendingRevertBatch.createdAt).toLocaleString('pt-BR')}</strong>:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Os <strong>{pendingRevertBatch.createdTransactionsCount}</strong> lançamentos
                criados por esta importação serão removidos.
              </li>
              <li>
                Os <strong>{pendingRevertBatch.reconciledCount}</strong> lançamentos existentes que
                foram conciliados voltarão ao estado anterior.
              </li>
              <li>Seus saldos e indicadores serão recalculados imediatamente.</li>
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}
'use client';

import * as React from 'react';
import type {
  StatementImportReviewPlan,
  ReconciledStatementItem,
} from '@/features/reconciliation/engine';
import { confirmStatementImportBatchAction, revertStatementImportBatchAction } from '@/features/reconciliation/actions/reconciliation-confirm.actions';
import type { SerializedImportBatch } from '@/features/reconciliation/components/statement-reconciliation-workbench';

interface UseReconciliationCommitRevertParams {
  reviewPlan: StatementImportReviewPlan | null;
  reviewItems: ReconciledStatementItem[];
  targetType: 'ACCOUNT' | 'CREDIT_CARD';
  selectedAccountId: string;
  destinationAccountId: string;
  selectedCardId: string;
  onCommitted: () => void;
  setBanner: (banner: { type: 'success' | 'error'; text: string } | null) => void;
}

export function useReconciliationCommitRevert(params: UseReconciliationCommitRevertParams) {
  const {
    reviewPlan,
    reviewItems,
    targetType,
    selectedAccountId,
    destinationAccountId,
    selectedCardId,
    onCommitted,
    setBanner,
  } = params;

  const [isConfirmModalOpen, setIsConfirmModalOpen] = React.useState(false);
  const [isCommitting, setIsCommitting] = React.useState(false);
  const [calibrateBalanceFromStatement, setCalibrateBalanceFromStatement] = React.useState(true);
  const [pendingRevertBatch, setPendingRevertBatch] =
    React.useState<SerializedImportBatch | null>(null);
  const [isReverting, setIsReverting] = React.useState(false);

  const handleConfirmBatchImport = async () => {
    if (!reviewPlan) return;
    setIsCommitting(true);
    setBanner(null);
    try {
      const res = await confirmStatementImportBatchAction({
        targetType,
        sourceAccountId: selectedAccountId,
        destinationAccountId,
        creditCardId: selectedCardId,
        files: reviewPlan.files,
        items: reviewItems,
        calibrateBalanceFromStatement,
      });
      if (!res.ok) {
        setBanner({
          type: 'error',
          text: res.error || 'Não foi possível confirmar a importação.',
        });
        setIsConfirmModalOpen(false);
        return;
      }
      setIsConfirmModalOpen(false);
      onCommitted();
      setBanner({
        type: 'success',
        text: `Importação confirmada com sucesso! ${res.reconciledCount} lançamento(s) conciliado(s), ${res.createdCount} registro(s) atualizado(s)/criado(s) no fluxo financeiro e ${res.skippedCount} duplicado(s)/descartado(s) ignorado(s).`,
      });
    } finally {
      setIsCommitting(false);
    }
  };

  const handleConfirmRevertBatch = async () => {
    if (!pendingRevertBatch) return;
    setIsReverting(true);
    try {
      const res = await revertStatementImportBatchAction(pendingRevertBatch.id);
      setBanner(
        res.ok
          ? {
              type: 'success',
              text: 'Lote de importação revertido com segurança! Os lançamentos criados pelo lote foram removidos e os lançamentos conciliados voltaram ao estado anterior.',
            }
          : { type: 'error', text: res.error || 'Erro ao reverter lote de importação.' }
      );
      setPendingRevertBatch(null);
    } finally {
      setIsReverting(false);
    }
  };

  return {
    isConfirmModalOpen,
    setIsConfirmModalOpen,
    isCommitting,
    calibrateBalanceFromStatement,
    setCalibrateBalanceFromStatement,
    pendingRevertBatch,
    setPendingRevertBatch,
    isReverting,
    handleConfirmBatchImport,
    handleConfirmRevertBatch,
  };
}

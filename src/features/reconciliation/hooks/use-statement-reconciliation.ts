'use client';

import * as React from 'react';
import type {
  StatementImportReviewPlan,
  ReconciledStatementItem,
} from '@/features/reconciliation/engine';
import { processMultiStatementImportAction } from '@/features/reconciliation/actions/reconciliation-process.actions';
import {
  type QueuedFileItem,
  type ReviewFilterTab,
  applyReconciliationLinkSelection,
  computeDerivedReconciliationStats,
} from '@/features/reconciliation/components/reconciliation-ui-helpers';
import type { StatementReconciliationWorkbenchProps } from '@/features/reconciliation/components/statement-reconciliation-workbench';
import { useStatementFileQueue } from '@/features/reconciliation/hooks/use-statement-file-queue';
import { useReconciliationCommitRevert } from '@/features/reconciliation/hooks/use-reconciliation-commit-revert';

export function useStatementReconciliation(props: StatementReconciliationWorkbenchProps) {
  const {
    provider,
    connectionMode,
    categories,
    accounts,
    creditCards,
    recurrenceRules,
    existingTransactions,
  } = props;

  const [reconcileBanner, setReconcileBanner] = React.useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const queue = useStatementFileQueue(() => setReconcileBanner(null));
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [reviewPlan, setReviewPlan] = React.useState<StatementImportReviewPlan | null>(null);
  const [reviewItems, setReviewItems] = React.useState<ReconciledStatementItem[]>([]);
  const [activeFilter, setActiveFilter] = React.useState<ReviewFilterTab>('ALL');
  const [targetType, setTargetType] = React.useState<'ACCOUNT' | 'CREDIT_CARD'>('ACCOUNT');
  const [selectedAccountId, setSelectedAccountId] = React.useState(accounts[0]?.id || '');
  const [destinationAccountId, setDestinationAccountId] = React.useState(
    accounts[1]?.id || accounts[0]?.id || ''
  );
  const [selectedCardId, setSelectedCardId] = React.useState(creditCards[0]?.id || '');

  React.useEffect(() => {
    if (!accounts.some((a) => a.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0]?.id || '');
    }
    if (!accounts.some((a) => a.id === destinationAccountId)) {
      setDestinationAccountId(accounts[1]?.id || accounts[0]?.id || '');
    }
    if (!creditCards.some((c) => c.id === selectedCardId)) {
      setSelectedCardId(creditCards[0]?.id || '');
    }
  }, [accounts, creditCards, selectedAccountId, destinationAccountId, selectedCardId]);

  const commitRevert = useReconciliationCommitRevert({
    reviewPlan,
    reviewItems,
    targetType,
    selectedAccountId,
    destinationAccountId,
    selectedCardId,
    onCommitted: () => {
      setReviewPlan(null);
      setReviewItems([]);
      queue.setQueuedFiles([]);
    },
    setBanner: setReconcileBanner,
  });

  const handleRunReconciliation = async () => {
    let filesToProcess = [...queue.queuedFiles];
    if (filesToProcess.length === 0 && queue.manualTextSnippet.trim()) {
      const autoFile: QueuedFileItem = {
        fileId: `manual-${Date.now()}`,
        fileName: `${(queue.manualSnippetBankName || 'extrato').toLowerCase().replace(/\s+/g, '-')}.txt`,
        mimeType: 'text/plain',
        sizeInBytes: queue.manualTextSnippet.trim().length,
        content: queue.manualTextSnippet.trim(),
        isBase64: false,
        progressState: 'PROCESSING',
      };
      filesToProcess = [autoFile];
      queue.setQueuedFiles([autoFile]);
      queue.setManualTextSnippet('');
    }
    if (filesToProcess.length === 0) {
      setReconcileBanner({
        type: 'error',
        text: 'Selecione um ou mais arquivos de extrato (CSV, OFX, XLSX, PDF) ou cole as movimentações.',
      });
      return;
    }

    setIsAnalyzing(true);
    setReconcileBanner(null);
    queue.setQueuedFiles((prev) => prev.map((f) => ({ ...f, progressState: 'PROCESSING' })));
    try {
      const res = await processMultiStatementImportAction({
        files: filesToProcess.map((f) => ({
          fileId: f.fileId,
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeInBytes: f.sizeInBytes,
          content: f.content,
          isBase64: f.isBase64,
        })),
        provider,
        connectionMode,
      });
      if (!res.ok || !res.plan) {
        setReconcileBanner({
          type: 'error',
          text: res.error || 'Falha ao processar os extratos selecionados.',
        });
        queue.setQueuedFiles((prev) => prev.map((f) => ({ ...f, progressState: 'ERROR' })));
        return;
      }
      const plan = res.plan;
      setReviewPlan(plan);
      setReviewItems(plan.items);
      setActiveFilter('ALL');
      queue.setQueuedFiles((prev) =>
        prev.map((qf) => {
          const matched = plan.files.find((pf) => pf.fileId === qf.fileId);
          if (!matched) return qf;
          return {
            ...qf,
            progressState: matched.status === 'PROCESSED' ? 'DONE' : 'ERROR',
            detectedBank: matched.bankName,
            detectedPeriod:
              matched.periodStart && matched.periodEnd
                ? `${matched.periodStart.split('-').reverse().join('/')} a ${matched.periodEnd.split('-').reverse().join('/')}`
                : null,
            extractedCount: matched.extractedCount,
            errorMessage: matched.errorMessage,
          };
        })
      );
      if (plan.items.length === 0) {
        setReconcileBanner({
          type: 'error',
          text:
            plan.files.find((f) => f.errorMessage)?.errorMessage ||
            'Nenhuma movimentação financeira válida foi encontrada nos arquivos enviados.',
        });
      } else {
        const warningSuffix = res.aiWarning ? ` (${res.aiWarning})` : '';
        setReconcileBanner({
          type: 'success',
          text: `Análise concluída: ${plan.summary.totalMovements} movimentação(ões) lida(s) em ${plan.summary.processedFiles} arquivo(s) — ${plan.summary.reconciledCount} conciliada(s), ${plan.summary.newEntriesCount} nova(s) e ${plan.summary.duplicatesCount} duplicada(s). Revise abaixo antes de confirmar.${warningSuffix}`,
        });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateReviewItem = (
    itemId: string,
    patch: Partial<ReconciledStatementItem>
  ) => {
    setReviewItems((prev) =>
      prev.map((item) => {
        if (item.itemId !== itemId) return item;
        const updated = { ...item, ...patch };
        if (patch.categoryId !== undefined) {
          if (!patch.categoryId) {
            updated.categoryId = '';
            updated.categoryName = 'Sem Categoria';
          } else {
            const foundCat = categories.find((c) => c.id === patch.categoryId);
            if (foundCat) updated.categoryName = foundCat.name;
          }
        }
        return updated;
      })
    );
  };

  const handleChangeReconciliationLink = (itemId: string, selectionValue: string) => {
    setReviewItems((prev) =>
      prev.map((item) =>
        item.itemId !== itemId
          ? item
          : applyReconciliationLinkSelection({
              item,
              selectionValue,
              recurrenceRules,
              existingTransactions,
            })
      )
    );
  };

  const derived = React.useMemo(
    () => computeDerivedReconciliationStats(reviewItems, activeFilter),
    [reviewItems, activeFilter]
  );

  return {
    ...derived,
    ...queue,
    ...commitRevert,
    isAnalyzing,
    reviewPlan,
    setReviewPlan,
    reviewItems,
    setReviewItems,
    activeFilter,
    setActiveFilter,
    targetType,
    setTargetType,
    selectedAccountId,
    setSelectedAccountId,
    destinationAccountId,
    selectedCardId,
    setSelectedCardId,
    reconcileBanner,
    setReconcileBanner,
    handleRunReconciliation,
    handleUpdateReviewItem,
    handleChangeReconciliationLink,
  };
}

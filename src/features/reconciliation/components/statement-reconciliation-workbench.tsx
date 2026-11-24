'use client';
import * as React from 'react';
import type { AiProviderId, AiConnectionMode } from '@/features/ai-copilot/providers';
import { StatementUploadQueuePanel } from '@/features/reconciliation/components/statement-upload-queue-panel';
import { ReconciliationMetricsAndFilters } from '@/features/reconciliation/components/reconciliation-metrics-and-filters';
import { ImportBatchesHistoryAndModals } from '@/features/reconciliation/components/import-batches-history-and-modals';
import { useStatementReconciliation } from '@/features/reconciliation/hooks/use-statement-reconciliation';

export interface SerializedImportBatch {
  id: string;
  status: string; // COMMITTED | REVERTED
  fileCount: number;
  totalMovements: number;
  reconciledCount: number;
  createdTransactionsCount: number;
  skippedDuplicatesCount: number;
  aiProvider: string;
  aiModelId: string;
  createdAt: string;
  revertedAt: string | null;
  files: Array<{
    id: string;
    fileName: string;
    fileFormat: string;
    bankName: string;
    itemCount: number;
    status: string;
  }>;
}

export interface StatementReconciliationWorkbenchProps {
  provider: AiProviderId;
  connectionMode: AiConnectionMode;
  categories: Array<{
    id: string;
    name: string;
    type: string;
    defaultNature: string;
    color: string;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    currentBalanceInCents: number;
  }>;
  creditCards: Array<{
    id: string;
    name: string;
    closingDay: number;
  }>;
  recurrenceRules: Array<{
    id: string;
    description: string;
    type: string;
    nature: string;
    amountInCents: number;
    dayOfMonth: number;
  }>;
  existingTransactions: Array<{
    id: string;
    description: string;
    type: string;
    amountInCents: number;
    date: string;
    status: string;
  }>;
  importBatches: SerializedImportBatch[];
  hideValues: boolean;
}


export function StatementReconciliationWorkbench(props: StatementReconciliationWorkbenchProps) {
  const { categories, accounts, creditCards, recurrenceRules, existingTransactions, importBatches, hideValues } = props;
  const {
    queuedFiles, setQueuedFiles, manualTextSnippet, setManualTextSnippet,
    manualSnippetBankName, setManualSnippetBankName, showManualTextPanel, setShowManualTextPanel,
    isAnalyzing, reviewPlan, setReviewPlan, reviewItems, setReviewItems,
    activeFilter, setActiveFilter, targetType, setTargetType,
    selectedAccountId, setSelectedAccountId, selectedCardId, setSelectedCardId,
    isConfirmModalOpen, setIsConfirmModalOpen, isCommitting,
    calibrateBalanceFromStatement, setCalibrateBalanceFromStatement,
    reconcileBanner, setReconcileBanner, pendingRevertBatch, setPendingRevertBatch, isReverting,
    handleFilesSelected, handleAddManualSnippetToQueue, handleRemoveQueuedFile,
    handleRunReconciliation, handleUpdateReviewItem, handleChangeReconciliationLink,
    handleConfirmBatchImport, handleConfirmRevertBatch, filteredReviewItems,
    selectedItemsForConfirm, selectedIncomesCents, selectedExpensesCents,
    selectedReconciledCount, selectedNewCount,
  } = useStatementReconciliation(props);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/70 p-6 space-y-6">
      <StatementUploadQueuePanel
        queuedFiles={queuedFiles}
        reviewPlan={reviewPlan}
        isAnalyzing={isAnalyzing}
        showManualTextPanel={showManualTextPanel}
        setShowManualTextPanel={setShowManualTextPanel}
        targetType={targetType}
        setTargetType={setTargetType}
        selectedAccountId={selectedAccountId}
        setSelectedAccountId={setSelectedAccountId}
        selectedCardId={selectedCardId}
        setSelectedCardId={setSelectedCardId}
        accounts={accounts}
        creditCards={creditCards}
        hideValues={hideValues}
        manualSnippetBankName={manualSnippetBankName}
        setManualSnippetBankName={setManualSnippetBankName}
        manualTextSnippet={manualTextSnippet}
        setManualTextSnippet={setManualTextSnippet}
        reconcileBanner={reconcileBanner}
        handleFilesSelected={handleFilesSelected}
        handleAddManualSnippetToQueue={handleAddManualSnippetToQueue}
        handleRemoveQueuedFile={handleRemoveQueuedFile}
        handleRunReconciliation={handleRunReconciliation}
        onClearAll={() => {
          setQueuedFiles([]);
          setReviewPlan(null);
          setReviewItems([]);
          setReconcileBanner(null);
        }}
      />
      {reviewPlan && reviewItems.length > 0 && (
        <ReconciliationMetricsAndFilters
          reviewPlan={reviewPlan}
          reviewItems={reviewItems}
          filteredReviewItems={filteredReviewItems}
          selectedItemsForConfirm={selectedItemsForConfirm}
          selectedIncomesCents={selectedIncomesCents}
          selectedExpensesCents={selectedExpensesCents}
          selectedReconciledCount={selectedReconciledCount}
          selectedNewCount={selectedNewCount}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          setReviewItems={setReviewItems}
          setIsConfirmModalOpen={setIsConfirmModalOpen}
          hideValues={hideValues}
          categories={categories}
          recurrenceRules={recurrenceRules}
          existingTransactions={existingTransactions}
          handleUpdateReviewItem={handleUpdateReviewItem}
          handleChangeReconciliationLink={handleChangeReconciliationLink}
        />
      )}
      <ImportBatchesHistoryAndModals
        importBatches={importBatches}
        isConfirmModalOpen={isConfirmModalOpen}
        setIsConfirmModalOpen={setIsConfirmModalOpen}
        isCommitting={isCommitting}
        handleConfirmBatchImport={handleConfirmBatchImport}
        selectedIncomesCents={selectedIncomesCents}
        selectedExpensesCents={selectedExpensesCents}
        selectedItemsForConfirm={selectedItemsForConfirm}
        selectedReconciledCount={selectedReconciledCount}
        selectedNewCount={selectedNewCount}
        reviewItems={reviewItems}
        targetType={targetType}
        reviewPlan={reviewPlan}
        calibrateBalanceFromStatement={calibrateBalanceFromStatement}
        setCalibrateBalanceFromStatement={setCalibrateBalanceFromStatement}
        pendingRevertBatch={pendingRevertBatch}
        setPendingRevertBatch={setPendingRevertBatch}
        isReverting={isReverting}
        handleConfirmRevertBatch={handleConfirmRevertBatch}
        hideValues={hideValues}
      />
    </div>
  );
}
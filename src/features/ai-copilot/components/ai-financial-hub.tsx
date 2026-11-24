'use client';
import * as React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';
import { type AiProviderId, type AiConnectionMode } from '@/features/ai-copilot/providers';
import { StatementReconciliationWorkbench, type SerializedImportBatch } from '@/features/reconciliation/components/statement-reconciliation-workbench';
import { AiProviderConnectorPanel } from '@/features/ai-copilot/components/ai-provider-connector-panel';
import { FinancialHealthReportsPanel } from '@/features/ai-copilot/components/financial-health-reports-panel';
import { useAiFinancialHub } from '@/features/ai-copilot/hooks/use-ai-financial-hub';
export type { SerializedImportBatch };
export interface SerializedAiReport {
  id: string; provider: string; connectionMode: string; healthScore: number;
  summary: string; strengths: string[]; risks: string[]; actionPlan: string[]; createdAt: string;
}
export interface AiPendingDeleteState {
  title: string; entityName: string; description: string;
  confirmLabel: string; onConfirm: () => Promise<unknown> | void;
}

export interface AiFinancialHubProps {
  aiSettings: {
    aiProvider: AiProviderId;
    aiConnectionMode: AiConnectionMode;
    openaiApiKey: string;
    geminiApiKey: string;
    claudeApiKey: string;
    openaiModel: string;
    geminiModel: string;
    claudeModel: string;
  };
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
  recurrenceRules?: Array<{
    id: string;
    description: string;
    type: string;
    nature: string;
    amountInCents: number;
    dayOfMonth: number;
  }>;
  existingTransactions?: Array<{
    id: string;
    description: string;
    type: string;
    amountInCents: number;
    date: string;
    status: string;
  }>;
  importBatches?: SerializedImportBatch[];
  financialContext: {
    consolidatedBalanceInCents: number;
    staticIncomeInCents: number;
    staticExpenseInCents: number;
    freeIncomeInCents: number;
    monthIncomeInCents: number;
    monthExpenseInCents: number;
    championCategoryName: string;
    championCategoryAmountInCents: number;
    portfolioGoalTitle?: string;
    portfolioGoalTargetInCents?: number;
    portfolioGoalCurrentInCents?: number;
    portfolioGoalRemainingInCents?: number;
    portfolioGoalRecommendedMonthlyInCents?: number;
    momDiffInCents: number;
    momVariationPercent: number;
  };
  savedReports: SerializedAiReport[];
  hideValues: boolean;
}
export function AiFinancialHub(props: AiFinancialHubProps) {
  const { categories, accounts, creditCards, recurrenceRules = [], existingTransactions = [], importBatches = [], savedReports, hideValues } = props;
  const {
    provider, setProvider, connectionMode, setConnectionMode,
    openaiKey, setOpenaiKey, geminiKey, setGeminiKey, claudeKey, setClaudeKey,
    openaiModel, setOpenaiModel, geminiModel, setGeminiModel, claudeModel, setClaudeModel,
    isSavingConfig, configSavedBanner,
    pastedStatusResponse, setPastedStatusResponse,
    isRunningAnalysis, statusAnalysisError,
    pendingDelete, setPendingDelete, isDeleting, handleConfirmPendingDelete,
    currentProviderMeta, handleSaveAiConfig, handleCopySubscriptionPrompt,
    handleGenerateStatusReport,
  } = useAiFinancialHub(props);
  return (
    <div className="space-y-6">
      <AiProviderConnectorPanel
        provider={provider}
        setProvider={setProvider}
        connectionMode={connectionMode}
        setConnectionMode={setConnectionMode}
        openaiKey={openaiKey}
        setOpenaiKey={setOpenaiKey}
        geminiKey={geminiKey}
        setGeminiKey={setGeminiKey}
        claudeKey={claudeKey}
        setClaudeKey={setClaudeKey}
        openaiModel={openaiModel}
        setOpenaiModel={setOpenaiModel}
        geminiModel={geminiModel}
        setGeminiModel={setGeminiModel}
        claudeModel={claudeModel}
        setClaudeModel={setClaudeModel}
        configSavedBanner={configSavedBanner}
        isSavingConfig={isSavingConfig}
        handleSaveAiConfig={handleSaveAiConfig}
      />
      <StatementReconciliationWorkbench
        provider={provider}
        connectionMode={connectionMode}
        categories={categories}
        accounts={accounts}
        creditCards={creditCards}
        recurrenceRules={recurrenceRules}
        existingTransactions={existingTransactions}
        importBatches={importBatches}
        hideValues={hideValues}
      />
      <FinancialHealthReportsPanel
        connectionMode={connectionMode}
        currentProviderMeta={currentProviderMeta}
        isRunningAnalysis={isRunningAnalysis}
        statusAnalysisError={statusAnalysisError}
        pastedStatusResponse={pastedStatusResponse}
        setPastedStatusResponse={setPastedStatusResponse}
        savedReports={savedReports}
        handleCopySubscriptionPrompt={handleCopySubscriptionPrompt}
        handleGenerateStatusReport={handleGenerateStatusReport}
        setPendingDelete={setPendingDelete}
      />
      {/* Modal de Confirmação de Exclusão no Hub de IA */}
      <Modal
        isOpen={Boolean(pendingDelete)}
        onClose={() => {
          if (!isDeleting) setPendingDelete(null);
        }}
        title={pendingDelete?.title || 'Confirmar Exclusão'}
        subtitle="Por segurança, confirme antes de remover este item."
        footer={
          <>
            <Button
              variant="secondary"
              type="button"
              disabled={isDeleting}
              onClick={() => setPendingDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              type="button"
              isLoading={isDeleting}
              onClick={handleConfirmPendingDelete}
            >
              <Trash2 className="h-4 w-4" />
              {pendingDelete?.confirmLabel || 'Confirmar Exclusão'}
            </Button>
          </>
        }
      >
        {pendingDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/35 p-4">
              <div className="h-10 w-10 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Item selecionado para exclusão
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 break-words">
                  {pendingDelete.entityName}
                </p>
                <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed pt-0.5">
                  {pendingDelete.description}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

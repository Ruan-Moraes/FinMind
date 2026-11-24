'use client';

import * as React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';
import {
  StatementReconciliationWorkbench,
  type SerializedImportBatch,
} from '@/features/reconciliation/components/statement-reconciliation-workbench';
import { AiProviderConnectorPanel } from '@/features/ai-copilot/components/ai-provider-connector-panel';
import { FinancialHealthReportsPanel } from '@/features/ai-copilot/components/financial-health-reports-panel';
import { AgentAuditLogPanel } from '@/features/ai-agent/components/agent-audit-log-panel';
import { useAiFinancialHub } from '@/features/ai-copilot/hooks/use-ai-financial-hub';

export type { SerializedImportBatch };

export interface SerializedAiReport {
  id: string;
  provider: string;
  connectionMode: string;
  healthScore: number;
  summary: string;
  strengths: string[];
  risks: string[];
  actionPlan: string[];
  createdAt: string;
}

export interface AiPendingDeleteState {
  title: string;
  entityName: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown> | void;
}

export interface AiFinancialHubProps {
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
  const {
    categories, accounts, creditCards, recurrenceRules = [],
    existingTransactions = [], importBatches = [], savedReports, hideValues,
  } = props;
  const {
    provider, isRunningAnalysis, statusAnalysisError,
    pendingDelete, setPendingDelete, isDeleting, handleConfirmPendingDelete,
    handleGenerateStatusReport,
  } = useAiFinancialHub(props);

  return (
    <div className="space-y-6">
      <AiProviderConnectorPanel />
      <div data-agent-id="ai.panel.reconciliation">
        <StatementReconciliationWorkbench
          provider={provider}
          categories={categories}
          accounts={accounts}
          creditCards={creditCards}
          recurrenceRules={recurrenceRules}
          existingTransactions={existingTransactions}
          importBatches={importBatches}
          hideValues={hideValues}
        />
      </div>
      <FinancialHealthReportsPanel
        isRunningAnalysis={isRunningAnalysis}
        statusAnalysisError={statusAnalysisError}
        savedReports={savedReports}
        handleGenerateStatusReport={handleGenerateStatusReport}
        setPendingDelete={setPendingDelete}
      />
      <AgentAuditLogPanel />
      <Modal
        isOpen={Boolean(pendingDelete)}
        onClose={() => { if (!isDeleting) setPendingDelete(null); }}
        title={pendingDelete?.title || 'Confirmar Exclusão'}
        subtitle="Por segurança, confirme antes de remover este item."
        footer={
          <>
            <Button variant="secondary" type="button" disabled={isDeleting} onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" type="button" isLoading={isDeleting} onClick={handleConfirmPendingDelete}>
              <Trash2 className="h-4 w-4" />
              {pendingDelete?.confirmLabel || 'Confirmar Exclusão'}
            </Button>
          </>
        }
      >
        {pendingDelete && (
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
        )}
      </Modal>
    </div>
  );
}

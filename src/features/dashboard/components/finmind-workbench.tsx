'use client';

import * as React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { AiFinancialHub } from '@/features/ai-copilot/components/ai-financial-hub';
import { FloatingAiChatbot } from '@/features/ai-copilot/components/floating-ai-chatbot';
import { formatCentsToBRL } from '@/shared/lib/currency';
import type { SerializedTransaction, WorkbenchProps } from '@/features/dashboard/types/workbench-types';
import { useWorkbenchController } from '@/features/dashboard/hooks/use-workbench-controller';
import { WorkbenchProvider } from '@/features/dashboard/context/workbench-context';
import { WorkbenchHeader } from '@/features/dashboard/components/workbench-header-and-nav';
import { WorkbenchMobileBottomNav } from '@/features/dashboard/components/workbench-mobile-bottom-nav';
import { OverviewTab } from '@/features/analytics/components/overview-tab';
import { ComparisonTab } from '@/features/analytics/components/comparison-tab';
import { GoalsStaticTab } from '@/features/planning/components/goals-static-tab';
import { ValueForecastTab } from '@/features/planning/components/value-forecast-tab';
import { AccountsCardsTab } from '@/features/accounts/components/accounts-cards-tab';
import { TransactionsTab } from '@/features/transactions/components/transactions-tab';
import { TransactionFormModal } from '@/features/transactions/components/transaction-form-modal';
import { GoalAndBudgetModals } from '@/features/planning/components/goal-and-budget-modals';
import { StaticRuleFormModal } from '@/features/planning/components/static-rule-form-modal';
import { AccountFormModal } from '@/features/accounts/components/account-form-modal';
import { CardAndInvoiceModals } from '@/features/credit-cards/components/card-and-invoice-modals';
import { CategoryFormModal } from '@/features/planning/components/category-form-modal';
import { SettingsModal } from '@/features/dashboard/components/settings-modal';
import { SecurityAndPreviewModals } from '@/features/dashboard/components/security-and-preview-modals';
import { AgentRuntimeProvider } from '@/features/ai-agent/context/agent-runtime-context';
import { AgentVisualStage } from '@/features/ai-agent/visual/agent-visual-stage';
import { AiProvidersProvider } from '@/features/ai-copilot/context/ai-providers-context';

export type { SerializedTransaction, WorkbenchProps };

export function FinMindWorkbench(props: WorkbenchProps) {
  const wb = useWorkbenchController(props);
  const {
    aiReports,
    categories,
    creditCards,
    staticBaseline,
    monthSummary,
    momComparison,
    recurrenceRules,
    transactions,
    importBatches = [],
  } = props;
  const {
    activeTab,
    setActiveTab,
    hideValues,
    activeAccounts,
    totalConsolidatedBalanceInCents,
    primaryGoal,
  } = wb;

  return (
    <WorkbenchProvider props={props} wb={wb}>
    <AiProvidersProvider initialState={props.initialAiState}>
    <AgentRuntimeProvider>
    <div data-agent-capture-root="true" className="min-h-screen bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-50 flex flex-col pb-20 sm:pb-8">
      <WorkbenchHeader />

      <main className="max-w-[1520px] w-full mx-auto px-4 sm:px-8 py-6 space-y-6 flex-1">
        {staticBaseline.isOverCommitted && (
          <div className="rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">
                  Atenção: Seus custos estáticos ultrapassam sua renda estática garantida!
                </p>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5 tabular-nums">
                  Déficit fixo de{' '}
                  {formatCentsToBRL(
                    Math.abs(staticBaseline.freeDiscretionaryIncomeInCents),
                    hideValues
                  )}
                  . Revise seus compromissos inflexíveis.
                </p>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setActiveTab('goals')}>
              Revisar Custos
            </Button>
          </div>
        )}

        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'comparison' && <ComparisonTab />}
        {activeTab === 'goals' && <GoalsStaticTab />}
        {activeTab === 'forecast' && <ValueForecastTab />}
        {activeTab === 'accounts' && <AccountsCardsTab />}
        {activeTab === 'transactions' && <TransactionsTab />}

        {activeTab === 'ai' && (
          <AiFinancialHub
            categories={categories}
            accounts={activeAccounts}
            creditCards={creditCards}
            recurrenceRules={recurrenceRules}
            existingTransactions={transactions}
            importBatches={importBatches}
            financialContext={{
              consolidatedBalanceInCents: totalConsolidatedBalanceInCents,
              staticIncomeInCents: staticBaseline.staticIncomeInCents,
              staticExpenseInCents: staticBaseline.staticExpenseInCents,
              freeIncomeInCents: staticBaseline.freeDiscretionaryIncomeInCents,
              monthIncomeInCents: monthSummary.totalIncomeInCents,
              monthExpenseInCents: monthSummary.totalExpenseInCents,
              championCategoryName: monthSummary.championCategory?.name || 'Sem Categoria',
              championCategoryAmountInCents: monthSummary.championCategory?.amountInCents || 0,
              portfolioGoalTitle: primaryGoal?.title,
              portfolioGoalTargetInCents: primaryGoal?.targetAmountInCents,
              portfolioGoalCurrentInCents: primaryGoal?.currentNetWorthInCents,
              portfolioGoalRemainingInCents: primaryGoal?.remainingDistanceInCents,
              portfolioGoalRecommendedMonthlyInCents:
                primaryGoal?.recommendedMonthlyContributionInCents,
              momDiffInCents: momComparison.expenseDiffInCents,
              momVariationPercent: momComparison.expenseVariationPercent,
            }}
            savedReports={aiReports}
            hideValues={hideValues}
          />
        )}
      </main>

      <WorkbenchMobileBottomNav />
      <FloatingAiChatbot />
      <TransactionFormModal />
      <GoalAndBudgetModals />
      <StaticRuleFormModal />
      <AccountFormModal />
      <CardAndInvoiceModals />
      <CategoryFormModal />
      <SettingsModal />
      <SecurityAndPreviewModals />
      <AgentVisualStage />
    </div>
    </AgentRuntimeProvider>
    </AiProvidersProvider>
    </WorkbenchProvider>
  );
}

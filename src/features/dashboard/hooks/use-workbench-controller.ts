'use client';

import * as React from 'react';
import { updateUserSettingsAction } from '@/features/auth/actions/auth-settings.actions';
import type {
  AccountWithBalance,
  CreditCardWithSummary,
  PortfolioGoalProgress,
} from '@/features/analytics';
import type { SerializedTransaction, WorkbenchProps } from '@/features/dashboard/types/workbench-types';
import { useWorkbenchState } from '@/features/dashboard/hooks/use-workbench-state';

export function useWorkbenchController(props: WorkbenchProps) {
  const { accounts, creditCards, portfolioGoals, transactions } = props;
  const state = useWorkbenchState(props);
  const {
    router, searchParams, theme, setTheme, hideValues, setHideValues,
    density, setActiveModal, searchQuery, filterType, filterNature, filterCategoryId,
  } = state;

  const updatePeriodParams = (paramsToUpdate: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(paramsToUpdate)) {
      params.set(k, String(v));
    }
    router.push(`/?${params.toString()}`);
  };

  const handleToggleTheme = async () => {
    const nextTheme = theme === 'DARK' ? 'LIGHT' : 'DARK';
    setTheme(nextTheme);
    await updateUserSettingsAction({ theme: nextTheme });
  };

  const handleTogglePrivacy = async () => {
    const nextVal = !hideValues;
    setHideValues(nextVal);
    await updateUserSettingsAction({ hideValuesByDefault: nextVal });
  };

  const filteredTransactions = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (filterType !== 'ALL' && tx.type !== filterType) return false;
      if (filterNature !== 'ALL' && tx.nature !== filterNature) return false;
      if (filterCategoryId !== 'ALL' && tx.categoryId !== filterCategoryId) return false;
      if (q) {
        const hay = `${tx.description} ${tx.categoryName || ''} ${tx.tags} ${tx.sourceAccountName || ''} ${tx.creditCardName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, searchQuery, filterType, filterNature, filterCategoryId]);

  const activeAccounts = React.useMemo(
    () => accounts.filter((a) => !a.isArchived),
    [accounts]
  );

  const totalConsolidatedBalanceInCents = React.useMemo(
    () => activeAccounts.reduce((acc, a) => acc + a.currentBalanceInCents, 0),
    [activeAccounts]
  );

  const totalOpenInvoicesInCents = React.useMemo(
    () =>
      creditCards.reduce(
        (acc, c) => acc + (c.currentInvoiceStatus !== 'PAID' ? c.currentInvoiceInCents : 0),
        0
      ),
    [creditCards]
  );

  const primaryGoal = portfolioGoals[0] || null;
  const cellPadding = density === 'COMPACT' ? 'py-2 px-3' : 'py-3.5 px-5';
  const headerCellPadding = density === 'COMPACT' ? 'py-2.5 px-3' : 'py-3 px-5';

  return {
    ...state,
    updatePeriodParams,
    handleToggleTheme,
    handleTogglePrivacy,
    setIsSettingsModalOpen: (open: boolean) =>
      setActiveModal(open ? { type: 'SETTINGS' } : null),
    setIsBudgetModalOpen: (open: boolean) =>
      setActiveModal(open ? { type: 'BUDGET' } : null),
    setIsPayInvoiceModalOpen: (card: CreditCardWithSummary | null) =>
      setActiveModal(card ? { type: 'PAY_INVOICE', card } : null),
    handleOpenCreateTxModal: (preset?: {
      type?: 'EXPENSE' | 'INCOME' | 'TRANSFER';
      nature?: 'STATIC' | 'VARIABLE';
    }) => setActiveModal({ type: 'TX', editing: null, preset }),
    handleOpenEditTxModal: (tx: SerializedTransaction) =>
      setActiveModal({ type: 'TX', editing: tx }),
    handleOpenCreateGoalModal: () => setActiveModal({ type: 'GOAL', editing: null }),
    handleOpenEditGoalModal: (goal: PortfolioGoalProgress) =>
      setActiveModal({ type: 'GOAL', editing: goal }),
    handleOpenEditBudgetModal: (budget: { categoryId: string; maxAmountInCents: number }) =>
      setActiveModal({
        type: 'BUDGET',
        categoryId: budget.categoryId,
        maxAmountInCents: budget.maxAmountInCents,
      }),
    handleOpenCreateAccountModal: () => setActiveModal({ type: 'ACCOUNT', editing: null }),
    handleOpenEditAccountModal: (acc: AccountWithBalance) =>
      setActiveModal({ type: 'ACCOUNT', editing: acc }),
    handleOpenCreateCardModal: () => setActiveModal({ type: 'CARD', editing: null }),
    handleOpenEditCardModal: (card: CreditCardWithSummary) =>
      setActiveModal({ type: 'CARD', editing: card }),
    handleOpenCreateStaticRuleModal: (presetType: 'INCOME' | 'EXPENSE' = 'EXPENSE') =>
      setActiveModal({ type: 'STATIC_RULE', editing: null, presetType }),
    handleOpenEditStaticRuleModal: (rule: WorkbenchProps['recurrenceRules'][number]) =>
      setActiveModal({ type: 'STATIC_RULE', editing: rule }),
    handleOpenCreateCategoryModal: (presetType: 'INCOME' | 'EXPENSE' = 'EXPENSE') =>
      setActiveModal({ type: 'CATEGORY', editing: null, presetType }),
    handleOpenEditCategoryModal: (cat: WorkbenchProps['categories'][number]) =>
      setActiveModal({ type: 'CATEGORY', editing: cat }),
    handleOpenResetModal: () => setActiveModal({ type: 'RESET' }),
    filteredTransactions,
    activeAccounts,
    totalConsolidatedBalanceInCents,
    totalOpenInvoicesInCents,
    primaryGoal,
    cellPadding,
    headerCellPadding,
  };
}

export type WorkbenchController = ReturnType<typeof useWorkbenchController>;

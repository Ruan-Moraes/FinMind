import { formatCentsToBRL } from '@/shared/lib/currency';
import type { StatementFileInput } from '@/features/reconciliation/parsers';
import type { ReconciledStatementItem } from '@/features/reconciliation/engine';

export type ReviewFilterTab =
  | 'ALL'
  | 'RECONCILED'
  | 'NEW'
  | 'INCOME'
  | 'EXPENSE'
  | 'NEEDS_REVIEW'
  | 'DUPLICATES'
  | 'TRANSFERS_INVOICES';

export interface QueuedFileItem extends StatementFileInput {
  progressState: 'QUEUED' | 'PROCESSING' | 'DONE' | 'ERROR';
  detectedBank?: string;
  detectedPeriod?: string | null;
  extractedCount?: number;
  errorMessage?: string;
}

export function getCurrentSelectLinkValue(item: ReconciledStatementItem): string {
  if (!item.selectedForImport && item.decisionType !== 'SKIP_DUPLICATE') return 'DISCARD';
  if (item.decisionType === 'RECONCILE_RULE' && item.matchedRuleId) {
    return `RULE:${item.matchedRuleId}`;
  }
  if (item.decisionType === 'RECONCILE_TRANSACTION' && item.matchedTransactionId) {
    return `TX:${item.matchedTransactionId}`;
  }
  if (item.decisionType === 'RECORD_SELF_TRANSFER') {
    return 'SELF_TRANSFER';
  }
  return 'NEW_ENTRY';
}

export function applyReconciliationLinkSelection(params: {
  item: ReconciledStatementItem;
  selectionValue: string;
  recurrenceRules: Array<{
    id: string;
    description: string;
    type: string;
    nature: string;
    amountInCents: number;
  }>;
  existingTransactions: Array<{
    id: string;
    description: string;
    type: string;
    amountInCents: number;
  }>;
}): ReconciledStatementItem {
  const { item, selectionValue, recurrenceRules, existingTransactions } = params;

  if (selectionValue === 'NEW_ENTRY') {
    return {
      ...item,
      decisionType: 'CREATE_NEW',
      matchedRuleId: null,
      matchedRuleDescription: null,
      matchedRuleAmountInCents: null,
      matchedTransactionId: null,
      matchedTransactionDescription: null,
      matchedTransactionAmountInCents: null,
      valueDifferenceInCents: 0,
      confidenceLevel: 'HIGH',
      requiresUserAttention: false,
      selectedForImport: true,
      reasonSummary: 'Definido manualmente pelo usuário como Novo Lançamento.',
    };
  }

  if (selectionValue === 'SELF_TRANSFER') {
    return {
      ...item,
      type: 'TRANSFER',
      movementKind: 'SELF_TRANSFER',
      decisionType: 'RECORD_SELF_TRANSFER',
      matchedRuleId: null,
      matchedTransactionId: null,
      confidenceLevel: 'HIGH',
      requiresUserAttention: false,
      selectedForImport: true,
      reasonSummary:
        'Definido pelo usuário como Transferência entre Contas Próprias (não afeta receitas/despesas).',
    };
  }

  if (selectionValue === 'DISCARD') {
    return {
      ...item,
      selectedForImport: false,
      requiresUserAttention: false,
    };
  }

  if (selectionValue.startsWith('RULE:')) {
    const ruleId = selectionValue.slice(5);
    const rule = recurrenceRules.find((r) => r.id === ruleId);
    if (!rule) return item;
    return {
      ...item,
      type: rule.type as 'INCOME' | 'EXPENSE',
      nature: rule.nature as 'STATIC' | 'VARIABLE',
      normalizedDescription: rule.description,
      decisionType: 'RECONCILE_RULE',
      matchedRuleId: rule.id,
      matchedRuleDescription: rule.description,
      matchedRuleAmountInCents: rule.amountInCents,
      matchedTransactionId: null,
      matchedTransactionDescription: null,
      valueDifferenceInCents: item.amountInCents - rule.amountInCents,
      confidenceLevel: 'HIGH',
      requiresUserAttention: false,
      selectedForImport: true,
      reasonSummary: `Vinculado pelo usuário ao lançamento recorrente "${rule.description}" (${formatCentsToBRL(
        rule.amountInCents
      )}).`,
    };
  }

  if (selectionValue.startsWith('TX:')) {
    const txId = selectionValue.slice(3);
    const tx = existingTransactions.find((t) => t.id === txId);
    if (!tx) return item;
    return {
      ...item,
      type: tx.type as 'INCOME' | 'EXPENSE',
      normalizedDescription: tx.description,
      decisionType: 'RECONCILE_TRANSACTION',
      matchedTransactionId: tx.id,
      matchedTransactionDescription: tx.description,
      matchedTransactionAmountInCents: tx.amountInCents,
      matchedRuleId: null,
      matchedRuleDescription: null,
      valueDifferenceInCents: item.amountInCents - tx.amountInCents,
      confidenceLevel: 'HIGH',
      requiresUserAttention: false,
      selectedForImport: true,
      reasonSummary: `Vinculado pelo usuário ao lançamento existente "${tx.description}" (${formatCentsToBRL(
        tx.amountInCents
      )}).`,
    };
  }

  return item;
}

export function computeDerivedReconciliationStats(
  reviewItems: ReconciledStatementItem[],
  activeFilter: ReviewFilterTab
) {
  const filteredReviewItems = reviewItems.filter((item) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'RECONCILED') {
      return (
        item.decisionType === 'RECONCILE_RULE' ||
        item.decisionType === 'RECONCILE_TRANSACTION' ||
        item.decisionType === 'PAY_CREDIT_CARD_INVOICE'
      );
    }
    if (activeFilter === 'NEW') return item.decisionType === 'CREATE_NEW';
    if (activeFilter === 'INCOME')
      return item.type === 'INCOME' && item.decisionType !== 'SKIP_DUPLICATE';
    if (activeFilter === 'EXPENSE')
      return item.type === 'EXPENSE' && item.decisionType !== 'SKIP_DUPLICATE';
    if (activeFilter === 'NEEDS_REVIEW') {
      return (
        item.decisionType !== 'SKIP_DUPLICATE' &&
        (item.requiresUserAttention ||
          item.confidenceLevel !== 'HIGH' ||
          item.decisionType === 'NEEDS_MANUAL_REVIEW')
      );
    }
    if (activeFilter === 'DUPLICATES') return item.decisionType === 'SKIP_DUPLICATE';
    if (activeFilter === 'TRANSFERS_INVOICES') {
      return (
        item.decisionType === 'RECORD_SELF_TRANSFER' ||
        item.decisionType === 'PAY_CREDIT_CARD_INVOICE'
      );
    }
    return true;
  });

  const selectedItemsForConfirm = reviewItems.filter(
    (i) => i.selectedForImport && i.decisionType !== 'SKIP_DUPLICATE'
  );
  const selectedIncomesCents = selectedItemsForConfirm
    .filter((i) => i.type === 'INCOME')
    .reduce((acc, i) => acc + i.amountInCents, 0);
  const selectedExpensesCents = selectedItemsForConfirm
    .filter((i) => i.type === 'EXPENSE')
    .reduce((acc, i) => acc + i.amountInCents, 0);
  const selectedReconciledCount = selectedItemsForConfirm.filter(
    (i) =>
      i.decisionType === 'RECONCILE_RULE' ||
      i.decisionType === 'RECONCILE_TRANSACTION' ||
      i.decisionType === 'PAY_CREDIT_CARD_INVOICE'
  ).length;
  const selectedNewCount = selectedItemsForConfirm.filter(
    (i) => i.decisionType === 'CREATE_NEW' || i.decisionType === 'NEEDS_MANUAL_REVIEW'
  ).length;

  return {
    filteredReviewItems,
    selectedItemsForConfirm,
    selectedIncomesCents,
    selectedExpensesCents,
    selectedReconciledCount,
    selectedNewCount,
  };
}

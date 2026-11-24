import { describe, it, expect } from 'vitest';
import type { ReconciledStatementItem } from '@/features/reconciliation/engine';
import {
  getCurrentSelectLinkValue,
  applyReconciliationLinkSelection,
  computeDerivedReconciliationStats,
} from '@/features/reconciliation/engine/reconciliation-ui-state';

function makeMockItem(overrides: Partial<ReconciledStatementItem>): ReconciledStatementItem {
  return {
    itemId: 'item-1',
    fileId: 'file-1',
    fileName: 'extrato.csv',
    fileFormat: 'CSV',
    bankName: 'Nubank',
    date: '2026-03-10',
    amountInCents: 18500,
    direction: 'OUTFLOW',
    originalDescription: 'PAGAMENTO CONTA LUZ',
    normalizedDescription: 'Pagamento Conta Luz',
    counterparty: 'Enel',
    paymentMethod: 'BOLETO',
    externalHash: 'fp-1',
    movementKind: 'EXPENSE',
    type: 'EXPENSE',
    nature: 'STATIC',
    financialActionCode: 'UTILITY_BILL_PAYMENT',
    financialActionLabel: 'Pagamento de Conta de Consumo',
    purpose: 'UTILITIES_ENERGY_WATER',
    purposeLabel: 'Energia / Água',
    isRecurringLikely: true,
    recurrenceHint: 'Mensal',
    categoryId: 'cat-home',
    categoryName: 'Moradia',
    tags: 'luz,enel',
    decisionType: 'CREATE_NEW',
    matchPrecision: 'NEW_ENTRY',
    matchedRuleId: null,
    matchedRuleDescription: null,
    matchedRuleAmountInCents: null,
    matchedTransactionId: null,
    matchedTransactionDescription: null,
    matchedTransactionAmountInCents: null,
    matchedInvoiceId: null,
    matchedInvoiceLabel: null,
    valueDifferenceInCents: 0,
    confidenceScore: 92,
    confidenceLevel: 'HIGH',
    reasons: ['Identificado como conta de energia.'],
    reasonSummary: 'Novo lançamento',
    alternativeCandidates: [],
    selectedForImport: true,
    requiresUserAttention: false,
    ...overrides,
  };
}

describe('Helpers de Estado da UI de Conciliação (Filtros e Vinculação Manual)', () => {
  it('applyReconciliationLinkSelection altera decisão para RULE, TX, SELF_TRANSFER, NEW_ENTRY e DISCARD', () => {
    const baseItem = makeMockItem({ amountInCents: 19500 });
    const rules = [
      {
        id: 'rule-luz',
        description: 'Energia Elétrica Enel',
        type: 'EXPENSE',
        nature: 'STATIC',
        amountInCents: 18000,
      },
    ];
    const txs = [
      {
        id: 'tx-previsto',
        description: 'Fatura Enel Prevista',
        type: 'EXPENSE',
        amountInCents: 19500,
      },
    ];

    const linkedRule = applyReconciliationLinkSelection({
      item: baseItem,
      selectionValue: 'RULE:rule-luz',
      recurrenceRules: rules,
      existingTransactions: txs,
    });
    expect(linkedRule.decisionType).toBe('RECONCILE_RULE');
    expect(linkedRule.matchedRuleId).toBe('rule-luz');
    expect(linkedRule.valueDifferenceInCents).toBe(1500);
    expect(getCurrentSelectLinkValue(linkedRule)).toBe('RULE:rule-luz');

    const linkedTx = applyReconciliationLinkSelection({
      item: linkedRule,
      selectionValue: 'TX:tx-previsto',
      recurrenceRules: rules,
      existingTransactions: txs,
    });
    expect(linkedTx.decisionType).toBe('RECONCILE_TRANSACTION');
    expect(linkedTx.matchedTransactionId).toBe('tx-previsto');
    expect(linkedTx.matchedRuleId).toBeNull();
    expect(getCurrentSelectLinkValue(linkedTx)).toBe('TX:tx-previsto');

    const selfTransfer = applyReconciliationLinkSelection({
      item: linkedTx,
      selectionValue: 'SELF_TRANSFER',
      recurrenceRules: rules,
      existingTransactions: txs,
    });
    expect(selfTransfer.decisionType).toBe('RECORD_SELF_TRANSFER');
    expect(selfTransfer.type).toBe('TRANSFER');
    expect(getCurrentSelectLinkValue(selfTransfer)).toBe('SELF_TRANSFER');

    const discarded = applyReconciliationLinkSelection({
      item: selfTransfer,
      selectionValue: 'DISCARD',
      recurrenceRules: rules,
      existingTransactions: txs,
    });
    expect(discarded.selectedForImport).toBe(false);
    expect(getCurrentSelectLinkValue(discarded)).toBe('DISCARD');

    const newEntry = applyReconciliationLinkSelection({
      item: discarded,
      selectionValue: 'NEW_ENTRY',
      recurrenceRules: rules,
      existingTransactions: txs,
    });
    expect(newEntry.decisionType).toBe('CREATE_NEW');
    expect(newEntry.selectedForImport).toBe(true);
    expect(getCurrentSelectLinkValue(newEntry)).toBe('NEW_ENTRY');
  });

  it('computeDerivedReconciliationStats filtra abas e calcula totais selecionados com precisão', () => {
    const items: ReconciledStatementItem[] = [
      makeMockItem({
        itemId: '1',
        type: 'INCOME',
        amountInCents: 500000,
        decisionType: 'RECONCILE_RULE',
        matchedRuleId: 'r1',
      }),
      makeMockItem({
        itemId: '2',
        type: 'EXPENSE',
        amountInCents: 4500,
        decisionType: 'CREATE_NEW',
      }),
      makeMockItem({
        itemId: '3',
        type: 'EXPENSE',
        amountInCents: 12000,
        decisionType: 'NEEDS_MANUAL_REVIEW',
        confidenceLevel: 'LOW',
        requiresUserAttention: true,
      }),
      makeMockItem({
        itemId: '4',
        type: 'EXPENSE',
        amountInCents: 4500,
        decisionType: 'SKIP_DUPLICATE',
        selectedForImport: false,
      }),
      makeMockItem({
        itemId: '5',
        type: 'TRANSFER',
        amountInCents: 90000,
        decisionType: 'RECORD_SELF_TRANSFER',
      }),
    ];

    const allStats = computeDerivedReconciliationStats(items, 'ALL');
    expect(allStats.filteredReviewItems).toHaveLength(5);
    expect(allStats.selectedItemsForConfirm).toHaveLength(4);
    expect(allStats.selectedIncomesCents).toBe(500000);
    expect(allStats.selectedExpensesCents).toBe(16500); // 4500 + 12000 (ignora duplicada e transfer)
    expect(allStats.selectedReconciledCount).toBe(1);
    expect(allStats.selectedNewCount).toBe(2);

    expect(computeDerivedReconciliationStats(items, 'RECONCILED').filteredReviewItems).toHaveLength(1);
    expect(computeDerivedReconciliationStats(items, 'NEW').filteredReviewItems).toHaveLength(1);
    expect(computeDerivedReconciliationStats(items, 'NEEDS_REVIEW').filteredReviewItems).toHaveLength(1);
    expect(computeDerivedReconciliationStats(items, 'DUPLICATES').filteredReviewItems).toHaveLength(1);
    expect(computeDerivedReconciliationStats(items, 'TRANSFERS_INVOICES').filteredReviewItems).toHaveLength(1);
  });
});

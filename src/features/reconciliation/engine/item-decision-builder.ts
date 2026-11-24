import { formatCentsToBRL } from '@/shared/lib/currency';
import { NormalizedRawMovement } from '@/features/reconciliation/parsers';
import { inferPurposeFromText } from '@/features/reconciliation/engine/purpose-classifier';
import { ExistingInvoiceCandidate, MatchPrecisionKind, ReconciledStatementItem, StatementImportReviewPlan } from '@/features/reconciliation/engine/reconciliation-types';
export function buildDuplicateReconciledItem(params: {
  mov: NormalizedRawMovement;
  baseSemantics: ReturnType<typeof inferPurposeFromText>;
  effectiveMovementKind: ReconciledStatementItem['movementKind'];
  txType: ReconciledStatementItem['type'];
  effectiveNature: ReconciledStatementItem['nature'];
  effectiveActionCode: string;
  effectiveActionLabel: string;
  effectivePurpose: ReconciledStatementItem['purpose'];
  matchedCategory?: { id: string; name: string };
  dupKind: MatchPrecisionKind;
  dupReason: string;
}): ReconciledStatementItem {
  const { mov, baseSemantics } = params;
  return {
    itemId: mov.rawId,
    fileId: mov.fileId,
    fileName: mov.fileName,
    fileFormat: mov.fileFormat,
    bankName: mov.bankName,
    date: mov.date,
    amountInCents: mov.amountInCents,
    direction: mov.direction,
    originalDescription: mov.originalDescription,
    normalizedDescription: mov.normalizedDescription,
    counterparty: mov.counterparty,
    paymentMethod: mov.paymentMethod,
    externalHash: mov.externalHash,
    movementKind: params.effectiveMovementKind,
    type: params.txType,
    nature: params.effectiveNature,
    financialActionCode: params.effectiveActionCode,
    financialActionLabel: params.effectiveActionLabel,
    purpose: params.effectivePurpose,
    purposeLabel: baseSemantics.purposeLabel,
    isRecurringLikely: baseSemantics.isRecurringLikely,
    recurrenceHint: baseSemantics.recurrenceHint,
    categoryId: params.matchedCategory?.id || '',
    categoryName: params.matchedCategory?.name || 'Sem Categoria',
    tags: 'duplicado,extrato',
    decisionType: 'SKIP_DUPLICATE',
    matchPrecision: params.dupKind,
    matchedRuleId: null,
    matchedRuleDescription: null,
    matchedRuleAmountInCents: null,
    matchedTransactionId: null,
    matchedTransactionDescription: null,
    matchedTransactionAmountInCents: null,
    matchedInvoiceId: null,
    matchedInvoiceLabel: null,
    valueDifferenceInCents: 0,
    confidenceScore: 98,
    confidenceLevel: 'HIGH',
    reasons: [params.dupReason],
    reasonSummary: params.dupReason,
    alternativeCandidates: [],
    selectedForImport: false,
    requiresUserAttention: false,
  };
}
export function buildSelfTransferReconciledItem(params: {
  mov: NormalizedRawMovement;
  effectiveActionCode: string;
  effectiveActionLabel: string;
}): ReconciledStatementItem {
  const { mov } = params;
  const reason =
    'Identificada como transferência/movimentação entre contas próprias. Não será contabilizada como receita ou despesa efetiva.';
  return {
    itemId: mov.rawId,
    fileId: mov.fileId,
    fileName: mov.fileName,
    fileFormat: mov.fileFormat,
    bankName: mov.bankName,
    date: mov.date,
    amountInCents: mov.amountInCents,
    direction: mov.direction,
    originalDescription: mov.originalDescription,
    normalizedDescription: mov.normalizedDescription,
    counterparty: mov.counterparty,
    paymentMethod: mov.paymentMethod,
    externalHash: mov.externalHash,
    movementKind: 'SELF_TRANSFER',
    type: 'TRANSFER',
    nature: 'VARIABLE',
    financialActionCode: params.effectiveActionCode,
    financialActionLabel: params.effectiveActionLabel,
    purpose: 'SELF_TRANSFER',
    purposeLabel: 'Transferência entre Contas Próprias',
    isRecurringLikely: false,
    recurrenceHint: null,
    categoryId: '',
    categoryName: 'Transferência Interna',
    tags: 'transferencia,contas-proprias',
    decisionType: 'RECORD_SELF_TRANSFER',
    matchPrecision: 'SEMANTIC_MATCH',
    matchedRuleId: null,
    matchedRuleDescription: null,
    matchedRuleAmountInCents: null,
    matchedTransactionId: null,
    matchedTransactionDescription: null,
    matchedTransactionAmountInCents: null,
    matchedInvoiceId: null,
    matchedInvoiceLabel: null,
    valueDifferenceInCents: 0,
    confidenceScore: 90,
    confidenceLevel: 'HIGH',
    reasons: [reason],
    reasonSummary: reason,
    alternativeCandidates: [],
    selectedForImport: true,
    requiresUserAttention: false,
  };
}
export function buildCreditCardPaymentReconciledItem(params: {
  mov: NormalizedRawMovement;
  existingInvoices: ExistingInvoiceCandidate[];
  matchedCategory?: { id: string; name: string };
}): ReconciledStatementItem {
  const { mov, existingInvoices, matchedCategory } = params;
  const unpaidInvoices = existingInvoices.filter((inv) => inv.status !== 'PAID');
  const bestInvoice = unpaidInvoices
    .map((inv) => {
      const diff = Math.abs(inv.totalAmountInCents - mov.amountInCents);
      const nameMatch = mov.originalDescription
        .toLowerCase()
        .includes(inv.creditCardName.toLowerCase());
      const score =
        (diff === 0 ? 50 : diff <= inv.totalAmountInCents * 0.1 ? 30 : 10) +
        (nameMatch ? 40 : 15);
      return { inv, score, diff };
    })
    .sort((a, b) => b.score - a.score)[0];
  const invoiceLabel = bestInvoice
    ? `Fatura ${bestInvoice.inv.creditCardName} (${String(bestInvoice.inv.month).padStart(
        2,
        '0'
      )}/${bestInvoice.inv.year})`
    : 'Fatura de Cartão de Crédito';
  const reason = bestInvoice
    ? `Pagamento de fatura conciliado com ${invoiceLabel} (${formatCentsToBRL(
        bestInvoice.inv.totalAmountInCents
      )}) — evita duplicar compras já lançadas no cartão.`
    : 'Identificado como pagamento de fatura de cartão de crédito — tratado como quitação de passivo para evitar dupla contagem das compras.';
  return {
    itemId: mov.rawId,
    fileId: mov.fileId,
    fileName: mov.fileName,
    fileFormat: mov.fileFormat,
    bankName: mov.bankName,
    date: mov.date,
    amountInCents: mov.amountInCents,
    direction: mov.direction,
    originalDescription: mov.originalDescription,
    normalizedDescription: bestInvoice ? `Pagamento ${invoiceLabel}` : mov.normalizedDescription,
    counterparty: mov.counterparty,
    paymentMethod: mov.paymentMethod,
    externalHash: mov.externalHash,
    movementKind: 'CREDIT_CARD_PAYMENT',
    type: 'EXPENSE',
    nature: 'VARIABLE',
    financialActionCode: 'CREDIT_CARD_BILL_PAYMENT',
    financialActionLabel: 'Pagamento de fatura de cartão',
    purpose: 'CREDIT_CARD_BILL',
    purposeLabel: 'Fatura de Cartão de Crédito',
    isRecurringLikely: true,
    recurrenceHint: 'Mensal',
    categoryId: matchedCategory?.id || '',
    categoryName: matchedCategory?.name || 'Cartão de Crédito',
    tags: 'fatura,cartao,conciliado',
    decisionType: 'PAY_CREDIT_CARD_INVOICE',
    matchPrecision: bestInvoice && bestInvoice.diff === 0 ? 'EXACT_MATCH' : 'SEMANTIC_MATCH',
    matchedRuleId: null,
    matchedRuleDescription: null,
    matchedRuleAmountInCents: null,
    matchedTransactionId: null,
    matchedTransactionDescription: null,
    matchedTransactionAmountInCents: null,
    matchedInvoiceId: bestInvoice?.inv.id || null,
    matchedInvoiceLabel: invoiceLabel,
    valueDifferenceInCents: bestInvoice
      ? mov.amountInCents - bestInvoice.inv.totalAmountInCents
      : 0,
    confidenceScore: bestInvoice ? 92 : 82,
    confidenceLevel: 'HIGH',
    reasons: [reason],
    reasonSummary: reason,
    alternativeCandidates: [],
    selectedForImport: true,
    requiresUserAttention: false,
  };
}
export function buildReviewPlanSummary(
  parsedFiles: Array<{ status: 'PROCESSED' | 'ERROR' }>,
  reconciledItems: ReconciledStatementItem[]
): StatementImportReviewPlan['summary'] {
  const activeItems = reconciledItems.filter((i) => i.decisionType !== 'SKIP_DUPLICATE');
  const incomeItems = activeItems.filter((i) => i.type === 'INCOME');
  const expenseItems = activeItems.filter(
    (i) => i.type === 'EXPENSE' && i.decisionType !== 'PAY_CREDIT_CARD_INVOICE'
  );
  return {
    totalFiles: parsedFiles.length,
    processedFiles: parsedFiles.filter((f) => f.status === 'PROCESSED').length,
    errorFiles: parsedFiles.filter((f) => f.status === 'ERROR').length,
    totalMovements: reconciledItems.length,
    identifiedIncomesCount: incomeItems.length,
    identifiedIncomesCents: incomeItems.reduce((acc, i) => acc + i.amountInCents, 0),
    identifiedExpensesCount: expenseItems.length,
    identifiedExpensesCents: expenseItems.reduce((acc, i) => acc + i.amountInCents, 0),
    reconciledCount: reconciledItems.filter(
      (i) =>
        i.decisionType === 'RECONCILE_RULE' ||
        i.decisionType === 'RECONCILE_TRANSACTION' ||
        i.decisionType === 'PAY_CREDIT_CARD_INVOICE'
    ).length,
    newEntriesCount: reconciledItems.filter((i) => i.decisionType === 'CREATE_NEW').length,
    selfTransfersAndInvoicesCount: reconciledItems.filter(
      (i) =>
        i.decisionType === 'RECORD_SELF_TRANSFER' ||
        i.decisionType === 'PAY_CREDIT_CARD_INVOICE'
    ).length,
    duplicatesCount: reconciledItems.filter((i) => i.decisionType === 'SKIP_DUPLICATE').length,
    needsReviewCount: reconciledItems.filter(
      (i) =>
        i.decisionType !== 'SKIP_DUPLICATE' &&
        (i.requiresUserAttention || i.confidenceLevel !== 'HIGH')
    ).length,
    highConfidenceCount: reconciledItems.filter((i) => i.confidenceLevel === 'HIGH').length,
    mediumConfidenceCount: reconciledItems.filter((i) => i.confidenceLevel === 'MEDIUM').length,
    lowConfidenceCount: reconciledItems.filter((i) => i.confidenceLevel === 'LOW').length,
  };
}

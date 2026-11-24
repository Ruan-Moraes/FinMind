import { resolveMovementDecision } from "@/features/reconciliation/engine/movement-decision-resolver";
import { formatCentsToBRL } from '@/shared/lib/currency';
import { resolveEffectiveRulesForMonth } from '@/features/planning/domain/recurrence-month-skip';
import { computeDeterministicHash, ParsedStatementFileResult, parseMultipleStatementFiles, StatementFileInput } from '@/features/reconciliation/parsers';
import { scoreExistingTransactionCandidate, scoreRecurrenceRuleCandidate } from '@/features/reconciliation/engine/candidate-scorer';
import { buildCreditCardPaymentReconciledItem, buildDuplicateReconciledItem, buildReviewPlanSummary, buildSelfTransferReconciledItem } from '@/features/reconciliation/engine/item-decision-builder';
import { buildMemoryPatternKey, inferPurposeFromText, isGenericBankDescription } from '@/features/reconciliation/engine/purpose-classifier';
import { AlternativeMatchOption, ExistingInvoiceCandidate, ExistingRuleCandidate, ExistingTransactionCandidate, FinancialPurpose, MatchPrecisionKind, OptionalAiEnrichmentItem, ReconciledStatementItem, StatementImportReviewPlan, StatementMovementKind, UserMemoryRuleCandidate } from '@/features/reconciliation/engine/reconciliation-types';
export async function runIntelligentReconciliationPipeline(params: {
  files: StatementFileInput[];
  parsedFiles?: ParsedStatementFileResult[];
  categories: Array<{ id: string;
    name: string;
    type: string;
    defaultNature: string;
  }>;
  recurrenceRules: ExistingRuleCandidate[];
  existingTransactions: ExistingTransactionCandidate[];
  existingInvoices?: ExistingInvoiceCandidate[];
  memoryRules?: UserMemoryRuleCandidate[];
  aiEnrichments?: Map<string, OptionalAiEnrichmentItem>;
}): Promise<StatementImportReviewPlan> {
  const parsedFiles: ParsedStatementFileResult[] =
    params.parsedFiles ?? (await parseMultipleStatementFiles(params.files));
  const categories = params.categories || [];
  const recurrenceRules = params.recurrenceRules || [];
  const existingTransactions = params.existingTransactions || [];
  const existingInvoices = params.existingInvoices || [];
  const memoryRules = params.memoryRules || [];
  const defaultExpenseCat =
    categories.find((c) => c.type === 'EXPENSE') ||
    categories[0] || { id: '', name: 'Despesas Gerais', type: 'EXPENSE', defaultNature: 'VARIABLE' };
  const defaultIncomeCat =
    categories.find((c) => c.type === 'INCOME') ||
    categories[0] || { id: '', name: 'Receitas Gerais', type: 'INCOME', defaultNature: 'VARIABLE' };
  const seenHashesInBatch = new Map<string, string>();
  const existingDbHashes = new Set<string>( existingTransactions
      .map((t) => t.externalTransactionHash)
      .filter((h): h is string => Boolean(h)) );
  const claimedRuleMonthKeys = new Set<string>();
  const claimedTransactionIds = new Set<string>();
  const reconciledItems: ReconciledStatementItem[] = [];
  for (const fileResult of parsedFiles) { if (fileResult.status !== 'PROCESSED') continue;
    for (const mov of fileResult.movements) { const monthKey = mov.date.slice(0, 7);
      const patternKey = buildMemoryPatternKey(mov.originalDescription);
      const memoryMatch =
        memoryRules.find( (m) =>
            m.normalizedPattern === patternKey ||
            (m.merchantKeyword &&
              m.merchantKeyword.length >= 4 &&
              patternKey.includes(m.merchantKeyword.toUpperCase()))
        ) || null;
      const baseSemantics = inferPurposeFromText(mov.originalDescription, mov.direction);
      const aiHint = params.aiEnrichments?.get(mov.rawId);
      const effectivePurpose: FinancialPurpose =
        (memoryMatch?.purpose as FinancialPurpose) || aiHint?.purpose || baseSemantics.purpose;
      const effectiveMovementKind: StatementMovementKind =
        aiHint?.movementKind || baseSemantics.movementKind;
      const effectiveActionCode = memoryMatch?.financialAction || baseSemantics.actionCode;
      const effectiveActionLabel = aiHint?.financialActionLabel || baseSemantics.actionLabel;
      const txType: 'INCOME' | 'EXPENSE' | 'TRANSFER' =
        effectiveMovementKind === 'SELF_TRANSFER'
          ? 'TRANSFER'
          : mov.direction === 'INFLOW'
          ? 'INCOME'
          : 'EXPENSE';
      const targetCategoryType = txType === 'INCOME' ? 'INCOME' : 'EXPENSE';
      const memCat = memoryMatch?.categoryId
        ? categories.find((c) => c.id === memoryMatch.categoryId)
        : undefined;
      const aiCat = aiHint?.categoryId
        ? categories.find((c) => c.id === aiHint.categoryId)
        : undefined;
      const semanticCat =
        effectivePurpose !== 'GENERAL_UNKNOWN' && effectivePurpose !== 'PEER_TRANSFER'
          ? categories.find( (c) =>
                c.type === targetCategoryType &&
                baseSemantics.categoryKeywords.test( c.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                ) )
          : undefined;
      const catchAllCat = categories.find( (c) =>
          c.type === targetCategoryType &&
          /\b(outras|outros|geral|diversos|pix|compras)\b/i.test( c.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          ) );
      let matchedCategory = memCat || aiCat || semanticCat || catchAllCat;
      let classificationSource: ReconciledStatementItem['classificationSource'] = memCat
        ? 'USER_MEMORY'
        : aiCat
        ? 'AI_MODEL'
        : semanticCat
        ? 'SEMANTIC_RULE'
        : catchAllCat
        ? 'SEMANTIC_RULE'
        : 'UNCLASSIFIED';
      if ( !matchedCategory &&
        effectivePurpose !== 'GENERAL_UNKNOWN' &&
        effectivePurpose !== 'PEER_TRANSFER'
      ) { matchedCategory = txType === 'INCOME' ? defaultIncomeCat : defaultExpenseCat;
        if (matchedCategory?.id) { classificationSource = 'SEMANTIC_RULE';
        }
      }
      const effectiveNature: 'STATIC' | 'VARIABLE' =
        (memoryMatch?.nature as 'STATIC' | 'VARIABLE') ||
        aiHint?.nature ||
        baseSemantics.defaultNature ||
        (matchedCategory?.defaultNature as 'STATIC' | 'VARIABLE') ||
        'VARIABLE';
      const semanticDedupKey = computeDeterministicHash(
        `${mov.date}:${mov.amountInCents}:${mov.direction}:${patternKey}`
      );
      const firstSeenFile =
        seenHashesInBatch.get(mov.externalHash) || seenHashesInBatch.get(semanticDedupKey);
      const isDuplicateInBatch = firstSeenFile !== undefined && firstSeenFile !== mov.fileName;
      const isSameFileFitIdDup =
        Boolean(mov.fitId) && seenHashesInBatch.has(`FIT:${mov.fileId}:${mov.fitId}`);
      if (!firstSeenFile) { seenHashesInBatch.set(mov.externalHash, mov.fileName);
        seenHashesInBatch.set(semanticDedupKey, mov.fileName);
      }
      if (mov.fitId) { seenHashesInBatch.set(`FIT:${mov.fileId}:${mov.fitId}`, mov.fileName);
      }
      const isDuplicateInDb =
        existingDbHashes.has(mov.externalHash) ||
        existingTransactions.some( (t) =>
            t.externalTransactionHash === mov.externalHash ||
            (t.status === 'COMPLETED' &&
              t.amountInCents === mov.amountInCents &&
              t.date.slice(0, 10) === mov.date &&
              t.rawBankDescription &&
              buildMemoryPatternKey(t.rawBankDescription) === patternKey) );
      if (isDuplicateInBatch || isSameFileFitIdDup || isDuplicateInDb) {
        const dupKind: MatchPrecisionKind = isDuplicateInDb
          ? 'DUPLICATE_IN_DB'
          : 'DUPLICATE_IN_BATCH';
        const dupReason = isDuplicateInDb
          ? 'Movimentação já importada e confirmada anteriormente no banco de dados.'
          : `Movimentação repetida já presente no arquivo "${firstSeenFile || mov.fileName}" (período sobreposto).`;
        reconciledItems.push( buildDuplicateReconciledItem({
            mov, baseSemantics, effectiveMovementKind, txType,
            effectiveNature, effectiveActionCode, effectiveActionLabel, effectivePurpose, matchedCategory, dupKind, dupReason, })
        );
        continue;
      }
      if (effectiveMovementKind === 'SELF_TRANSFER') {
        reconciledItems.push( buildSelfTransferReconciledItem({
            mov, effectiveActionCode, effectiveActionLabel, }) );
        continue;
      }
      if (effectiveMovementKind === 'CREDIT_CARD_PAYMENT' && mov.direction === 'OUTFLOW') {
        reconciledItems.push( buildCreditCardPaymentReconciledItem({
            mov, existingInvoices, matchedCategory, }) );
        continue;
      }
      const [movYear, movMonth] = monthKey.split('-').map(Number);
      const effectiveRulesForMovMonth =
        movYear && movMonth
          ? resolveEffectiveRulesForMonth(recurrenceRules, movYear, movMonth)
          : recurrenceRules;
      const ruleEvaluations = effectiveRulesForMovMonth
        .filter((r) => !claimedRuleMonthKeys.has(`${monthKey}::${r.id}`))
        .map((rule) => ({
          rule, evalResult: scoreRecurrenceRuleCandidate({
            movement: mov, movementSemantics: { ...baseSemantics, purpose: effectivePurpose },
            rule, memoryMatch, }), }))
        .sort((a, b) => b.evalResult.score - a.evalResult.score);
      const txEvaluations = existingTransactions
        .filter( (tx) =>
            !claimedTransactionIds.has(tx.id) &&
            (tx.status === 'PENDING' || !tx.externalTransactionHash) )
        .map((tx) => ({
          tx, evalResult: scoreExistingTransactionCandidate({
            movement: mov, movementSemantics: { ...baseSemantics, purpose: effectivePurpose },
            tx, }), }))
        .sort((a, b) => b.evalResult.score - a.evalResult.score);
      const alternativeCandidates: AlternativeMatchOption[] = [];
      for (const rItem of ruleEvaluations.slice(0, 3)) {
        if (rItem.evalResult.score > 0) {
          alternativeCandidates.push({
            targetKind: 'RULE', targetId: rItem.rule.id,
            label: `${rItem.rule.description} — ${formatCentsToBRL(rItem.rule.amountInCents)} (${
              rItem.rule.type === 'INCOME' ? 'Receita recorrente' : 'Despesa fixa'
            })`, amountInCents: rItem.rule.amountInCents,
            score: rItem.evalResult.score, reasonSummary: rItem.evalResult.reasons.join(' • '), });
        }
      }
      for (const tItem of txEvaluations.slice(0, 3)) {
        if (tItem.evalResult.score > 0) {
          alternativeCandidates.push({
            targetKind: 'TRANSACTION', targetId: tItem.tx.id,
            label: `${tItem.tx.description} — ${formatCentsToBRL(tItem.tx.amountInCents)} (${
              tItem.tx.status === 'PENDING' ? 'Previsto' : 'Existente'
            })`, amountInCents: tItem.tx.amountInCents,
            score: tItem.evalResult.score, reasonSummary: tItem.evalResult.reasons.join(' • '), });
        }
      }
      const bestRule = ruleEvaluations[0];
      const bestTx = txEvaluations[0];
      const sameValueRules = effectiveRulesForMovMonth.filter( (r) =>
          (r.type === 'INCOME' ? 'INFLOW' : 'OUTFLOW') === mov.direction &&
          Math.abs(r.amountInCents - mov.amountInCents) <= r.amountInCents * 0.05 );
      const isGenericDesc = isGenericBankDescription(mov.originalDescription);
      reconciledItems.push( resolveMovementDecision({
          mov, monthKey, baseSemantics, effectivePurpose, effectiveMovementKind,
          effectiveActionCode, effectiveActionLabel, txType, effectiveNature,
          matchedCategory, classificationSource, categories, bestRule, bestTx,
          sameValueRules, isGenericDesc, memoryMatch, alternativeCandidates, claimedRuleMonthKeys, claimedTransactionIds, })
      );
    }
  }
  const partialItemsByRule = new Map<string, ReconciledStatementItem[]>();
  for (const item of reconciledItems) {
    if ( item.decisionType === 'RECONCILE_RULE' &&
      item.matchPrecision === 'PARTIAL_PAYMENT' &&
      item.matchedRuleId
    ) { const list = partialItemsByRule.get(item.matchedRuleId) || [];
      list.push(item);
      partialItemsByRule.set(item.matchedRuleId, list);
    }
  }
  for (const [ruleId, group] of partialItemsByRule.entries()) {
    if (group.length >= 2) { const rule = recurrenceRules.find((r) => r.id === ruleId);
      if (!rule) continue;
      const sumCents = group.reduce((acc, g) => acc + g.amountInCents, 0);
      if (Math.abs(sumCents - rule.amountInCents) <= rule.amountInCents * 0.05) {
        for (let idx = 0; idx < group.length; idx++) { const gItem = group[idx];
          gItem.matchPrecision = 'MULTI_MOVEMENT_GROUP';
          gItem.confidenceScore = 82;
          gItem.confidenceLevel = 'HIGH';
          gItem.requiresUserAttention = false;
          const groupNote = `Parte ${idx + 1}/${group.length} de múltiplas movimentações que somam ${formatCentsToBRL(
            sumCents
          )} para quitar "${rule.description}"`;
          gItem.reasons = [groupNote, ...gItem.reasons];
          gItem.reasonSummary = gItem.reasons.join(' • ');
        }
      }
    }
  }
  const summary = buildReviewPlanSummary(parsedFiles, reconciledItems);
  return {
    files: parsedFiles.map((f) => ({
      fileId: f.fileId, fileName: f.fileName, fileFormat: f.fileFormat, bankName: f.bankName,
      periodStart: f.periodStart, periodEnd: f.periodEnd, fileHash: f.fileHash, status: f.status,
      errorMessage: f.errorMessage, extractedCount: f.movements.length, ignoredNonEffectiveLines: f.ignoredNonEffectiveLines,
      openingBalanceInCents: f.openingBalanceInCents ?? null,
      closingBalanceInCents: f.closingBalanceInCents ?? null, })), items: reconciledItems, summary, };
}

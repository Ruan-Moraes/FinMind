import { formatCentsToBRL } from "@/shared/lib/currency";
import { NormalizedRawMovement } from "@/features/reconciliation/parsers";
import { inferPurposeFromText } from "@/features/reconciliation/engine/purpose-classifier";
import { scoreRecurrenceRuleCandidate } from "@/features/reconciliation/engine/candidate-scorer";
import { AlternativeMatchOption, ConfidenceLevel, ExistingRuleCandidate, ExistingTransactionCandidate, FinancialPurpose, ReconciledStatementItem, StatementMovementKind, UserMemoryRuleCandidate } from "@/features/reconciliation/engine/reconciliation-types";
export function resolveMovementDecision(params: {
  mov: NormalizedRawMovement;
  monthKey: string;
  baseSemantics: ReturnType<typeof inferPurposeFromText>;
  effectivePurpose: FinancialPurpose;
  effectiveMovementKind: StatementMovementKind;
  effectiveActionCode: string;
  effectiveActionLabel: string;
  txType: "INCOME" | "EXPENSE" | "TRANSFER";
  effectiveNature: "STATIC" | "VARIABLE";
  matchedCategory?: { id: string; name: string; type: string; defaultNature: string };
  classificationSource: ReconciledStatementItem["classificationSource"];
  categories: Array<{ id: string; name: string; type: string; defaultNature: string }>;
  bestRule?: { rule: ExistingRuleCandidate; evalResult: ReturnType<typeof scoreRecurrenceRuleCandidate> };
  bestTx?: { tx: ExistingTransactionCandidate; evalResult: ReturnType<typeof scoreRecurrenceRuleCandidate> };
  sameValueRules: ExistingRuleCandidate[];
  isGenericDesc: boolean;
  memoryMatch: UserMemoryRuleCandidate | null;
  alternativeCandidates: AlternativeMatchOption[];
  claimedRuleMonthKeys: Set<string>;
  claimedTransactionIds: Set<string>;
}): ReconciledStatementItem {
  const {
    mov, monthKey, baseSemantics, effectivePurpose, effectiveMovementKind,
    effectiveActionCode, effectiveActionLabel, txType, classificationSource,
    categories, bestRule, bestTx, sameValueRules, isGenericDesc, memoryMatch,
    alternativeCandidates, claimedRuleMonthKeys, claimedTransactionIds, } = params;
  let { effectiveNature, matchedCategory } = params;
      if (
        bestTx &&
        bestTx.evalResult.hasSemanticHarmony &&
        !bestTx.evalResult.hasSemanticConflict &&
        bestTx.evalResult.score >= 55 &&
        (!bestRule || bestTx.evalResult.score >= bestRule.evalResult.score)
      ) { const matchedTx = bestTx.tx;
        const evalRes = bestTx.evalResult;
        claimedTransactionIds.add(matchedTx.id);
        if (matchedTx.categoryId) { const foundCat = categories.find((c) => c.id === matchedTx.categoryId);
          if (foundCat) matchedCategory = foundCat;
        }
        effectiveNature = matchedTx.nature;
        const isHighConf =
          evalRes.score >= 75 && evalRes.precision === 'EXACT_MATCH' && !isGenericDesc;
        const confLevel: ConfidenceLevel = isHighConf
          ? 'HIGH'
          : evalRes.score >= 55
          ? 'MEDIUM'
          : 'LOW';
        const confScore = Math.min(99, Math.max(40, evalRes.score));
        return {
          itemId: mov.rawId, fileId: mov.fileId,
          fileName: mov.fileName, fileFormat: mov.fileFormat,
          bankName: mov.bankName, date: mov.date,
          amountInCents: mov.amountInCents, direction: mov.direction,
          originalDescription: mov.originalDescription, normalizedDescription: matchedTx.description,
          counterparty: mov.counterparty, paymentMethod: mov.paymentMethod,
          externalHash: mov.externalHash, movementKind: effectiveMovementKind,
          type: txType, nature: effectiveNature,
          financialActionCode: effectiveActionCode, financialActionLabel: effectiveActionLabel,
          purpose: effectivePurpose, purposeLabel: baseSemantics.purposeLabel,
          isRecurringLikely: baseSemantics.isRecurringLikely, recurrenceHint: baseSemantics.recurrenceHint,
          categoryId: matchedCategory?.id || '', categoryName: matchedCategory?.name || 'Sem Categoria',
          tags: 'conciliado,extrato', decisionType: 'RECONCILE_TRANSACTION',
          matchPrecision: evalRes.precision, matchedRuleId: matchedTx.recurrenceRuleId,
          matchedRuleDescription: null, matchedRuleAmountInCents: null,
          matchedTransactionId: matchedTx.id, matchedTransactionDescription: matchedTx.description,
          matchedTransactionAmountInCents: matchedTx.amountInCents, matchedInvoiceId: null,
          matchedInvoiceLabel: null, valueDifferenceInCents: mov.amountInCents - matchedTx.amountInCents,
          confidenceScore: confScore, confidenceLevel: confLevel,
          reasons: evalRes.reasons, reasonSummary: evalRes.reasons.join(' • '),
          alternativeCandidates, selectedForImport: true,
          requiresUserAttention: confLevel !== 'HIGH', };
      }
      if (
        bestRule &&
        bestRule.evalResult.hasSemanticHarmony &&
        !bestRule.evalResult.hasSemanticConflict &&
        bestRule.evalResult.score >= 52
      ) { const matchedRule = bestRule.rule;
        const evalRes = bestRule.evalResult;
        if (evalRes.precision !== 'PARTIAL_PAYMENT') {
          claimedRuleMonthKeys.add(`${monthKey}::${matchedRule.id}`);
        }
        if (matchedRule.categoryId) {
          const foundCat = categories.find((c) => c.id === matchedRule.categoryId);
          if (foundCat) matchedCategory = foundCat;
        }
        effectiveNature = matchedRule.nature;
        const competingSameValueRule = sameValueRules.find((r) => r.id !== matchedRule.id);
        const enrichedReasons = [...evalRes.reasons];
        if (competingSameValueRule) {
          enrichedReasons.push(
            `Diferenciado de "${competingSameValueRule.description}" (${formatCentsToBRL(
              competingSameValueRule.amountInCents
            )}) pela ação e finalidade semântica`
          );
        }
        const isHighConf =
          evalRes.score >= 75 && evalRes.precision === 'EXACT_MATCH' && !isGenericDesc;
        const confLevel: ConfidenceLevel = isHighConf
          ? 'HIGH'
          : evalRes.score >= 52
          ? 'MEDIUM'
          : 'LOW';
        const confScore = Math.min(99, Math.max(45, evalRes.score));
        return {
          itemId: mov.rawId, fileId: mov.fileId,
          fileName: mov.fileName, fileFormat: mov.fileFormat,
          bankName: mov.bankName, date: mov.date,
          amountInCents: mov.amountInCents, direction: mov.direction,
          originalDescription: mov.originalDescription, normalizedDescription: matchedRule.description,
          counterparty: mov.counterparty, paymentMethod: mov.paymentMethod,
          externalHash: mov.externalHash,
          movementKind: matchedRule.type === 'EXPENSE' ? 'OBLIGATION_PAYMENT' : 'INCOME',
          type: matchedRule.type, nature: effectiveNature,
          financialActionCode: effectiveActionCode, financialActionLabel: effectiveActionLabel,
          purpose: effectivePurpose, purposeLabel: baseSemantics.purposeLabel,
          isRecurringLikely: true, recurrenceHint: 'Mensal',
          categoryId: matchedCategory?.id || '',
          categoryName: matchedCategory?.name || matchedRule.categoryName || 'Sem Categoria',
          tags: 'conciliado,recorrente,extrato', decisionType: 'RECONCILE_RULE',
          matchPrecision: evalRes.precision, matchedRuleId: matchedRule.id,
          matchedRuleDescription: matchedRule.description,
          matchedRuleAmountInCents: matchedRule.amountInCents, matchedTransactionId: null,
          matchedTransactionDescription: null, matchedTransactionAmountInCents: null,
          matchedInvoiceId: null, matchedInvoiceLabel: null,
          valueDifferenceInCents: mov.amountInCents - matchedRule.amountInCents, confidenceScore: confScore,
          confidenceLevel: confLevel, reasons: enrichedReasons,
          reasonSummary: enrichedReasons.join(' • '), alternativeCandidates,
          selectedForImport: true, requiresUserAttention: confLevel !== 'HIGH',
        };
      }
      if (
        sameValueRules.length > 0 &&
        (isGenericDesc ||
          effectivePurpose === 'PEER_TRANSFER' ||
          effectivePurpose === 'GENERAL_UNKNOWN')
      ) { const candidateNames = sameValueRules.map((r) => `"${r.description}"`).join(' ou ');
        const ambiguityReason = `O valor (${formatCentsToBRL(
          mov.amountInCents
        )}) coincide com ${candidateNames}, mas a descrição bancária ("${
          mov.originalDescription
        }") não traz finalidade ou destinatário suficiente para conciliar com segurança. Revise manualmente.`;
        return {
          itemId: mov.rawId, fileId: mov.fileId,
          fileName: mov.fileName, fileFormat: mov.fileFormat,
          bankName: mov.bankName, date: mov.date,
          amountInCents: mov.amountInCents, direction: mov.direction,
          originalDescription: mov.originalDescription, normalizedDescription: mov.normalizedDescription,
          counterparty: mov.counterparty, paymentMethod: mov.paymentMethod,
          externalHash: mov.externalHash, movementKind: effectiveMovementKind,
          type: txType, nature: effectiveNature,
          financialActionCode: effectiveActionCode, financialActionLabel: effectiveActionLabel,
          purpose: effectivePurpose, purposeLabel: baseSemantics.purposeLabel,
          isRecurringLikely: false, recurrenceHint: null,
          categoryId: matchedCategory?.id || '', categoryName: matchedCategory?.name || 'Sem Categoria',
          tags: 'revisao,ambiguo', decisionType: 'NEEDS_MANUAL_REVIEW',
          matchPrecision: 'AMBIGUOUS_CANDIDATES', matchedRuleId: null,
          matchedRuleDescription: null, matchedRuleAmountInCents: null,
          matchedTransactionId: null, matchedTransactionDescription: null,
          matchedTransactionAmountInCents: null, matchedInvoiceId: null,
          matchedInvoiceLabel: null, valueDifferenceInCents: 0,
          confidenceScore: 30, confidenceLevel: 'LOW',
          reasons: [ambiguityReason], reasonSummary: ambiguityReason,
          alternativeCandidates: sameValueRules.map((r) => ({
            targetKind: 'RULE', targetId: r.id,
            label: `${r.description} — ${formatCentsToBRL(r.amountInCents)}`,
            amountInCents: r.amountInCents, score: 35,
            reasonSummary: 'Mesmo valor financeiro, aguardando confirmação de finalidade', })),
          selectedForImport: true, requiresUserAttention: true,
        };
      }
      const hasClearPurpose =
        effectivePurpose !== 'GENERAL_UNKNOWN' &&
        effectivePurpose !== 'PEER_TRANSFER' &&
        !isGenericDesc;
      const newEntryConfidence: ConfidenceLevel = memoryMatch
        ? 'HIGH'
        : hasClearPurpose
        ? 'HIGH'
        : !isGenericDesc
        ? 'MEDIUM'
        : 'LOW';
      const newEntryScore =
        newEntryConfidence === 'HIGH' ? 88 : newEntryConfidence === 'MEDIUM' ? 66 : 38;
      const newEntryReasons: string[] = [];
      if (hasClearPurpose) {
        newEntryReasons.push(
          `Ação identificada: ${effectiveActionLabel} (${baseSemantics.purposeLabel})`
        );
        newEntryReasons.push(
          `Sem obrigação prévia correspondente no período — preparado como novo lançamento em "${
            matchedCategory?.name || 'Geral'
          }"`
        );
      } else if (!isGenericDesc) {
        newEntryReasons.push(
          `Novo lançamento identificado para "${mov.normalizedDescription}" — revise a categoria sugerida ("${
            matchedCategory?.name || 'Geral'
          }")`
        );
      } else {
        newEntryReasons.push(
          `Descrição bancária genérica ("${mov.originalDescription}") — requer classificação manual antes da confirmação`
        );
      }
      return {
        itemId: mov.rawId, fileId: mov.fileId,
        fileName: mov.fileName, fileFormat: mov.fileFormat,
        bankName: mov.bankName, date: mov.date,
        amountInCents: mov.amountInCents, direction: mov.direction,
        originalDescription: mov.originalDescription, normalizedDescription: mov.normalizedDescription,
        counterparty: mov.counterparty, paymentMethod: mov.paymentMethod,
        externalHash: mov.externalHash, movementKind: effectiveMovementKind,
        type: txType, nature: effectiveNature,
        financialActionCode: effectiveActionCode, financialActionLabel: effectiveActionLabel,
        purpose: effectivePurpose, purposeLabel: baseSemantics.purposeLabel,
        isRecurringLikely: baseSemantics.isRecurringLikely, recurrenceHint: baseSemantics.recurrenceHint,
        categoryId: matchedCategory?.id || '', categoryName: matchedCategory?.name || 'Sem Categoria',
        tags: hasClearPurpose ? `${effectivePurpose.toLowerCase()},extrato` : 'extrato,novo',
        classificationSource, isAiClassified:
          classificationSource === 'AI_MODEL' || classificationSource === 'SEMANTIC_RULE',
        isUserConfirmed: classificationSource === 'USER_MEMORY',
        decisionType: newEntryConfidence === 'LOW' ? 'NEEDS_MANUAL_REVIEW' : 'CREATE_NEW',
        matchPrecision: 'NEW_ENTRY', matchedRuleId: null,
        matchedRuleDescription: null, matchedRuleAmountInCents: null,
        matchedTransactionId: null, matchedTransactionDescription: null,
        matchedTransactionAmountInCents: null, matchedInvoiceId: null,
        matchedInvoiceLabel: null, valueDifferenceInCents: 0,
        confidenceScore: newEntryScore, confidenceLevel: newEntryConfidence,
        reasons: newEntryReasons, reasonSummary: newEntryReasons.join(' • '),
        alternativeCandidates, selectedForImport: true,
        requiresUserAttention: newEntryConfidence !== 'HIGH' || !matchedCategory?.id, };
}
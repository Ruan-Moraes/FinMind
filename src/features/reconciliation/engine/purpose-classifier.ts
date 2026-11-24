import { ConfidenceLevel, FinancialPurpose, StatementMovementKind, UserMemoryRuleCandidate } from '@/features/reconciliation/engine/reconciliation-types';
import { SEMANTIC_TAXONOMY } from '@/features/reconciliation/engine/semantic-taxonomy';
export function sanitizeTextForExternalAi(rawText: string): string {
  return rawText
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '***.***.***-**')
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '**.***.***/****-**')
    .replace(/\b(?:\d{4}[\s-]?){3,4}\d{4}\b/g, '****-****-****-****');
}
export function inferPurposeFromText(
  text: string, directionHint?: 'INFLOW' | 'OUTFLOW'
): { purpose: FinancialPurpose;
  purposeLabel: string;
  actionCode: string;
  actionLabel: string;
  movementKind: StatementMovementKind;
  defaultNature: 'STATIC' | 'VARIABLE';
  isRecurringLikely: boolean;
  recurrenceHint: string | null;
  categoryKeywords: RegExp;
} {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  for (const spec of SEMANTIC_TAXONOMY) {
    if (spec.patterns.some((re) => re.test(normalized))) { const isInflow = directionHint === 'INFLOW';
      let movementKind: StatementMovementKind = spec.defaultMovementKindOutflow;
      if (spec.purpose === 'SELF_TRANSFER') { movementKind = 'SELF_TRANSFER';
      } else if (spec.purpose === 'REFUND_REVERSAL') { movementKind = 'REFUND';
      } else if (isInflow) { movementKind = 'INCOME';
      }
      return {
        purpose: spec.purpose, purposeLabel: spec.purposeLabel,
        actionCode: isInflow ? spec.inflowActionCode : spec.outflowActionCode,
        actionLabel: isInflow ? spec.inflowActionLabel : spec.outflowActionLabel, movementKind,
        defaultNature: spec.defaultNature, isRecurringLikely: spec.isRecurringLikely,
        recurrenceHint: spec.recurrenceHint, categoryKeywords: spec.categoryKeywords,
      };
    }
  }
  const isTransferText = /\b(pix|ted|doc|transf|transferencia)\b/i.test(normalized);
  if (directionHint === 'INFLOW') {
    return {
      purpose: isTransferText ? 'PEER_TRANSFER' : 'GENERAL_UNKNOWN',
      purposeLabel: isTransferText ? 'Transferência Recebida' : 'Receita Geral',
      actionCode: isTransferText ? 'TRANSFER_RECEIVED' : 'GENERAL_INCOME',
      actionLabel: isTransferText ? 'Transferência recebida' : 'Entrada financeira', movementKind: 'INCOME',
      defaultNature: 'VARIABLE', isRecurringLikely: false,
      recurrenceHint: null, categoryKeywords: /renda|receita|extra|outros/i,
    };
  }
  return {
    purpose: isTransferText ? 'PEER_TRANSFER' : 'GENERAL_UNKNOWN',
    purposeLabel: isTransferText ? 'Transferência para Terceiros' : 'Despesa Geral',
    actionCode: isTransferText ? 'PEER_TRANSFER' : 'GENERAL_EXPENSE',
    actionLabel: isTransferText ? 'Transferência para outra pessoa' : 'Pagamento / Compra',
    movementKind: 'EXPENSE', defaultNature: 'VARIABLE',
    isRecurringLikely: false, recurrenceHint: null,
    categoryKeywords: /outros|geral|despesa/i, };
}
export function calculateTokenSimilarity(a: string, b: string): number {
  const stopWords = new Set([
    'de', 'da',
    'do', 'das',
    'dos', 'em',
    'no', 'na',
    'para', 'por',
    'com', 'pix',
    'ted', 'doc',
    'enviado', 'recebido',
    'recebida', 'pagamento',
    'pagto', 'debito',
    'credito', 'compra',
    'automatico', 'eletr',
    'eletronico', 'fatura',
    'conta', 'boleto',
    'sa', 'ltda',
  ]);
  const tokenize = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !stopWords.has(w));
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  let matches = 0;
  for (const tA of tokensA) {
    if (
      tokensB.some(
        (tB) =>
          tB === tA ||
          (tA.length >= 4 && tB.includes(tA)) ||
          (tB.length >= 4 && tA.includes(tB))
      )
    ) { matches += 1;
    }
  }
  return matches / Math.max(tokensA.length, tokensB.length);
}
export function isGenericBankDescription(rawDescription: string): boolean {
  const cleaned = rawDescription
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(
      /\b(pix|ted|doc|enviado|recebido|recebida|pagamento|pagto|debito|credito|compra|boleto|transferencia|transf|automatico|em|conta|cartao|no|na|de|do|da|valor|r\$|\d+)\b/g,
      ' '
    )
    .replace(/[^a-z]/g, '')
    .trim();
  return cleaned.length < 3;
}
export function buildMemoryPatternKey(rawDescription: string): string {
  return rawDescription
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\b\d{2}\/\d{2}(?:\/\d{2,4})?\b/g, '')
    .replace(/\b\d{4,}\b/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}
export function enrichTransactionMetadata(params: {
  rawDescription: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  categories: Array<{ id: string; name: string; type: string; defaultNature: string }>;
  memoryRules?: UserMemoryRuleCandidate[];
}): { normalizedDescription: string;
  counterparty: string | null;
  paymentMethod: string;
  financialActionCode: string;
  financialActionLabel: string;
  purpose: FinancialPurpose;
  purposeLabel: string;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  suggestedNature: 'STATIC' | 'VARIABLE';
  isRecurringLikely: boolean;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  classificationSource: 'USER_MEMORY' | 'SEMANTIC_RULE' | 'UNCLASSIFIED';
} { const { rawDescription, type, categories, memoryRules = [] } = params;
  const directionHint = type === 'INCOME' ? 'INFLOW' : 'OUTFLOW';
  const patternKey = buildMemoryPatternKey(rawDescription);
  const memoryMatch =
    memoryRules.find(
      (m) =>
        m.normalizedPattern === patternKey ||
        (m.merchantKeyword &&
          m.merchantKeyword.length >= 4 &&
          patternKey.includes(m.merchantKeyword.toUpperCase()))
    ) || null;
  const baseSemantics = inferPurposeFromText(rawDescription, directionHint);
  const paymentMethodMatch = rawDescription.match(/\b(PIX|TED|DOC|BOLETO|DEBITO|CREDITO)\b/i);
  const paymentMethod = paymentMethodMatch ? paymentMethodMatch[1].toUpperCase() : 'OUTRO';
  const cleanEntity = rawDescription
    .replace(
      /^(?:TRANSFERENCIA\s+PIX\s+(?:ENVIADA|RECEBIDA)|PIX\s+(?:ENVIADO|RECEBIDO)|TED\s+(?:RECEBIDA|ENVIADA)|PAGAMENTO\s+(?:COM\s+QR\s+PIX|COM\s+PIX|DE\s+BOLETO)?|COMPRA\s+(?:CARTAO|DEBITO|CREDITO)?|DEBITO\s+(?:AUTOMATICO)?)\s*[-:/•|]*\s*/i,
      ''
    )
    .trim();
  const counterparty =
    cleanEntity.length >= 2 && cleanEntity.toLowerCase() !== rawDescription.toLowerCase()
      ? cleanEntity
      : null;
  const targetType = type === 'INCOME' ? 'INCOME' : 'EXPENSE';
  const memCat = memoryMatch?.categoryId
    ? categories.find((c) => c.id === memoryMatch.categoryId)
    : undefined;
  const semCat =
    baseSemantics.purpose !== 'GENERAL_UNKNOWN' && baseSemantics.purpose !== 'PEER_TRANSFER'
      ? categories.find(
          (c) =>
            c.type === targetType &&
            baseSemantics.categoryKeywords.test(
              c.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            )
        )
      : undefined;
  const matchedCat = memCat || semCat || undefined;
  const classificationSource = memCat
    ? 'USER_MEMORY'
    : semCat
    ? 'SEMANTIC_RULE'
    : 'UNCLASSIFIED';
  const confidenceScore = memCat
    ? 95
    : baseSemantics.purpose !== 'GENERAL_UNKNOWN' && baseSemantics.purpose !== 'PEER_TRANSFER'
    ? 85
    : isGenericBankDescription(rawDescription)
    ? 35
    : 60;
  const confidenceLevel: ConfidenceLevel =
    confidenceScore >= 80 ? 'HIGH' : confidenceScore >= 55 ? 'MEDIUM' : 'LOW';
  return {
    normalizedDescription: rawDescription.trim(), counterparty,
    paymentMethod, financialActionCode: memoryMatch?.financialAction || baseSemantics.actionCode,
    financialActionLabel: baseSemantics.actionLabel,
    purpose: (memoryMatch?.purpose as FinancialPurpose) || baseSemantics.purpose,
    purposeLabel: baseSemantics.purposeLabel, suggestedCategoryId: matchedCat?.id || null,
    suggestedCategoryName: matchedCat?.name || null, suggestedNature:
      (memoryMatch?.nature as 'STATIC' | 'VARIABLE') ||
      baseSemantics.defaultNature ||
      (matchedCat?.defaultNature as 'STATIC' | 'VARIABLE') ||
      'VARIABLE', isRecurringLikely: baseSemantics.isRecurringLikely,
    confidenceScore, confidenceLevel,
    classificationSource, };
}

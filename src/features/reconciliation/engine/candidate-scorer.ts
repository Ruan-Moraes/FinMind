import { formatCentsToBRL } from '@/shared/lib/currency';
import { NormalizedRawMovement } from '@/features/reconciliation/parsers';
import { calculateTokenSimilarity, inferPurposeFromText } from '@/features/reconciliation/engine/purpose-classifier';
import { ExistingRuleCandidate, ExistingTransactionCandidate, MatchPrecisionKind, UserMemoryRuleCandidate } from '@/features/reconciliation/engine/reconciliation-types';
export function scoreRecurrenceRuleCandidate(params: {
  movement: NormalizedRawMovement;
  movementSemantics: ReturnType<typeof inferPurposeFromText>;
  rule: ExistingRuleCandidate;
  memoryMatch?: UserMemoryRuleCandidate | null;
}): { score: number;
  precision: MatchPrecisionKind;
  reasons: string[];
  hasSemanticHarmony: boolean;
  hasSemanticConflict: boolean;
} { const { movement, movementSemantics, rule, memoryMatch } = params;
  const reasons: string[] = [];
  const expectedDirection = rule.type === 'INCOME' ? 'INFLOW' : 'OUTFLOW';
  if (movement.direction !== expectedDirection) {
    return {
      score: -100, precision: 'NEW_ENTRY',
      reasons: ['Direção financeira oposta (Entrada vs Saída)'], hasSemanticHarmony: false,
      hasSemanticConflict: true, };
  }
  const ruleSemantics = inferPurposeFromText(
    `${rule.description} ${rule.categoryName || ''}`,
    expectedDirection
  );
  let score = 0;
  let hasSemanticHarmony = false;
  let hasSemanticConflict = false;
  if (
    movementSemantics.purpose !== 'GENERAL_UNKNOWN' &&
    movementSemantics.purpose !== 'PEER_TRANSFER' &&
    ruleSemantics.purpose !== 'GENERAL_UNKNOWN' &&
    ruleSemantics.purpose !== 'PEER_TRANSFER'
  ) {
    if (movementSemantics.purpose === ruleSemantics.purpose) { score += 52;
      hasSemanticHarmony = true;
      reasons.push(
        `Correspondência de finalidade e ação (${movementSemantics.actionLabel} → ${rule.description})`
      );
    } else { score -= 60;
      hasSemanticConflict = true;
      reasons.push(
        `Conflito de finalidade (${movementSemantics.purposeLabel} ≠ ${ruleSemantics.purposeLabel})`
      );
    }
  }
  const descSim = calculateTokenSimilarity(
    `${movement.originalDescription} ${movement.counterparty || ''}`,
    `${rule.description} ${rule.categoryName || ''}`
  );
  if (descSim >= 0.45 && !hasSemanticConflict) { score += hasSemanticHarmony ? 14 : 46;
    hasSemanticHarmony = true;
    reasons.push(`Descrição bancária e destinatário correspondem a "${rule.description}"`);
  } else if (descSim >= 0.25 && !hasSemanticConflict) { score += hasSemanticHarmony ? 10 : 32;
    hasSemanticHarmony = true;
    reasons.push(`Termos da descrição associados a "${rule.description}"`);
  } else if (hasSemanticHarmony) { score += 8;
    reasons.push(
      `Descrição bancária ("${movement.originalDescription}") compatível com "${rule.description}"`
    );
  }
  if (memoryMatch && memoryMatch.recurrenceRuleId === rule.id) { score += 25;
    hasSemanticHarmony = true;
    reasons.push(
      `Associação aprendida de ${memoryMatch.confirmCount} confirmação(ões) anterior(es)`
    );
  }
  const diffCents = Math.abs(movement.amountInCents - rule.amountInCents);
  const diffRatio = rule.amountInCents > 0 ? diffCents / rule.amountInCents : 1;
  let precision: MatchPrecisionKind = 'SEMANTIC_MATCH';
  if (diffCents === 0) { score += 25;
    precision = 'EXACT_MATCH';
    reasons.push(`Valor exato (${formatCentsToBRL(rule.amountInCents)})`);
  } else if (diffRatio <= 0.05) { score += 18;
    precision = 'VALUE_VARIATION';
    reasons.push(
      `Valor muito próximo (${formatCentsToBRL(movement.amountInCents)} vs previsto ${formatCentsToBRL(
        rule.amountInCents
      )}, variação de ${(diffRatio * 100).toFixed(1)}%)`
    );
  } else if (diffRatio <= 0.18) { score += 12;
    precision = 'VALUE_VARIATION';
    reasons.push(
      `Variação justificável de valor (${formatCentsToBRL(
        movement.amountInCents
      )} vs ${formatCentsToBRL(rule.amountInCents)} — possível ajuste/juros/consumo variável)`
    );
  } else if (
    movement.amountInCents < rule.amountInCents &&
    movement.amountInCents >= rule.amountInCents * 0.25 &&
    hasSemanticHarmony
  ) { score += 10;
    precision = 'PARTIAL_PAYMENT';
    reasons.push(
      `Pagamento parcial (${formatCentsToBRL(movement.amountInCents)} de ${formatCentsToBRL(
        rule.amountInCents
      )})`
    );
  } else { score -= 25;
  }
  const txDay = Number(movement.date.slice(8, 10));
  if (txDay && rule.dayOfMonth) {
    const dayDistance = Math.min(
      Math.abs(txDay - rule.dayOfMonth), 30 - Math.abs(txDay - rule.dayOfMonth)
    );
    if (dayDistance <= 3) { score += 10;
      reasons.push(`Proximidade com o dia previsto (${rule.dayOfMonth}) e recorrência mensal`);
    } else if (dayDistance <= 8) { score += 6;
      reasons.push(`Recorrência mensal compatível`);
    } else { score += 2;
    }
  }
  return {
    score, precision,
    reasons, hasSemanticHarmony,
    hasSemanticConflict, };
}
export function scoreExistingTransactionCandidate(params: {
  movement: NormalizedRawMovement;
  movementSemantics: ReturnType<typeof inferPurposeFromText>;
  tx: ExistingTransactionCandidate;
}): { score: number;
  precision: MatchPrecisionKind;
  reasons: string[];
  hasSemanticHarmony: boolean;
  hasSemanticConflict: boolean;
} { const { movement, movementSemantics, tx } = params;
  const reasons: string[] = [];
  if (tx.type === 'TRANSFER') {
    return {
      score: -100, precision: 'NEW_ENTRY',
      reasons: [], hasSemanticHarmony: false,
      hasSemanticConflict: true, };
  }
  const expectedDirection = tx.type === 'INCOME' ? 'INFLOW' : 'OUTFLOW';
  if (movement.direction !== expectedDirection) {
    return {
      score: -100, precision: 'NEW_ENTRY',
      reasons: [], hasSemanticHarmony: false,
      hasSemanticConflict: true, };
  }
  const txSemantics = inferPurposeFromText(
    `${tx.description} ${tx.categoryName || ''}`,
    expectedDirection
  );
  let score = 0;
  let hasSemanticHarmony = false;
  let hasSemanticConflict = false;
  if (
    movementSemantics.purpose !== 'GENERAL_UNKNOWN' &&
    movementSemantics.purpose !== 'PEER_TRANSFER' &&
    txSemantics.purpose !== 'GENERAL_UNKNOWN' &&
    txSemantics.purpose !== 'PEER_TRANSFER'
  ) {
    if (movementSemantics.purpose === txSemantics.purpose) { score += 48;
      hasSemanticHarmony = true;
      reasons.push(`Mesma finalidade (${movementSemantics.purposeLabel})`);
    } else { score -= 60;
      hasSemanticConflict = true;
      reasons.push(
        `Finalidade divergente (${movementSemantics.purposeLabel} ≠ ${txSemantics.purposeLabel})`
      );
    }
  }
  const descSim = calculateTokenSimilarity(
    `${movement.originalDescription} ${movement.counterparty || ''}`,
    `${tx.description} ${tx.categoryName || ''}`
  );
  if (descSim >= 0.45 && !hasSemanticConflict) { score += hasSemanticHarmony ? 14 : 44;
    hasSemanticHarmony = true;
    reasons.push(`Descrição compatível com lançamento "${tx.description}"`);
  } else if (descSim >= 0.25 && !hasSemanticConflict) { score += hasSemanticHarmony ? 10 : 30;
    hasSemanticHarmony = true;
    reasons.push(`Contexto textual compatível com "${tx.description}"`);
  } else if (hasSemanticHarmony) { score += 8;
    reasons.push(`Descrição bancária compatível com "${tx.description}"`);
  }
  const diffCents = Math.abs(movement.amountInCents - tx.amountInCents);
  const diffRatio = tx.amountInCents > 0 ? diffCents / tx.amountInCents : 1;
  let precision: MatchPrecisionKind = 'SEMANTIC_MATCH';
  if (diffCents === 0) { score += 25;
    precision = 'EXACT_MATCH';
    reasons.push(`Valor idêntico (${formatCentsToBRL(tx.amountInCents)})`);
  } else if (diffRatio <= 0.12) { score += 14;
    precision = 'VALUE_VARIATION';
    reasons.push(
      `Valor próximo ao previsto (${formatCentsToBRL(movement.amountInCents)} vs ${formatCentsToBRL(
        tx.amountInCents
      )})`
    );
  } else if (
    movement.amountInCents < tx.amountInCents &&
    movement.amountInCents >= tx.amountInCents * 0.25 &&
    hasSemanticHarmony
  ) { score += 10;
    precision = 'PARTIAL_PAYMENT';
    reasons.push(
      `Pagamento parcial do lançamento (${formatCentsToBRL(
        movement.amountInCents
      )} de ${formatCentsToBRL(tx.amountInCents)})`
    );
  } else { score -= 25;
  }
  const movTime = new Date(`${movement.date}T12:00:00`).getTime();
  const txTime = new Date(`${tx.date.slice(0, 10)}T12:00:00`).getTime();
  const daysDiff = Math.round(Math.abs(movTime - txTime) / (1000 * 60 * 60 * 24));
  if (daysDiff <= 2) { score += 12;
    reasons.push(daysDiff === 0 ? 'Mesma data do lançamento' : `Data próxima (±${daysDiff} dia(s))`);
  } else if (daysDiff <= 7) { score += 7;
    reasons.push(`Dentro da janela de vencimento (${daysDiff} dias)`);
  } else if (daysDiff <= 20) { score += 3;
  } else { score -= 10;
  }
  if (tx.status === 'PENDING') { score += 5;
    reasons.push('Lançamento previsto aguardando quitação');
  }
  return {
    score, precision,
    reasons, hasSemanticHarmony,
    hasSemanticConflict, };
}

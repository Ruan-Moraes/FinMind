import { computeDeterministicHash } from '@/features/reconciliation/parsers/statement-detectors';
import { MovementDirection, NormalizedRawMovement, PaymentMethodHint, StatementFileFormat } from '@/features/reconciliation/parsers/statement-parser-types';
export function extractDescriptionMetadata(rawDescription: string): {
  normalizedDescription: string;
  counterparty: string | null;
  paymentMethod: PaymentMethodHint;
} {
  const cleanRaw = rawDescription.replace(/\s+/g, ' ').trim();
  const upper = cleanRaw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  let paymentMethod: PaymentMethodHint = 'OUTRO';
  if (/\bPIX\b/.test(upper)) paymentMethod = 'PIX';
  else if (/\bTED\b/.test(upper)) paymentMethod = 'TED';
  else if (/\bDOC\b/.test(upper)) paymentMethod = 'DOC';
  else if (/\b(BOLETO|TITULO|LIQUIDACAO)\b/.test(upper)) paymentMethod = 'BOLETO';
  else if (/\b(DEB\s*AUT|DEBITO\s*AUTOMATICO|DEBITO\s+EM\s+CONTA)\b/.test(upper)) {
    paymentMethod = 'DEBITO_AUTOMATICO';
  } else if (
    /\b(COMPRA\s+CARTAO|COMPRA\s+DEBITO|DEBITO\s+VISA|DEBITO\s+MASTERCARD|DEBITO\s+ELO|DEBITO)\b/.test(
      upper
    )
  ) {
    paymentMethod = 'CARTAO_DEBITO';
  } else if (/\b(CREDITO|PARCELA)\b/.test(upper)) {
    paymentMethod = 'CARTAO_CREDITO';
  } else if (/\b(TARIFA|IOF|ANUIDADE|TAXA|CESTA)\b/.test(upper)) {
    paymentMethod = 'TARIFA';
  } else if (/\b(ESTORNO|REEMBOLSO|DEVOLUCAO)\b/.test(upper)) {
    paymentMethod = 'ESTORNO';
  } else if (/\b(TRANSF|TRANSFERENCIA)\b/.test(upper)) {
    paymentMethod = 'TRANSFERENCIA';
  }
  const prefixStripRegex =
    /^(?:TRANSFERENCIA\s+PIX\s+(?:ENVIADA|RECEBIDA)|PIX\s+(?:ENVIADO|RECEBIDO|TRANSF|TRANSFERENCIA|QRCODE|QR\s+CODE)|TED\s+(?:RECEBIDA|ENVIADA|TRANSF)|DOC\s+(?:RECEBIDO|ENVIADO)|PAGAMENTO\s+(?:DE\s+BOLETO|DE\s+CONTA|DE\s+TITULO|COM\s+QR\s+CODE|EFETUADO|ELETRONICO)?|PAGTO\s+(?:ELETR(?:ONICO)?|BOLETO|CONTA|TITULO)?|DEB(?:ITO)?\s+(?:AUT(?:OMATICO)?|CARTAO)?|COMPRA\s+(?:CARTAO\s+(?:DEBITO|CREDITO)|NO\s+DEBITO|DEBITO|CREDITO|A\s+VISTA)?|TRANSFERENCIA\s+(?:RECEBIDA|ENVIADA|ENTRE\s+CONTAS)?|TRANSF\s+(?:RECEBIDA|ENVIADA|PIX)?)\s*[-:/•|]*\s*/i;
  let coreEntity = cleanRaw
    .replace(prefixStripRegex, '')
    .replace(/\b\d{2}\/\d{2}(?:\/\d{2,4})?\b/g, '')
    .replace(/\b(?:CPF|CNPJ)\s*[:.]?\s*[\d.*-]+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[-:/•|\s]+|[-:/•|\s]+$/g, '')
    .trim();
  if (!coreEntity) {
    coreEntity = cleanRaw;
  }
  const normalizedDescription = coreEntity
    .split(' ')
    .map((word) => {
      const wUpper = word.toUpperCase();
      if (
        [
          'PIX',
          'TED',
          'DOC',
          'SA',
          'S.A.',
          'S/A',
          'LTDA',
          'ME',
          'EPP',
          'ABC',
          'XYZ',
          'NET',
          'IPTU',
          'IPVA',
          'IOF',
        ].includes(wUpper)
      ) {
        return wUpper;
      }
      if (word.length <= 2 && /^[a-zA-Z]+$/.test(word)) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ')
    .replace(/^./, (c) => c.toUpperCase());
  const counterparty = coreEntity.length >= 2 ? normalizedDescription : null;
  return {
    normalizedDescription: normalizedDescription || cleanRaw,
    counterparty,
    paymentMethod,
  };
}
export function createNormalizedMovement(params: {
  fileId: string;
  fileName: string;
  fileFormat: StatementFileFormat;
  bankName: string;
  lineIndex: number;
  date: string;
  amountInCents: number;
  direction: MovementDirection;
  originalDescription: string;
  fitId?: string | null;
  runningBalanceInCents?: number | null;
}): NormalizedRawMovement {
  const meta = extractDescriptionMetadata(params.originalDescription);
  const cleanDescKey = params.originalDescription
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const hashSeed = params.fitId
    ? `FITID:${params.bankName}:${params.fitId}:${params.amountInCents}:${params.direction}`
    : `TX:${params.date}:${params.amountInCents}:${params.direction}:${cleanDescKey}`;
  const externalHash = computeDeterministicHash(hashSeed);
  return {
    rawId: `${params.fileId}-item-${params.lineIndex}-${externalHash.slice(0, 8)}`,
    fileId: params.fileId,
    fileName: params.fileName,
    fileFormat: params.fileFormat,
    bankName: params.bankName,
    lineIndex: params.lineIndex,
    date: params.date,
    amountInCents: params.amountInCents,
    direction: params.direction,
    originalDescription: params.originalDescription.trim(),
    normalizedDescription: meta.normalizedDescription,
    counterparty: meta.counterparty,
    paymentMethod: meta.paymentMethod,
    fitId: params.fitId || null,
    externalHash,
    runningBalanceInCents: params.runningBalanceInCents ?? null,
  };
}
export function reconcileDirectionsByRunningBalance(params: {
  movements: NormalizedRawMovement[];
  openingBalanceInCents: number | null;
  closingBalanceInCents: number | null;
}): {
  openingBalanceInCents: number | null;
  closingBalanceInCents: number | null;
} {
  const { movements } = params;
  let { openingBalanceInCents, closingBalanceInCents } = params;
  if (movements.length === 0) {
    return { openingBalanceInCents, closingBalanceInCents };
  }
  const updateMovementDirection = (m: NormalizedRawMovement, newDirection: MovementDirection) => {
    if (m.direction === newDirection) return;
    m.direction = newDirection;
    const cleanDescKey = m.originalDescription
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const hashSeed = m.fitId
      ? `FITID:${m.bankName}:${m.fitId}:${m.amountInCents}:${m.direction}`
      : `TX:${m.date}:${m.amountInCents}:${m.direction}:${cleanDescKey}`;
    m.externalHash = computeDeterministicHash(hashSeed);
  };
  let forwardMatches = 0;
  let reverseMatches = 0;
  for (let k = 1; k < movements.length; k++) {
    const prevBal = movements[k - 1].runningBalanceInCents;
    const currBal = movements[k].runningBalanceInCents;
    if (prevBal != null && currBal != null) {
      const absDiff = Math.abs(currBal - prevBal);
      if (Math.abs(absDiff - movements[k].amountInCents) <= 5) forwardMatches += 1;
      if (Math.abs(absDiff - movements[k - 1].amountInCents) <= 5) reverseMatches += 1;
    }
  }
  const isTopToBottom = forwardMatches >= reverseMatches;
  if (isTopToBottom) {
    if (openingBalanceInCents != null && movements[0].runningBalanceInCents != null) {
      const delta0 = movements[0].runningBalanceInCents - openingBalanceInCents;
      if (Math.abs(delta0 - movements[0].amountInCents) <= 5) {
        updateMovementDirection(movements[0], 'INFLOW');
      } else if (Math.abs(delta0 + movements[0].amountInCents) <= 5) {
        updateMovementDirection(movements[0], 'OUTFLOW');
      }
    }
    for (let k = 1; k < movements.length; k++) {
      const prevBal = movements[k - 1].runningBalanceInCents;
      const currBal = movements[k].runningBalanceInCents;
      if (prevBal != null && currBal != null) {
        const delta = currBal - prevBal;
        if (Math.abs(delta - movements[k].amountInCents) <= 5) {
          updateMovementDirection(movements[k], 'INFLOW');
        } else if (Math.abs(delta + movements[k].amountInCents) <= 5) {
          updateMovementDirection(movements[k], 'OUTFLOW');
        }
      }
    }
    if (openingBalanceInCents == null && movements[0].runningBalanceInCents != null) {
      const signedFirst =
        movements[0].direction === 'INFLOW'
          ? movements[0].amountInCents
          : -movements[0].amountInCents;
      openingBalanceInCents = movements[0].runningBalanceInCents - signedFirst;
    }
    if (
      closingBalanceInCents == null &&
      movements[movements.length - 1].runningBalanceInCents != null
    ) {
      closingBalanceInCents = movements[movements.length - 1].runningBalanceInCents ?? null;
    }
  } else {
    for (let k = 0; k < movements.length - 1; k++) {
      const currBal = movements[k].runningBalanceInCents;
      const prevBal = movements[k + 1].runningBalanceInCents;
      if (prevBal != null && currBal != null) {
        const delta = currBal - prevBal;
        if (Math.abs(delta - movements[k].amountInCents) <= 5) {
          updateMovementDirection(movements[k], 'INFLOW');
        } else if (Math.abs(delta + movements[k].amountInCents) <= 5) {
          updateMovementDirection(movements[k], 'OUTFLOW');
        }
      }
    }
    if (closingBalanceInCents == null && movements[0].runningBalanceInCents != null) {
      closingBalanceInCents = movements[0].runningBalanceInCents ?? null;
    }
  }
  return { openingBalanceInCents, closingBalanceInCents };
}

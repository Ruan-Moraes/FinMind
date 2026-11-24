import { MovementDirection } from '@/features/reconciliation/parsers/statement-parser-types';

/**
 * Converte uma string de data bancária em YYYY-MM-DD de forma 100% determinística.
 */
export function parseDeterministicDate(rawDate: string, fallbackYear?: number): string | null {
  const cleaned = rawDate.trim();
  if (!cleaned) return null;

  const yearBase = fallbackYear || new Date().getFullYear();

  // 1. Formato OFX: YYYYMMDD ou YYYYMMDDHHMMSS
  const ofxMatch = cleaned.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofxMatch) {
    const y = Number(ofxMatch[1]);
    const m = Number(ofxMatch[2]);
    const d = Number(ofxMatch[3]);
    if (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 2. Formato ISO: YYYY-MM-DD ou YYYY/MM/DD
  const isoMatch = cleaned.match(/\b(\d{4})[-/](\d{2})[-/](\d{2})\b/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 3. Formato Brasileiro Completo: DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  const brFullMatch =
    cleaned.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/) ||
    cleaned.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
  if (brFullMatch) {
    const d = Number(brFullMatch[1]);
    const m = Number(brFullMatch[2]);
    const y = Number(brFullMatch[3]);
    if (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 4. Formato Brasileiro com Ano de 2 dígitos: DD/MM/YY ou DD-MM-YY
  const brShortYearMatch = cleaned.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2})\b/);
  if (brShortYearMatch) {
    const d = Number(brShortYearMatch[1]);
    const m = Number(brShortYearMatch[2]);
    const yShort = Number(brShortYearMatch[3]);
    const y = yShort >= 70 ? 1900 + yShort : 2000 + yShort;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 5. Formato por extenso / abreviado PT-BR: 10 NOV 2026, 10 de set de 2026, 10/SET/2026, 10 SET
  const monthMapPt: Record<string, number> = {
    jan: 1,
    fev: 2,
    mar: 3,
    abr: 4,
    mai: 5,
    jun: 6,
    jul: 7,
    ago: 8,
    set: 9,
    out: 10,
    nov: 11,
    dez: 12,
  };
  const ptTextDateMatch = cleaned.match(
    /\b(\d{1,2})(?:\s+de\s+|[\s/.-]+)(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*(?:(?:\s+de\s+|[\s/.-]+)(\d{2,4}))?\b/i
  );
  if (ptTextDateMatch) {
    const d = Number(ptTextDateMatch[1]);
    const m = monthMapPt[ptTextDateMatch[2].toLowerCase().slice(0, 3)];
    let y = yearBase;
    if (ptTextDateMatch[3]) {
      const rawY = Number(ptTextDateMatch[3]);
      y = rawY < 100 ? (rawY >= 70 ? 1900 + rawY : 2000 + rawY) : rawY;
    }
    if (m && d >= 1 && d <= 31 && y >= 1990 && y <= 2100) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 6. Formato Curto DD/MM ou DD-MM (ex: 10/11 ou 10-09)
  const brDayMonthMatch = cleaned.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (brDayMonthMatch) {
    const d = Number(brDayMonthMatch[1]);
    const m = Number(brDayMonthMatch[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(yearBase).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Converte uma string monetária bancária para centavos inteiros e direção (INFLOW / OUTFLOW).
 */
export function parseDeterministicMonetaryAmount(
  rawAmount: string,
  descriptionContext = ''
): { amountInCents: number; direction: MovementDirection; hasExplicitSign: boolean } | null {
  if (!rawAmount) return null;
  const trimmed = rawAmount.trim();
  if (!trimmed) return null;

  const isParenthesizedNegative = /^\(.*\)$/.test(trimmed);
  const hasTrailingDebit = /\b[dD]\s*$/.test(trimmed) || /[-−]\s*$/.test(trimmed);
  const hasTrailingCredit = /\b[cC]\s*$/.test(trimmed) || /\+\s*$/.test(trimmed);
  const hasMinus =
    trimmed.includes('-') ||
    trimmed.includes('−') ||
    trimmed.includes('–') ||
    isParenthesizedNegative ||
    hasTrailingDebit;
  const hasPlus = trimmed.includes('+') || hasTrailingCredit;

  const numericPart = trimmed.replace(/[^\d.,]/g, '');
  if (!numericPart || !/\d/.test(numericPart)) return null;

  let normalizedNumberStr = numericPart;
  const lastComma = numericPart.lastIndexOf(',');
  const lastDot = numericPart.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      normalizedNumberStr = numericPart.replace(/\./g, '').replace(',', '.');
    } else {
      normalizedNumberStr = numericPart.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const parts = numericPart.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      normalizedNumberStr = `${parts[0]}.${parts[1]}`;
    } else {
      normalizedNumberStr = numericPart.replace(/,/g, '');
    }
  } else if (lastDot !== -1) {
    const parts = numericPart.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      normalizedNumberStr = numericPart;
    } else {
      normalizedNumberStr = numericPart.replace(/\./g, '');
    }
  }

  const parsedFloat = Number.parseFloat(normalizedNumberStr);
  if (Number.isNaN(parsedFloat) || parsedFloat <= 0) {
    return null;
  }

  const amountInCents = Math.round(parsedFloat * 100);
  if (amountInCents <= 0) return null;

  let direction: MovementDirection = 'OUTFLOW';
  const hasExplicitSign = hasMinus || hasPlus;

  if (hasMinus) {
    direction = 'OUTFLOW';
  } else if (hasPlus) {
    direction = 'INFLOW';
  } else {
    const lowerDesc = descriptionContext
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const leadingInflowPattern =
      /^(?:ted\s+recebida|pix\s+recebido|transferencia\s+pix\s+recebida|transf(?:erencia)?\s+recebida|credito\s+em\s+conta|deposito|recebimento|salario|rendimento|rendimentos|reembolso|estorno\s+recebido|dinheiro\s+recebido|liberacao\s+de\s+dinheiro)\b/i;
    const inflowPattern =
      /\b(ted\s+recebida|pix\s+recebido|transferencia\s+pix\s+recebida|transf(?:erencia)?\s+recebida|credito\s+em\s+conta|deposito|recebimento|salario|vencimento|pro-?labore|reembolso|estorno\s+recebido|rendimento|rendimentos|dividendo|resgate|entrada|recebi|ganhei|dinheiro\s+recebido|liberacao\s+de\s+dinheiro)\b/i;
    const outflowPattern =
      /\b(pix\s+enviado|transferencia\s+pix\s+enviada|ted\s+enviada|pagamento|pagto|debito|compra|boleto|tarifa|saque|fatura|imobiliaria|aluguel|supermercado|mercado|claro|smart\s*fit|academia|envio|saida|paguei|gastei|dinheiro\s+enviado)\b/i;

    if (leadingInflowPattern.test(lowerDesc.trim())) {
      direction = 'INFLOW';
    } else if (inflowPattern.test(lowerDesc) && !outflowPattern.test(lowerDesc)) {
      direction = 'INFLOW';
    } else {
      direction = 'OUTFLOW';
    }
  }

  return {
    amountInCents,
    direction,
    hasExplicitSign,
  };
}

export function parseSignedMoneyTokenToCents(rawToken: string): number | null {
  const parsed = parseDeterministicMonetaryAmount(rawToken);
  if (!parsed) return null;
  return parsed.hasExplicitSign && parsed.direction === 'OUTFLOW'
    ? -parsed.amountInCents
    : parsed.amountInCents;
}

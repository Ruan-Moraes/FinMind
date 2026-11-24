import { createNormalizedMovement } from '@/features/reconciliation/parsers/movement-metadata-builder';
import { isNonEffectiveBalanceLine } from '@/features/reconciliation/parsers/statement-detectors';
import { NormalizedRawMovement, StatementFileInput } from '@/features/reconciliation/parsers/statement-parser-types';
import {
  parseDeterministicDate,
  parseDeterministicMonetaryAmount,
} from '@/features/reconciliation/parsers/statement-value-normalizers';

/**
 * PARSER 1: OFX / QFX (SGML e XML) — 100% determinístico.
 */
export function parseOfxContent(
  input: StatementFileInput,
  textContent: string,
  bankName: string
): {
  movements: NormalizedRawMovement[];
  periodStart: string | null;
  periodEnd: string | null;
  openingBalanceInCents: number | null;
  closingBalanceInCents: number | null;
  ignoredNonEffectiveLines: number;
} {
  const movements: NormalizedRawMovement[] = [];
  let ignoredNonEffectiveLines = 0;

  const dtStartMatch = textContent.match(/<DTSTART>([^<\r\n]+)/i);
  const dtEndMatch = textContent.match(/<DTEND>([^<\r\n]+)/i);
  let periodStart = dtStartMatch ? parseDeterministicDate(dtStartMatch[1]) : null;
  let periodEnd = dtEndMatch ? parseDeterministicDate(dtEndMatch[1]) : null;

  const balAmtMatch = textContent.match(/<BALAMT>([^<\r\n]+)/i);
  const parsedBal = balAmtMatch ? parseDeterministicMonetaryAmount(balAmtMatch[1]) : null;
  const closingBalanceInCents = parsedBal
    ? parsedBal.hasExplicitSign && parsedBal.direction === 'OUTFLOW'
      ? -parsedBal.amountInCents
      : parsedBal.amountInCents
    : null;

  const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>|$))/gi;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = trnRegex.exec(textContent)) !== null) {
    idx += 1;
    const block = match[1];

    const extractTag = (tag: string): string => {
      const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
      return m ? m[1].trim() : '';
    };

    const trnType = extractTag('TRNTYPE').toUpperCase();
    const dtPosted = extractTag('DTPOSTED');
    const trnAmt = extractTag('TRNAMT');
    const fitId = extractTag('FITID');
    const name = extractTag('NAME');
    const memo = extractTag('MEMO');

    const rawDescription =
      memo && name && !memo.toLowerCase().includes(name.toLowerCase())
        ? `${name} - ${memo}`
        : memo || name || trnType || 'Movimentação OFX';

    if (isNonEffectiveBalanceLine(rawDescription)) {
      ignoredNonEffectiveLines += 1;
      continue;
    }

    const parsedDate = parseDeterministicDate(dtPosted) || new Date().toISOString().slice(0, 10);
    const parsedAmount = parseDeterministicMonetaryAmount(trnAmt, rawDescription);
    if (!parsedAmount) continue;

    let direction = parsedAmount.direction;
    if (!parsedAmount.hasExplicitSign) {
      if (['DEBIT', 'PAYMENT', 'ATM', 'POS', 'FEE', 'SRVCHG', 'XFER_OUT', 'CHECK'].includes(trnType)) {
        direction = 'OUTFLOW';
      } else if (['CREDIT', 'DEP', 'DIRECTDEP', 'INT', 'DIV'].includes(trnType)) {
        direction = 'INFLOW';
      }
    }

    movements.push(
      createNormalizedMovement({
        fileId: input.fileId,
        fileName: input.fileName,
        fileFormat: 'OFX',
        bankName,
        lineIndex: idx,
        date: parsedDate,
        amountInCents: parsedAmount.amountInCents,
        direction,
        originalDescription: rawDescription,
        fitId: fitId || null,
      })
    );
  }

  for (const m of movements) {
    if (!periodStart || m.date < periodStart) periodStart = m.date;
    if (!periodEnd || m.date > periodEnd) periodEnd = m.date;
  }

  return {
    movements,
    periodStart,
    periodEnd,
    ignoredNonEffectiveLines,
    openingBalanceInCents: null,
    closingBalanceInCents,
  };
}

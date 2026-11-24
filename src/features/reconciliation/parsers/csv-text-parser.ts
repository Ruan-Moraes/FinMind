import { createNormalizedMovement, reconcileDirectionsByRunningBalance } from '@/features/reconciliation/parsers/movement-metadata-builder';
import { extractPeriodFromFileName, isNonEffectiveBalanceLine } from '@/features/reconciliation/parsers/statement-detectors';
import { MovementDirection, NormalizedRawMovement, StatementFileFormat, StatementFileInput } from '@/features/reconciliation/parsers/statement-parser-types';
import { parseDeterministicDate, parseDeterministicMonetaryAmount, parseSignedMoneyTokenToCents } from '@/features/reconciliation/parsers/statement-value-normalizers';
import { parseStitchedTextMovements } from "@/features/reconciliation/parsers/text-table-fallback-parser";
export function splitCsvRow(line: string, delimiter: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) { const ch = line[i];
    if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"';
        i += 1;
      } else { inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) { cols.push(current.trim());
      current = '';
    } else { current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}
export function parseCsvOrTextContent(
  input: StatementFileInput, textContent: string, format: StatementFileFormat, bankName: string
): { movements: NormalizedRawMovement[];
  periodStart: string | null;
  periodEnd: string | null;
  ignoredNonEffectiveLines: number;
  openingBalanceInCents: number | null;
  closingBalanceInCents: number | null;
} { const movements: NormalizedRawMovement[] = [];
  let ignoredNonEffectiveLines = 0;
  let openingBalanceInCents: number | null = null;
  let closingBalanceInCents: number | null = null;
  const filePeriodHint = extractPeriodFromFileName(input.fileName);
  const rawLines = textContent
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (rawLines.length === 0) {
    return {
      movements: [], periodStart: null, periodEnd: null, ignoredNonEffectiveLines: 0,
      openingBalanceInCents: null, closingBalanceInCents: null, };
  }
  const fullNormalizedHeader = rawLines.join('\n');
  const openingMatch = fullNormalizedHeader.match(
    /saldo\s+(?:inicial|anterior)\s*:?\s*((?:[+\-−–]\s*)?(?:R\$\s*)?(?:[+\-−–]\s*)?(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2}))/i
  );
  if (openingMatch) { openingBalanceInCents = parseSignedMoneyTokenToCents(openingMatch[1]);
  }
  const closingMatch = fullNormalizedHeader.match(
    /saldo\s+(?:final|atual|total|dispon[ií]vel)\s*:?\s*((?:[+\-−–]\s*)?(?:R\$\s*)?(?:[+\-−–]\s*)?(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2}))/i
  );
  if (closingMatch) { closingBalanceInCents = parseSignedMoneyTokenToCents(closingMatch[1]);
  }
  const sampleLines = rawLines.slice(0, Math.min(15, rawLines.length));
  const delimiters = [';', ',', '\t', '|'];
  let bestDelimiter = ';';
  let bestDelimiterScore = 0;
  for (const d of delimiters) { const counts = sampleLines.map((l) => splitCsvRow(l, d).length);
    const multiColLines = counts.filter((c) => c >= 2).length;
    const avgCols = counts.reduce((a, b) => a + b, 0) / counts.length;
    const score = multiColLines * 10 + avgCols;
    if (multiColLines >= Math.ceil(sampleLines.length * 0.5) && score > bestDelimiterScore) {
      bestDelimiterScore = score;
      bestDelimiter = d;
    }
  }
  let headerRowIdx = 0;
  for (let hIdx = 0; hIdx < Math.min(10, rawLines.length); hIdx++) {
    const candidateCols = splitCsvRow(rawLines[hIdx], bestDelimiter).map((c) =>
      c
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim() );
    if ( candidateCols.length >= 2 &&
      candidateCols.some((c) =>
        /^(data|date|dt|release_date|lancamento|historico|descricao|title|memo|transaction_type|valor|amount|quantia|transaction_amount|net_amount|credito|debito|entrada|saida|identificador|id|reference_id)$/.test(
          c )
      )
    ) { headerRowIdx = hIdx;
      break;
    }
  }
  const firstRowCols = splitCsvRow(rawLines[headerRowIdx], bestDelimiter);
  const firstRowNorm = firstRowCols.map((c) =>
    c
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim() );
  const hasHeader =
    firstRowCols.length >= 2 &&
    firstRowNorm.some((c) =>
      /^(data|date|dt|release_date|lancamento|historico|descricao|title|memo|transaction_type|valor|amount|quantia|transaction_amount|net_amount|credito|debito|entrada|saida|identificador|id|reference_id)$/.test(
        c )
    );
  if (format !== 'PDF' && bestDelimiterScore >= 12 && firstRowCols.length >= 2) {
    let dateColIdx = firstRowNorm.findIndex((c) =>
      /^(data|date|dt|release_date|data\s+lancamento)/.test(c) );
    const descColIdx = firstRowNorm.findIndex((c) =>
      /^(descricao|historico|lancamento|title|memo|transaction_type|estabelecimento|detalhe|nome)/.test( c
      ) );
    const amountColIdx = firstRowNorm.findIndex((c) =>
      /^(valor|amount|quantia|total|transaction_amount|net_amount|valor\s+\(r\$\)|valor\s+liquido)/.test( c
      ) );
    const creditColIdx = firstRowNorm.findIndex((c) => /^(credito|entrada|receita)/.test(c));
    const debitColIdx = firstRowNorm.findIndex((c) => /^(debito|saida|despesa)/.test(c));
    const idColIdx = firstRowNorm.findIndex((c) =>
      /^(identificador|id|fitid|documento|nsu|codigo|reference_id|operation_id|id\s+da\s+operacao)/.test( c
      ) );
    const typeColIdx = firstRowNorm.findIndex((c) =>
      /^(tipo|natureza|operacao|d\/c|sinal)/.test(c) );
    const balanceColIdx = firstRowNorm.findIndex((c) => /^(saldo|balance|partial_balance)/.test(c));
    const startRow = hasHeader ? headerRowIdx + 1 : 0;
    for (let i = startRow; i < rawLines.length; i++) { const cols = splitCsvRow(rawLines[i], bestDelimiter);
      if (cols.length < 2) continue;
      let rawDate = dateColIdx >= 0 && cols[dateColIdx] ? cols[dateColIdx] : '';
      let rawDesc = descColIdx >= 0 && cols[descColIdx] ? cols[descColIdx] : '';
      let rawAmt = amountColIdx >= 0 && cols[amountColIdx] ? cols[amountColIdx] : '';
      const rawIdCol = idColIdx >= 0 && cols[idColIdx] ? cols[idColIdx] : '';
      const rawTypeCol = typeColIdx >= 0 && cols[typeColIdx] ? cols[typeColIdx] : '';
      if (!rawDate) {
        const foundDateCol = cols.findIndex( (c) => parseDeterministicDate(c, filePeriodHint.fallbackYear) !== null
        );
        if (foundDateCol !== -1) { dateColIdx = foundDateCol;
          rawDate = cols[foundDateCol];
        }
      }
      if (!rawAmt && creditColIdx === -1 && debitColIdx === -1) { const candidateAmtIndices: number[] = [];
        for (let cIdx = 0; cIdx < cols.length; cIdx++) {
          if (cIdx === dateColIdx || cIdx === idColIdx || cIdx === balanceColIdx) continue;
          if ( /^(?:[+\-−–]\s*)?(?:R\$\s*)?(?:[+\-−–]\s*)?[\d.,]+\s*[CDcd+-]?$/.test(
              cols[cIdx].trim() )
          ) { candidateAmtIndices.push(cIdx);
          }
        }
        if (candidateAmtIndices.length >= 1) {
          const chosenIdx =
            candidateAmtIndices.length >= 2 &&
            firstRowNorm[candidateAmtIndices[candidateAmtIndices.length - 1]]?.includes('saldo')
              ? candidateAmtIndices[candidateAmtIndices.length - 2]
              : candidateAmtIndices[0];
          rawAmt = cols[chosenIdx];
          if (!rawDesc) {
            rawDesc = cols
              .filter( (_, idx) =>
                  idx !== dateColIdx &&
                  idx !== chosenIdx &&
                  idx !== idColIdx &&
                  idx !== balanceColIdx )
              .join(' - ');
          }
        }
      }
      if (!rawDesc) {
        rawDesc = cols
          .filter( (_, idx) =>
              idx !== dateColIdx &&
              idx !== amountColIdx &&
              idx !== creditColIdx &&
              idx !== debitColIdx &&
              idx !== idColIdx &&
              idx !== balanceColIdx )
          .join(' - ')
          .trim();
      }
      if (isNonEffectiveBalanceLine(rawDesc)) { ignoredNonEffectiveLines += 1;
        continue;
      }
      const parsedDate = parseDeterministicDate(rawDate, filePeriodHint.fallbackYear);
      if (!parsedDate) continue;
      let amountInCents = 0;
      let direction: MovementDirection = 'OUTFLOW';
      if (creditColIdx !== -1 && debitColIdx !== -1 && !rawAmt) {
        const creditParsed = parseDeterministicMonetaryAmount(cols[creditColIdx] || '', rawDesc);
        const debitParsed = parseDeterministicMonetaryAmount(cols[debitColIdx] || '', rawDesc);
        if (creditParsed && creditParsed.amountInCents > 0) { amountInCents = creditParsed.amountInCents;
          direction = 'INFLOW';
        } else if (debitParsed && debitParsed.amountInCents > 0) { amountInCents = debitParsed.amountInCents;
          direction = 'OUTFLOW';
        }
      } else { const parsedAmt = parseDeterministicMonetaryAmount(rawAmt, rawDesc);
        if (parsedAmt) { amountInCents = parsedAmt.amountInCents;
          direction = parsedAmt.direction;
          if (!parsedAmt.hasExplicitSign && rawTypeCol) {
            if (/^(c|cred|credito|receita|entrada|inflow|\+)/i.test(rawTypeCol.trim())) {
              direction = 'INFLOW';
            } else if (/^(d|deb|debito|despesa|saida|outflow|-)/i.test(rawTypeCol.trim())) {
              direction = 'OUTFLOW';
            }
          }
        }
      }
      if (amountInCents <= 0) continue;
      const csvRunningBalance =
        balanceColIdx >= 0 && cols[balanceColIdx]
          ? parseSignedMoneyTokenToCents(cols[balanceColIdx])
          : null;
      movements.push( createNormalizedMovement({
          fileId: input.fileId, fileName: input.fileName, fileFormat: format, bankName,
          lineIndex: i + 1, date: parsedDate, amountInCents, direction,
          originalDescription: rawDesc || 'Movimentação Bancária', fitId: rawIdCol || null,
          runningBalanceInCents: csvRunningBalance, }) );
    }
  }
  if (movements.length === 0) {
    const fb = parseStitchedTextMovements({ input, rawLines, format, bankName, filePeriodHint });
    movements.push(...fb.movements);
    ignoredNonEffectiveLines += fb.ignoredLines;
  }
  const reconciledBalances = reconcileDirectionsByRunningBalance({
    movements, openingBalanceInCents, closingBalanceInCents, });
  openingBalanceInCents = reconciledBalances.openingBalanceInCents;
  closingBalanceInCents = reconciledBalances.closingBalanceInCents;
  let periodStart: string | null = filePeriodHint.periodStart;
  let periodEnd: string | null = filePeriodHint.periodEnd;
  for (const m of movements) { if (!periodStart || m.date < periodStart) periodStart = m.date;
    if (!periodEnd || m.date > periodEnd) periodEnd = m.date;
  }
  return {
    movements, periodStart, periodEnd, ignoredNonEffectiveLines, openingBalanceInCents, closingBalanceInCents, };
}

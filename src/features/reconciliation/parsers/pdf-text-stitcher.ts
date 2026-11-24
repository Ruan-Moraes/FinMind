import { isNonEffectiveBalanceLine } from '@/features/reconciliation/parsers/statement-detectors';
import { parseDeterministicDate } from '@/features/reconciliation/parsers/statement-value-normalizers';

/**
 * Expressão regular abrangente para capturar valores monetários em extratos bancários brasileiros.
 */
export const STATEMENT_MONEY_REGEX =
  /(?:[+\-−–]\s*)?(?:R\$\s*)?(?:[+\-−–]\s*)?(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2})(?:\s*[CDcd+-])?|(?:[+\-−–]\s*)?R\$\s*(?:[+\-−–]\s*)?\d+/g;

export function extractLeadingOrInlineDateMatch(line: string): RegExpMatchArray | null {
  return (
    line.match(/\b(\d{4}[-/]\d{2}[-/]\d{2})\b/) ||
    line.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/) ||
    line.match(/\b(\d{2}\.\d{2}\.\d{4})\b/) ||
    line.match(
      /\b(\d{1,2}(?:\s+de\s+|[\s/.-]+)(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*(?:(?:\s+de\s+|[\s/.-]+)\d{2,4})?)\b/i
    ) ||
    line.match(/^(\d{1,2}[/-]\d{1,2})\b/)
  );
}

export function stripInlinePdfHeaderFooterNoise(text: string): string {
  return text
    .replace(
      /\b(?:Data\s+)+Descri[cç][aã]o(?:\s+Descri[cç][aã]o)*\s+(?:ID\s+da\s+opera[cç][aã]o\s+)+Valor(?:\s+Valor)*\s+Saldo(?:\s+Saldo)*/gi,
      ' '
    )
    .replace(
      /\bData\s+Descri[cç][aã]o\s+(?:ID\s+da\s+opera[cç][aã]o\s+)?Valor(?:\s+Saldo)?\b/gi,
      ' '
    )
    .replace(/\bo\s+nosso\s+SAC,\s*ligue\s+para[\s\S]*$/i, ' ')
    .replace(/\bVoc[eê]\s+precisar[aá]\s+de\s+um\s+c[oó]digo\s+de\s+atendimento[\s\S]*$/i, ' ')
    .replace(/\bEncontre\s+nossos\s+canais\s+de\s+consulta[\s\S]*$/i, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function isPdfNoiseOrHeaderLine(line: string): boolean {
  const clean = line
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return true;
  if (/^[\s|:-]+$/.test(clean)) return true;
  if (/^\d+\s*\/\s*\d+$/.test(clean) || /^pagina\s+\d+/i.test(clean)) return true;

  const noisePatterns = [
    /^extrato\s+(de\s+conta|mensal|bancario|consolidado)/i,
    /^detalhe\s+dos\s+movimentos/i,
    /^(?:data\s+)+descricao(?:\s+descricao)*\s+(?:id\s+da\s+operacao\s+)*valor(?:\s+valor)*(?:\s+saldo)*/i,
    /^periodo\s*:/i,
    /^data\s+de\s+geracao/i,
    /^documento\s+emitido/i,
    /^mercadopago\.com/i,
    /^mercado\s+pago\s+instituicao/i,
    /^cnpj\s*:/i,
    /^ouvidoria|sac\s*:/i,
    /o\s+nosso\s+sac,\s*ligue\s+para/i,
    /voce\s+precisara\s+de\s+um\s+codigo\s+de\s+atendimento/i,
    /encontre\s+nossos\s+canais\s+de\s+consulta/i,
    /^voce\s+tem\s+alguma\s+duvida/i,
  ];

  return noisePatterns.some((re) => re.test(clean));
}

/**
 * Reagrupa linhas quebradas em extratos PDF onde a descrição ocupa múltiplas linhas
 * ou onde Data, Descrição e Valor ficam em linhas adjacentes.
 */
export function stitchMultiLineStatementRows(rawLines: string[], fallbackYear?: number): string[] {
  const filtered = rawLines
    .map((l) => stripInlinePdfHeaderFooterNoise(l))
    .filter((l) => !isPdfNoiseOrHeaderLine(l));
  const stitched: string[] = [];
  let pendingOrphanPrefix = '';

  const hasAlphabeticDesc = (line: string): boolean => {
    const stripped = line
      .replace(STATEMENT_MONEY_REGEX, ' ')
      .replace(/\b\d{4}[-/]\d{2}[-/]\d{2}\b/g, ' ')
      .replace(/\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/g, ' ')
      .replace(/\b\d{6,}\b/g, ' ')
      .replace(/[^a-zA-ZÀ-ÿ]/g, '');
    return stripped.length >= 3;
  };

  const startsWithTransactionAction = (line: string): boolean => {
    const clean = line
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    return /^(?:pagamento|pagto|pix\b|transferencia|transf\b|compra\b|debito\b|credito\b|recebimento\b|rendimentos?\b|estorno\b|reembolso\b|boleto\b|tarifa\b)/i.test(
      clean
    );
  };

  for (let i = 0; i < filtered.length; i++) {
    const line = filtered[i];
    const dateMatch = extractLeadingOrInlineDateMatch(line);
    const hasDate = Boolean(dateMatch && parseDeterministicDate(dateMatch[1], fallbackYear));
    const moneyMatches = Array.from(line.matchAll(STATEMENT_MONEY_REGEX));
    const hasMoney = moneyMatches.length > 0;

    if (hasDate && hasMoney) {
      let combined = line;
      if (pendingOrphanPrefix) {
        const dateStr = dateMatch ? dateMatch[0] : '';
        if (dateStr && combined.startsWith(dateStr)) {
          combined = `${dateStr} ${pendingOrphanPrefix} ${combined.slice(dateStr.length).trim()}`;
        } else {
          combined = `${pendingOrphanPrefix} ${combined}`;
        }
        pendingOrphanPrefix = '';
      }
      stitched.push(combined);
      continue;
    }

    if (hasDate && !hasMoney) {
      let combined = pendingOrphanPrefix ? `${line} ${pendingOrphanPrefix}` : line;
      pendingOrphanPrefix = '';
      let lookahead = i + 1;
      while (lookahead < filtered.length && lookahead <= i + 3) {
        const nextLine = filtered[lookahead];
        const nextDateMatch = extractLeadingOrInlineDateMatch(nextLine);
        const nextHasDate = Boolean(
          nextDateMatch && parseDeterministicDate(nextDateMatch[1], fallbackYear)
        );
        if (nextHasDate) break;

        combined = `${combined} ${nextLine}`;
        const nextHasMoney = Array.from(nextLine.matchAll(STATEMENT_MONEY_REGEX)).length > 0;
        lookahead += 1;
        if (nextHasMoney) {
          i = lookahead - 1;
          break;
        }
      }
      stitched.push(combined);
      continue;
    }

    if (!hasDate && !hasMoney) {
      if (!/[a-zA-ZÀ-ÿ]{2,}/.test(line) || isNonEffectiveBalanceLine(line)) {
        continue;
      }

      const nextLine = filtered[i + 1] || '';
      const nextDateMatch = extractLeadingOrInlineDateMatch(nextLine);
      const nextHasDate = Boolean(
        nextDateMatch && parseDeterministicDate(nextDateMatch[1], fallbackYear)
      );
      const nextHasMoney = Array.from(nextLine.matchAll(STATEMENT_MONEY_REGEX)).length > 0;

      if (
        (nextHasDate && startsWithTransactionAction(line)) ||
        (nextHasDate && nextHasMoney && !hasAlphabeticDesc(nextLine))
      ) {
        pendingOrphanPrefix = pendingOrphanPrefix ? `${pendingOrphanPrefix} ${line}` : line;
      } else if (stitched.length > 0) {
        const prev = stitched[stitched.length - 1];
        const firstMoneyInPrev = prev.search(STATEMENT_MONEY_REGEX);
        if (firstMoneyInPrev > 0) {
          stitched[stitched.length - 1] =
            `${prev.slice(0, firstMoneyInPrev).trim()} ${line} ${prev.slice(firstMoneyInPrev).trim()}`;
        } else {
          stitched[stitched.length - 1] = `${prev} ${line}`;
        }
      } else {
        pendingOrphanPrefix = pendingOrphanPrefix ? `${pendingOrphanPrefix} ${line}` : line;
      }
      continue;
    }

    if (pendingOrphanPrefix) {
      stitched.push(`${pendingOrphanPrefix} ${line}`);
      pendingOrphanPrefix = '';
    } else {
      stitched.push(line);
    }
  }

  return stitched;
}

import { BRAZILIAN_BANK_CODES, StatementFileFormat } from '@/features/reconciliation/parsers/statement-parser-types';

/**
 * Gera um hash determinístico curto (FNV-1a 64-bit em hex) sem depender de APIs assíncronas.
 */
export function computeDeterministicHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch;
    h2 = Math.imul(h2, 0x100001b3);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${hex1}${hex2}`;
}

/**
 * Detecta o formato do arquivo com base na extensão e assinatura do conteúdo.
 */
export function detectStatementFormat(
  fileName: string,
  contentPreview: string
): StatementFileFormat {
  const lowerName = (fileName || '').toLowerCase().trim();
  if (lowerName.endsWith('.ofx') || lowerName.endsWith('.qfx')) return 'OFX';
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) return 'XLSX';
  if (lowerName.endsWith('.pdf')) return 'PDF';
  if (lowerName.endsWith('.csv')) return 'CSV';

  const trimmed = contentPreview.slice(0, 1000).trim();
  if (/<OFX>/i.test(trimmed) || /OFXHEADER:/i.test(trimmed) || /<STMTTRN>/i.test(trimmed)) {
    return 'OFX';
  }
  if (trimmed.startsWith('%PDF-')) {
    return 'PDF';
  }
  if (trimmed.startsWith('PK\x03\x04')) {
    return 'XLSX';
  }
  if (/^[^\n]*[,;\t][^\n]*\n/.test(trimmed)) {
    return 'CSV';
  }
  return 'TXT';
}

/**
 * Identifica a instituição financeira a partir do nome do arquivo e conteúdo do extrato.
 */
export function detectFinancialInstitution(fileName: string, textContent: string): string {
  const combined = `${fileName}\n${textContent.slice(0, 6000)}`.toLowerCase();

  const orgMatch = textContent.match(/<ORG>([^<\r\n]+)/i);
  if (orgMatch && orgMatch[1].trim()) {
    const orgRaw = orgMatch[1].trim();
    if (/nu\s*pagamentos|nubank/i.test(orgRaw)) return 'Nubank';
    if (/itau|ita[uú]/i.test(orgRaw)) return 'Itaú Unibanco';
    if (/bradesco/i.test(orgRaw)) return 'Bradesco';
    if (/santander/i.test(orgRaw)) return 'Santander';
    if (/brasil|bb/i.test(orgRaw)) return 'Banco do Brasil';
    if (/inter/i.test(orgRaw)) return 'Banco Inter';
    if (/c6/i.test(orgRaw)) return 'C6 Bank';
    if (/caixa|cef/i.test(orgRaw)) return 'Caixa Econômica Federal';
    if (/mercado\s*pago|mercadolivre/i.test(orgRaw)) return 'Mercado Pago';
    return orgRaw;
  }

  const bankIdMatch = textContent.match(/<BANKID>(\d{1,4})/i);
  if (bankIdMatch) {
    const padded = bankIdMatch[1].padStart(3, '0').slice(-3);
    if (BRAZILIAN_BANK_CODES[padded]) {
      return BRAZILIAN_BANK_CODES[padded];
    }
  }

  if (/\b(mercado\s*pago|mercadopago|mercadolivre|ebazar)\b/i.test(combined)) return 'Mercado Pago';
  if (/^extrato_de_conta_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}/i.test(fileName.trim())) {
    return 'Mercado Pago';
  }
  if (/\b(nubank|nu pagamentos|roxinho)\b/i.test(combined)) return 'Nubank';
  if (/\b(ita[uú]|unibanco)\b/i.test(combined)) return 'Itaú Unibanco';
  if (/\b(bradesco)\b/i.test(combined)) return 'Bradesco';
  if (/\b(santander)\b/i.test(combined)) return 'Santander';
  if (/\b(banco do brasil|bb s\.?a)\b/i.test(combined)) return 'Banco do Brasil';
  if (/\b(banco inter|intermedium)\b/i.test(combined)) return 'Banco Inter';
  if (/\b(c6 bank|c6 s\.?a)\b/i.test(combined)) return 'C6 Bank';
  if (/\b(caixa econ[oô]mica|cef)\b/i.test(combined)) return 'Caixa Econômica Federal';
  if (/\b(btg pactual)\b/i.test(combined)) return 'BTG Pactual';
  if (/\b(xp investimentos|banco xp)\b/i.test(combined)) return 'XP Investimentos';
  if (/\b(sicredi)\b/i.test(combined)) return 'Sicredi';
  if (/\b(sicoob)\b/i.test(combined)) return 'Sicoob';
  if (/\b(pagbank|pagseguro)\b/i.test(combined)) return 'PagBank';
  if (/\b(picpay)\b/i.test(combined)) return 'PicPay';

  return 'Instituição Financeira';
}

/**
 * Extrai datas de início e fim quando presentes no nome do arquivo.
 */
export function extractPeriodFromFileName(fileName: string): {
  periodStart: string | null;
  periodEnd: string | null;
  fallbackYear: number | undefined;
} {
  const isoMatches = Array.from(fileName.matchAll(/\b(20\d{2})[-_](\d{2})[-_](\d{2})\b/g));
  if (isoMatches.length >= 2) {
    const d1 = `${isoMatches[0][1]}-${isoMatches[0][2]}-${isoMatches[0][3]}`;
    const d2 = `${isoMatches[1][1]}-${isoMatches[1][2]}-${isoMatches[1][3]}`;
    return {
      periodStart: d1 <= d2 ? d1 : d2,
      periodEnd: d1 <= d2 ? d2 : d1,
      fallbackYear: Number(isoMatches[0][1]),
    };
  }
  if (isoMatches.length === 1) {
    const d1 = `${isoMatches[0][1]}-${isoMatches[0][2]}-${isoMatches[0][3]}`;
    return {
      periodStart: d1,
      periodEnd: d1,
      fallbackYear: Number(isoMatches[0][1]),
    };
  }
  const yearMatch = fileName.match(/\b(20\d{2})\b/);
  return {
    periodStart: null,
    periodEnd: null,
    fallbackYear: yearMatch ? Number(yearMatch[1]) : undefined,
  };
}

/**
 * Verifica se uma linha/descrição representa apenas informação de saldo/total/cabeçalho.
 */
export function isNonEffectiveBalanceLine(description: string): boolean {
  const clean = description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return true;
  if (!/[a-z]{2,}/i.test(clean)) return true;

  const balancePatterns = [
    /^saldo\s*(anterior|inicial|final|do\s+dia|atual|disponivel|bloqueado|parcial|em\s+conta|total|:)/i,
    /^s\s*a\s*l\s*d\s*o\b/i,
    /^total\s*(do\s+periodo|de\s+entradas|de\s+saidas|geral|fatura|:)/i,
    /^resumo\s*(do\s+extrato|mensal|financeiro|:)/i,
    /^limite\s*(disponivel|total|utilizado|:)/i,
    /^entradas\s*[:=-]?$/i,
    /^saidas\s*[:=-]?$/i,
    /\bsaldo\s+inicial\b.*\bsaldo\s+final\b/i,
    /\bentradas\b.*\bsaidas\b/i,
    /^detalhe\s+dos\s+movimentos/i,
    /^data\s+descricao\s+(id\s+da\s+operacao\s+)?valor/i,
  ];

  return balancePatterns.some((re) => re.test(clean));
}

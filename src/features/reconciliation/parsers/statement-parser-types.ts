export type StatementFileFormat = 'CSV' | 'OFX' | 'XLSX' | 'PDF' | 'TXT';

export type MovementDirection = 'INFLOW' | 'OUTFLOW';

export type PaymentMethodHint =
  | 'PIX'
  | 'TED'
  | 'DOC'
  | 'BOLETO'
  | 'DEBITO_AUTOMATICO'
  | 'CARTAO_DEBITO'
  | 'CARTAO_CREDITO'
  | 'TRANSFERENCIA'
  | 'TARIFA'
  | 'ESTORNO'
  | 'OUTRO';

export interface StatementFileInput {
  fileId: string;
  fileName: string;
  mimeType?: string;
  sizeInBytes?: number;
  /** Conteúdo textual direto (para CSV, OFX, TXT) ou Base64 / DataURL (para PDF, XLSX, binários) */
  content: string;
  isBase64?: boolean;
}

export interface NormalizedRawMovement {
  rawId: string;
  fileId: string;
  fileName: string;
  fileFormat: StatementFileFormat;
  bankName: string;
  lineIndex: number;
  date: string; // YYYY-MM-DD (extraído deterministicamente)
  amountInCents: number; // Inteiro positivo em centavos (extraído deterministicamente)
  direction: MovementDirection; // INFLOW (+) | OUTFLOW (-)
  originalDescription: string;
  normalizedDescription: string;
  counterparty: string | null;
  paymentMethod: PaymentMethodHint;
  fitId: string | null;
  externalHash: string;
  runningBalanceInCents?: number | null;
}

export interface ParsedStatementFileResult {
  fileId: string;
  fileName: string;
  fileFormat: StatementFileFormat;
  bankName: string;
  periodStart: string | null; // YYYY-MM-DD
  periodEnd: string | null; // YYYY-MM-DD
  openingBalanceInCents?: number | null;
  closingBalanceInCents?: number | null;
  fileHash: string;
  status: 'PROCESSED' | 'ERROR';
  errorMessage?: string;
  movements: NormalizedRawMovement[];
  ignoredNonEffectiveLines: number;
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const BRAZILIAN_BANK_CODES: Record<string, string> = {
  '001': 'Banco do Brasil',
  '033': 'Santander',
  '077': 'Banco Inter',
  '104': 'Caixa Econômica Federal',
  '208': 'BTG Pactual',
  '237': 'Bradesco',
  '260': 'Nubank',
  '336': 'C6 Bank',
  '341': 'Itaú Unibanco',
  '422': 'Banco Safra',
  '748': 'Sicredi',
  '756': 'Sicoob',
  '102': 'XP Investimentos',
  '290': 'PagBank',
  '380': 'PicPay',
  '323': 'Mercado Pago',
};

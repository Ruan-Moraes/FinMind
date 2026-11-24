import { parseCsvOrTextContent } from '@/features/reconciliation/parsers/csv-text-parser';
import { parseOfxContent } from '@/features/reconciliation/parsers/ofx-parser';
import {
  computeDeterministicHash,
  detectFinancialInstitution,
  detectStatementFormat,
} from '@/features/reconciliation/parsers/statement-detectors';
import {
  MAX_FILE_SIZE_BYTES,
  ParsedStatementFileResult,
  StatementFileInput,
} from '@/features/reconciliation/parsers/statement-parser-types';

import { extractTextRowsFromXlsx, extractTextFromPdfContentAsync } from "@/features/reconciliation/parsers/pdf-xlsx-extractors";

/**
 * Processa e normaliza um único arquivo de extrato com isolamento completo de falhas.
 */
export async function parseStatementFile(
  input: StatementFileInput
): Promise<ParsedStatementFileResult> {
  const fileName = (input.fileName || 'extrato.txt').trim();
  const rawContent = input.content || '';
  const estimatedSize = input.sizeInBytes || Buffer.byteLength(rawContent, 'utf8');

  if (estimatedSize > MAX_FILE_SIZE_BYTES) {
    return {
      fileId: input.fileId,
      fileName,
      fileFormat: detectStatementFormat(fileName, ''),
      bankName: 'Instituição Financeira',
      periodStart: null,
      periodEnd: null,
      fileHash: '',
      status: 'ERROR',
      errorMessage: `O arquivo "${fileName}" excede o limite máximo de 10 MB.`,
      movements: [],
      ignoredNonEffectiveLines: 0,
    };
  }

  if (!rawContent || !rawContent.trim()) {
    return {
      fileId: input.fileId,
      fileName,
      fileFormat: detectStatementFormat(fileName, ''),
      bankName: 'Instituição Financeira',
      periodStart: null,
      periodEnd: null,
      fileHash: '',
      status: 'ERROR',
      errorMessage: `O arquivo "${fileName}" está vazio ou não contém dados legíveis.`,
      movements: [],
      ignoredNonEffectiveLines: 0,
    };
  }

  try {
    let decodedPreview = rawContent;
    if (input.isBase64) {
      const cleanB64 = rawContent.replace(/^data:[^;]+;base64,/, '');
      decodedPreview = Buffer.from(cleanB64, 'base64').toString('utf8');
    }

    const fileFormat = detectStatementFormat(fileName, decodedPreview);
    const fileHash = computeDeterministicHash(
      `${fileName}:${rawContent.length}:${rawContent.slice(0, 2048)}`
    );

    let textToParse = decodedPreview;
    if (fileFormat === 'XLSX') {
      textToParse = extractTextRowsFromXlsx(rawContent, input.isBase64);
    } else if (fileFormat === 'PDF') {
      textToParse = await extractTextFromPdfContentAsync(rawContent, input.isBase64);
    }

    const bankName = detectFinancialInstitution(fileName, textToParse);

    const parsed =
      fileFormat === 'OFX'
        ? parseOfxContent(input, textToParse, bankName)
        : parseCsvOrTextContent(input, textToParse, fileFormat, bankName);

    if (parsed.movements.length === 0) {
      return {
        fileId: input.fileId,
        fileName,
        fileFormat,
        bankName,
        periodStart: null,
        periodEnd: null,
        fileHash,
        status: 'ERROR',
        errorMessage: `Nenhuma movimentação financeira válida foi encontrada em "${fileName}". Verifique se o arquivo é um extrato válido.`,
        movements: [],
        ignoredNonEffectiveLines: parsed.ignoredNonEffectiveLines,
      };
    }

    return {
      fileId: input.fileId,
      fileName,
      fileFormat,
      bankName,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      fileHash,
      status: 'PROCESSED',
      movements: parsed.movements,
      ignoredNonEffectiveLines: parsed.ignoredNonEffectiveLines,
      openingBalanceInCents: parsed.openingBalanceInCents ?? null,
      closingBalanceInCents: parsed.closingBalanceInCents ?? null,
    };
  } catch (err) {
    return {
      fileId: input.fileId,
      fileName,
      fileFormat: detectStatementFormat(fileName, ''),
      bankName: 'Instituição Financeira',
      periodStart: null,
      periodEnd: null,
      fileHash: '',
      status: 'ERROR',
      errorMessage:
        err instanceof Error
          ? `Falha ao ler "${fileName}": ${err.message}`
          : `Formato inválido ou arquivo corrompido em "${fileName}".`,
      movements: [],
      ignoredNonEffectiveLines: 0,
    };
  }
}

/**
 * Processa múltiplos arquivos de extrato simultaneamente, tratando falhas individualmente.
 */
export async function parseMultipleStatementFiles(
  files: StatementFileInput[]
): Promise<ParsedStatementFileResult[]> {
  return Promise.all(files.slice(0, 25).map((file) => parseStatementFile(file)));
}

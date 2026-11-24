export {
  type StatementFileFormat,
  type MovementDirection,
  type PaymentMethodHint,
  type StatementFileInput,
  type NormalizedRawMovement,
  type ParsedStatementFileResult,
  MAX_FILE_SIZE_BYTES,
  BRAZILIAN_BANK_CODES,
} from '@/features/reconciliation/parsers/statement-parser-types';

export {
  computeDeterministicHash,
  detectStatementFormat,
  detectFinancialInstitution,
  extractPeriodFromFileName,
  isNonEffectiveBalanceLine,
} from '@/features/reconciliation/parsers/statement-detectors';

export {
  parseDeterministicDate,
  parseDeterministicMonetaryAmount,
  parseSignedMoneyTokenToCents,
} from '@/features/reconciliation/parsers/statement-value-normalizers';

export {
  extractDescriptionMetadata,
  createNormalizedMovement,
  reconcileDirectionsByRunningBalance,
} from '@/features/reconciliation/parsers/movement-metadata-builder';

export { parseOfxContent } from '@/features/reconciliation/parsers/ofx-parser';

export {
  STATEMENT_MONEY_REGEX,
  extractLeadingOrInlineDateMatch,
  stripInlinePdfHeaderFooterNoise,
  isPdfNoiseOrHeaderLine,
  stitchMultiLineStatementRows,
} from '@/features/reconciliation/parsers/pdf-text-stitcher';

export {
  splitCsvRow,
  parseCsvOrTextContent,
} from '@/features/reconciliation/parsers/csv-text-parser';

export {
  extractTextRowsFromXlsx,
  extractTextFromPdfFallbackSync,
  extractTextFromPdfContentAsync,
  parseStatementFile,
  parseMultipleStatementFiles,
} from '@/features/reconciliation/parsers/binary-extractors';

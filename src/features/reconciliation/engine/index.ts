export type {
  StatementMovementKind,
  FinancialPurpose,
  ConfidenceLevel,
  ReconciliationDecisionType,
  MatchPrecisionKind,
  ExistingRuleCandidate,
  ExistingTransactionCandidate,
  ExistingInvoiceCandidate,
  UserMemoryRuleCandidate,
  AlternativeMatchOption,
  ReconciledStatementItem,
  StatementImportReviewPlan,
  OptionalAiEnrichmentItem,
} from '@/features/reconciliation/engine/reconciliation-types';

export {
  type SemanticRuleSpec,
  SEMANTIC_TAXONOMY,
} from '@/features/reconciliation/engine/semantic-taxonomy';

export {
  sanitizeTextForExternalAi,
  inferPurposeFromText,
  calculateTokenSimilarity,
  isGenericBankDescription,
  buildMemoryPatternKey,
  enrichTransactionMetadata,
} from '@/features/reconciliation/engine/purpose-classifier';

export {
  scoreRecurrenceRuleCandidate,
  scoreExistingTransactionCandidate,
} from '@/features/reconciliation/engine/candidate-scorer';

export {
  runIntelligentReconciliationPipeline,
} from '@/features/reconciliation/engine/reconciliation-pipeline';

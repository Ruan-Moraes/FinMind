export type StatementMovementKind =
  | 'INCOME' // Entrada financeira efetiva
  | 'EXPENSE' // Saída financeira efetiva
  | 'OBLIGATION_PAYMENT' // Pagamento de obrigação / despesa fixa ou recorrente
  | 'SELF_TRANSFER' // Transferência entre contas próprias (não é receita nem despesa)
  | 'CREDIT_CARD_PAYMENT' // Pagamento de fatura de cartão (evita dupla contagem)
  | 'REFUND' // Estorno ou reembolso
  | 'NON_EFFECTIVE'; // Movimentação que não representa receita ou despesa efetiva

export type FinancialPurpose =
  | 'HOUSING_RENT' // Aluguel / Imobiliária / Locação
  | 'HOUSING_CONDO' // Condomínio
  | 'INTERNET_TELECOM' // Internet / Telefonia / TV (Claro, Vivo, Tim, Oi, Net)
  | 'GYM_FITNESS' // Academia / Atividade física (Smart Fit, Bluefit, Gympass)
  | 'SALARY_COMPENSATION' // Salário / Folha / Pró-labore / Remuneração
  | 'GROCERY_SUPERMARKET' // Supermercado / Atacadão / Feira / Mercearia
  | 'FOOD_DINING' // Restaurante / iFood / Lanchonete / Padaria
  | 'SUBSCRIPTION_STREAMING' // Assinaturas digitais (Netflix, Spotify, Prime, iCloud)
  | 'UTILITIES_ENERGY_WATER' // Energia elétrica / Água / Gás
  | 'FINANCING_LOAN' // Financiamento / Empréstimo / Consórcio
  | 'CREDIT_CARD_BILL' // Pagamento de fatura de cartão de crédito
  | 'BANK_FEE' // Tarifa bancária / IOF / Cesta de serviços
  | 'SELF_TRANSFER' // Transferência entre contas próprias / Aplicação / Resgate
  | 'PEER_TRANSFER' // Transferência para terceiros sem finalidade específica
  | 'REFUND_REVERSAL' // Reembolso / Estorno / Cashback
  | 'TRANSPORT_MOBILITY' // Uber / 99 / Combustível / Estacionamento / Pedágio
  | 'HEALTH_MEDICAL' // Farmácia / Plano de saúde / Consulta / Exame
  | 'EDUCATION' // Faculdade / Curso / Escola
  | 'FREELANCE_REVENUE' // Prestação de serviços / Freelance / Projeto
  | 'INVESTMENT_YIELD' // Rendimentos / Dividendos
  | 'GENERAL_UNKNOWN'; // Descrição genérica ou sem finalidade específica identificável

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type ReconciliationDecisionType =
  | 'RECONCILE_RULE' // Conciliar com RecurrenceRule (despesa fixa / receita recorrente)
  | 'RECONCILE_TRANSACTION' // Conciliar com Transaction existente (prevista ou manual do período)
  | 'PAY_CREDIT_CARD_INVOICE' // Quitar fatura de cartão de crédito existente
  | 'CREATE_NEW' // Criar nova Receita ou Despesa
  | 'RECORD_SELF_TRANSFER' // Registrar transferência entre contas próprias
  | 'SKIP_DUPLICATE' // Ignorar movimentação duplicada
  | 'NEEDS_MANUAL_REVIEW'; // Baixa confiança ou ambiguidade que exige decisão do usuário

export type MatchPrecisionKind =
  | 'EXACT_MATCH' // Valor, ação, finalidade e contexto exatos
  | 'SEMANTIC_MATCH' // Descrição bancária diferente mas mesma obrigação semântica
  | 'VALUE_VARIATION' // Pequena variação justificável (juros, desconto ou conta variável)
  | 'PARTIAL_PAYMENT' // Pagamento parcial de lançamento existente
  | 'MULTI_MOVEMENT_GROUP' // Múltiplas movimentações que juntas liquidam um lançamento
  | 'AMBIGUOUS_CANDIDATES' // Múltiplos lançamentos candidatos sem evidência suficiente
  | 'NEW_ENTRY' // Sem lançamento prévio correspondente -> novo registro
  | 'DUPLICATE_IN_BATCH' // Duplicada entre arquivos da mesma importação
  | 'DUPLICATE_IN_DB'; // Já importada/cadastrada anteriormente no banco

export interface ExistingRuleCandidate {
  id: string;
  description: string;
  type: 'INCOME' | 'EXPENSE';
  nature: 'STATIC' | 'VARIABLE';
  amountInCents: number;
  dayOfMonth: number;
  frequency: string;
  categoryId: string | null;
  categoryName: string | null;
  accountId: string | null;
  alreadyPaidInMonth?: boolean;
}

export interface ExistingTransactionCandidate {
  id: string;
  description: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  nature: 'STATIC' | 'VARIABLE';
  amountInCents: number;
  date: string; // YYYY-MM-DD
  status: 'COMPLETED' | 'PENDING';
  categoryId: string | null;
  categoryName: string | null;
  sourceAccountId: string | null;
  recurrenceRuleId: string | null;
  externalTransactionHash: string | null;
  rawBankDescription: string | null;
}

export interface ExistingInvoiceCandidate {
  id: string;
  creditCardId: string;
  creditCardName: string;
  month: number;
  year: number;
  status: 'OPEN' | 'CLOSED' | 'PAID';
  totalAmountInCents: number;
  dueDay: number;
}

export interface UserMemoryRuleCandidate {
  id: string;
  normalizedPattern: string;
  merchantKeyword: string;
  financialAction: string;
  purpose: string;
  targetType: string;
  nature: string;
  categoryId: string | null;
  recurrenceRuleId: string | null;
  confirmCount: number;
}

export interface AlternativeMatchOption {
  targetKind: 'RULE' | 'TRANSACTION' | 'INVOICE';
  targetId: string;
  label: string;
  amountInCents: number;
  score: number;
  reasonSummary: string;
}

export interface ReconciledStatementItem {
  itemId: string;
  fileId: string;
  fileName: string;
  fileFormat: string;
  bankName: string;
  date: string; // YYYY-MM-DD
  amountInCents: number;
  direction: 'INFLOW' | 'OUTFLOW';
  originalDescription: string;
  normalizedDescription: string;
  counterparty: string | null;
  paymentMethod: string;
  externalHash: string;

  movementKind: StatementMovementKind;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  nature: 'STATIC' | 'VARIABLE';
  financialActionCode: string;
  financialActionLabel: string;
  purpose: FinancialPurpose;
  purposeLabel: string;
  isRecurringLikely: boolean;
  recurrenceHint: string | null;

  categoryId: string;
  categoryName: string;
  tags: string;
  classificationSource?:
    | 'USER_MEMORY'
    | 'AI_MODEL'
    | 'RECONCILED_ENTITY'
    | 'SEMANTIC_RULE'
    | 'UNCLASSIFIED';
  isAiClassified?: boolean;
  isUserConfirmed?: boolean;

  decisionType: ReconciliationDecisionType;
  matchPrecision: MatchPrecisionKind;
  matchedRuleId: string | null;
  matchedRuleDescription: string | null;
  matchedRuleAmountInCents: number | null;
  matchedTransactionId: string | null;
  matchedTransactionDescription: string | null;
  matchedTransactionAmountInCents: number | null;
  matchedInvoiceId: string | null;
  matchedInvoiceLabel: string | null;
  valueDifferenceInCents: number;

  confidenceScore: number; // 0 a 100
  confidenceLevel: ConfidenceLevel; // HIGH | MEDIUM | LOW
  reasons: string[];
  reasonSummary: string;
  alternativeCandidates: AlternativeMatchOption[];

  selectedForImport: boolean;
  requiresUserAttention: boolean;
}

export interface StatementImportReviewPlan {
  files: Array<{
    fileId: string;
    fileName: string;
    fileFormat: string;
    bankName: string;
    periodStart: string | null;
    periodEnd: string | null;
    fileHash: string;
    status: 'PROCESSED' | 'ERROR';
    errorMessage?: string;
    extractedCount: number;
    ignoredNonEffectiveLines: number;
    openingBalanceInCents?: number | null;
    closingBalanceInCents?: number | null;
  }>;
  items: ReconciledStatementItem[];
  summary: {
    totalFiles: number;
    processedFiles: number;
    errorFiles: number;
    totalMovements: number;
    identifiedIncomesCount: number;
    identifiedIncomesCents: number;
    identifiedExpensesCount: number;
    identifiedExpensesCents: number;
    reconciledCount: number;
    newEntriesCount: number;
    selfTransfersAndInvoicesCount: number;
    duplicatesCount: number;
    needsReviewCount: number;
    highConfidenceCount: number;
    mediumConfidenceCount: number;
    lowConfidenceCount: number;
  };
}

export interface OptionalAiEnrichmentItem {
  rawId: string;
  financialActionLabel?: string;
  purpose?: FinancialPurpose;
  categoryId?: string;
  nature?: 'STATIC' | 'VARIABLE';
  movementKind?: StatementMovementKind;
}

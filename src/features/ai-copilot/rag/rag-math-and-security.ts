import { inferPurposeFromText, type FinancialPurpose } from "@/features/reconciliation/engine";

export type KnowledgeSourceType =
  | 'TRANSACTION'
  | 'RECURRENCE_RULE'
  | 'PORTFOLIO_GOAL'
  | 'BUDGET';

export interface RetrievedKnowledgeChunk {
  id: string;
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  contentText: string;
  referenceDate: string | null;
  month: number | null;
  year: number | null;
  amountInCents: number | null;
  score: number;
  embeddingModel: string;
}

const ALL_PURPOSES: FinancialPurpose[] = [
  'HOUSING_RENT',
  'HOUSING_CONDO',
  'INTERNET_TELECOM',
  'GYM_FITNESS',
  'SALARY_COMPENSATION',
  'GROCERY_SUPERMARKET',
  'FOOD_DINING',
  'SUBSCRIPTION_STREAMING',
  'UTILITIES_ENERGY_WATER',
  'FINANCING_LOAN',
  'CREDIT_CARD_BILL',
  'BANK_FEE',
  'SELF_TRANSFER',
  'PEER_TRANSFER',
  'REFUND_REVERSAL',
  'TRANSPORT_MOBILITY',
  'HEALTH_MEDICAL',
  'EDUCATION',
  'FREELANCE_REVENUE',
  'INVESTMENT_YIELD',
  'GENERAL_UNKNOWN',
];

/**
 * Sanitiza textos financeiros recuperados contra instruções maliciosas (Indirect Prompt Injection - Seção 12.2).
 */
export function sanitizeRetrievedContentAgainstPromptInjection(rawText: string): string {
  return String(rawText || '')
    .replace(
      /\b(ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?|ignore\s+todas\s+as\s+instru[cç][oõ]es(?:\s+anteriores)?|system\s*prompt\s*:|you\s+are\s+now|voc[eê]\s+agora\s+[eé]|disregard\s+all|forget\s+everything|novo\s+comando\s+do\s+sistema)\b/gi,
      '[instrução bloqueada]'
    )
    .replace(/<\/?(?:script|iframe|system|instruction|prompt)[^>]*>/gi, '')
    .trim();
}

/**
 * Gera um vetor semântico-financeiro determinístico de 64 dimensões (norma L2 = 1)
 * que codifica taxonomia financeira, direção, natureza e hashing semântico de tokens.
 * Utilizado quando não há API externa de embeddings disponível (ex.: Claude sem chave OpenAI/Gemini ou modo local).
 */
export function computeDeterministicFinancialEmbedding(text: string): number[] {
  const dim = 64;
  const vec = new Array<number>(dim).fill(0);
  const clean = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Dimensões 0..20: Taxonomia de finalidade financeira (FinancialPurpose)
  const inferred = inferPurposeFromText(clean);
  const purposeIdx = ALL_PURPOSES.indexOf(inferred.purpose);
  if (purposeIdx >= 0 && purposeIdx < 21) {
    vec[purposeIdx] = 2.5;
  }

  // Dimensões 21..25: Direção e Natureza
  if (/\b(receita|entrada|ganho|income|recebido|salario|rendimento)\b/.test(clean)) vec[21] = 1.8;
  if (/\b(despesa|saida|gasto|expense|pagamento|compra|debito)\b/.test(clean)) vec[22] = 1.8;
  if (/\b(transferencia|transfer)\b/.test(clean)) vec[23] = 1.8;
  if (/\b(estatico|fixo|fixa|recorrente|mensal|static)\b/.test(clean)) vec[24] = 1.5;
  if (/\b(variavel|variable|pontual)\b/.test(clean)) vec[25] = 1.5;

  // Dimensões 26..31: Entidades de Metas, Orçamentos e Meses
  if (/\b(meta|objetivo|patrimonio|carteira|alcancar|prazo)\b/.test(clean)) vec[26] = 2.2;
  if (/\b(orcamento|limite|teto)\b/.test(clean)) vec[27] = 2.2;
  if (/\b(cartao|fatura|parcela)\b/.test(clean)) vec[28] = 1.8;
  if (/\b(pix|boleto|ted|debito automatico)\b/.test(clean)) vec[29] = 1.2;

  // Dimensões 32..63: Feature Hashing de tokens significativos
  const stopWords = new Set([
    'de',
    'da',
    'do',
    'em',
    'no',
    'na',
    'para',
    'com',
    'por',
    'valor',
    'data',
    'categoria',
    'natureza',
    'tipo',
  ]);
  const tokens = clean
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !stopWords.has(t));

  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const bucket = 32 + (Math.abs(h) % 32);
    vec[bucket] += 1.0;
  }

  // Normalização L2
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      vec[i] = Number((vec[i] / norm).toFixed(6));
    }
  }
  return vec;
}

/**
 * Calcula similaridade cosseno entre dois vetores numéricos.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}


export interface CandidateKnowledgeDoc {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  referenceDate: Date | null;
  month: number | null;
  year: number | null;
  categoryId: string | null;
  amountInCents: number | null;
  title: string;
  contentText: string;
  metadataJson: string;
  contentHash: string;
}


export {
  type KnowledgeSourceType,
  type RetrievedKnowledgeChunk,
  type CandidateKnowledgeDoc,
  sanitizeRetrievedContentAgainstPromptInjection,
  computeDeterministicFinancialEmbedding,
  cosineSimilarity,
} from "@/features/ai-copilot/rag/rag-math-and-security";

export { generateEmbeddingsBatch } from "@/features/ai-copilot/rag/embedding-gateway";
export { buildCandidateKnowledgeDocs } from "@/features/ai-copilot/rag/knowledge-builder";
export {
  syncUserFinancialKnowledge,
  retrieveFinancialContextForQuery,
} from "@/features/ai-copilot/rag/knowledge-repository";

import type { AssistantChartSpec } from "@/features/ai-copilot/assistant/assistant-chart-builder";

/**
 * Formato das respostas do assistente legado (anterior ao Agente IA). Não é mais gerado,
 * mas continua sendo usado para reabrir conversas antigas salvas em AiChatMessage.responseJson.
 */
export interface AssistantStructuredResponse {
  ok: boolean;
  question: string;
  executionMode: 'LIVE_LLM_RAG' | 'DETERMINISTIC_RAG_ENGINE';
  modelUsed: string;
  providerUsed: string;
  hasSufficientData: boolean;
  directAnswer: string;
  historicalFacts: string[];
  calculatedResults: string[];
  projectionsAndEstimates: string[];
  personalizedRecommendations: string[];
  retrievedSources: Array<{
    sourceType: string;
    sourceId: string;
    title: string;
    referenceDate: string | null;
    amountInCents: number | null;
    score: number;
  }>;
  ragStats: {
    totalIndexedChunks: number;
    retrievedChunksCount: number;
    embeddingModelUsed: string;
  };
  charts?: AssistantChartSpec[];
  apiWarning?: string | null;
  answeredAt: string;
}

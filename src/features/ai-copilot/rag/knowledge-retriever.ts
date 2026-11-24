import { prisma } from "@/shared/lib/prisma";
import { MONTH_NAMES_PT } from "@/shared/lib/currency";
import {
  type KnowledgeSourceType,
  type RetrievedKnowledgeChunk,
  computeDeterministicFinancialEmbedding,
  cosineSimilarity,
  sanitizeRetrievedContentAgainstPromptInjection,
} from "@/features/ai-copilot/rag/rag-math-and-security";
import { generateEmbeddingsBatch } from "@/features/ai-copilot/rag/embedding-gateway";

import { syncUserFinancialKnowledge } from "@/features/ai-copilot/rag/knowledge-sync";

/**
 * Executa Recuperação Contextual Híbrida (Semântica Vetorial + Léxica/Temporal)
 * estritamente isolada para o `userId` autenticado.
 */
export async function retrieveFinancialContextForQuery(params: {
  userId: string;
  query: string;
  topK?: number;
  filterMonth?: number;
  filterYear?: number;
  userKeys?: {
    openaiApiKey?: string | null;
    geminiApiKey?: string | null;
  };
}): Promise<{
  chunks: RetrievedKnowledgeChunk[];
  embeddingModelUsed: string;
  totalIndexedChunks: number;
}> {
  const { userId, query, topK = 15, userKeys } = params;

  // Garante que a base de conhecimento do usuário esteja sincronizada com o banco atual
  await syncUserFinancialKnowledge(userId, userKeys);

  const allUserChunks = await prisma.financialKnowledgeChunk.findMany({
    where: { userId },
    orderBy: { referenceDate: 'desc' },
  });

  if (allUserChunks.length === 0) {
    return {
      chunks: [],
      embeddingModelUsed: 'none',
      totalIndexedChunks: 0,
    };
  }

  // Detecta se os chunks no banco usam embedding externo (OpenAI/Gemini) ou local
  const hasExternalEmbeddings = allUserChunks.some(
    (c) =>
      c.embeddingModel === 'text-embedding-3-small' ||
      c.embeddingModel === 'text-embedding-004'
  );

  let queryVector: number[] = [];
  let queryEmbeddingModel = 'financial-semantic-v1';

  if (hasExternalEmbeddings) {
    const embRes = await generateEmbeddingsBatch([query], userKeys);
    queryVector = embRes.vectors[0] || computeDeterministicFinancialEmbedding(query);
    queryEmbeddingModel = embRes.model;
  } else {
    queryVector = computeDeterministicFinancialEmbedding(query);
  }

  const localQueryVector = computeDeterministicFinancialEmbedding(query);

  const qNorm = query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const queryTokens = qNorm
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  // Detecta menções de meses na pergunta (ex: "setembro", "outubro", "novembro")
  const monthNamesNorm = MONTH_NAMES_PT.map((m) =>
    m
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  );
  const mentionedMonths: number[] = [];
  monthNamesNorm.forEach((mName, idx) => {
    if (qNorm.includes(mName)) {
      mentionedMonths.push(idx + 1);
    }
  });

  const scored: RetrievedKnowledgeChunk[] = allUserChunks.map((chunk) => {
    let parsedVec: number[] = [];
    try {
      parsedVec = JSON.parse(chunk.embeddingJson);
    } catch {
      parsedVec = [];
    }

    // 1. Score Semântico Vetorial
    let semanticSim = 0;
    if (
      parsedVec.length === queryVector.length &&
      chunk.embeddingModel === queryEmbeddingModel
    ) {
      semanticSim = Math.max(0, cosineSimilarity(queryVector, parsedVec));
    } else {
      const fallbackChunkVec = computeDeterministicFinancialEmbedding(chunk.contentText);
      semanticSim = Math.max(0, cosineSimilarity(localQueryVector, fallbackChunkVec));
    }

    // 2. Score Léxico e de Entidades (BM25 / Token Overlap)
    const contentNorm = chunk.contentText
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    let matchedTokenCount = 0;
    for (const qt of queryTokens) {
      if (contentNorm.includes(qt)) {
        matchedTokenCount += 1;
      }
    }
    const lexicalScore =
      queryTokens.length > 0 ? matchedTokenCount / queryTokens.length : 0;

    // 3. Boost Contextual por Intenção (Metas, Regras Recorrentes, Período Mencionado)
    let contextBoost = 0;
    if (
      mentionedMonths.length > 0 &&
      chunk.month &&
      mentionedMonths.includes(chunk.month)
    ) {
      contextBoost += 0.35;
    } else if (
      mentionedMonths.length === 0 &&
      params.filterMonth &&
      params.filterYear &&
      chunk.month === params.filterMonth &&
      chunk.year === params.filterYear
    ) {
      contextBoost += 0.12;
    }

    if (
      /\b(meta|objetivo|patrimonio|alcancar|falta|prazo)\b/.test(qNorm) &&
      chunk.sourceType === 'PORTFOLIO_GOAL'
    ) {
      contextBoost += 0.45;
    }

    if (
      /\b(fixo|fixa|estatico|recorrente|mensalidade|assinatura|aluguel|salario)\b/.test(qNorm) &&
      chunk.sourceType === 'RECURRENCE_RULE'
    ) {
      contextBoost += 0.35;
    }

    if (
      /\b(orcamento|teto|limite)\b/.test(qNorm) &&
      chunk.sourceType === 'BUDGET'
    ) {
      contextBoost += 0.35;
    }

    const combinedScore = Number(
      (semanticSim * 0.55 + lexicalScore * 0.45 + contextBoost).toFixed(4)
    );

    return {
      id: chunk.id,
      sourceType: chunk.sourceType as KnowledgeSourceType,
      sourceId: chunk.sourceId,
      title: chunk.title,
      contentText: sanitizeRetrievedContentAgainstPromptInjection(chunk.contentText),
      referenceDate: chunk.referenceDate ? chunk.referenceDate.toISOString().slice(0, 10) : null,
      month: chunk.month,
      year: chunk.year,
      amountInCents: chunk.amountInCents,
      score: combinedScore,
      embeddingModel: chunk.embeddingModel,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return {
    chunks: scored.slice(0, topK),
    embeddingModelUsed: queryEmbeddingModel,
    totalIndexedChunks: allUserChunks.length,
  };
}

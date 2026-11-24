import { prisma } from "@/shared/lib/prisma";
import { computeDeterministicFinancialEmbedding } from "@/features/ai-copilot/rag/rag-math-and-security";
import { generateEmbeddingsBatch } from "@/features/ai-copilot/rag/embedding-gateway";
import { buildCandidateKnowledgeDocs } from "@/features/ai-copilot/rag/knowledge-builder";

/**
 * Sincroniza a base de conhecimento RAG (`FinancialKnowledgeChunk`) com os registros financeiros reais do usuário:
 * - Previne duplicidades via chave única `(userId, sourceType, sourceId)` e `contentHash`.
 * - Atualiza apenas os registros cujo conteúdo foi modificado.
 * - Remove chunks de registros que foram excluídos ou revertidos.
 * - Preserva isolamento absoluto por `userId`.
 */
export async function syncUserFinancialKnowledge(
  userId: string,
  userKeys?: {
    openaiApiKey?: string | null;
    geminiApiKey?: string | null;
  }
): Promise<{
  totalActiveChunks: number;
  upsertedCount: number;
  deletedCount: number;
  embeddingModelUsed: string;
}> {
  const [transactions, rules, goals, budgets, existingChunks] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      include: {
        category: true,
        sourceAccount: true,
        destinationAccount: true,
        creditCard: true,
      },
      orderBy: { date: 'desc' },
      take: 800,
    }),
    prisma.recurrenceRule.findMany({
      where: { userId, isActive: true },
      include: { category: true, account: true },
    }),
    prisma.portfolioGoal.findMany({
      where: { userId },
    }),
    prisma.budget.findMany({
      where: { userId },
      include: { category: true },
    }),
    prisma.financialKnowledgeChunk.findMany({
      where: { userId },
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        contentHash: true,
        embeddingModel: true,
      },
    }),
  ]);

  const candidateDocs = buildCandidateKnowledgeDocs({ transactions, rules, goals, budgets });
  // Identifica chunks obsoletos (excluídos ou revertidos) e os remove
  const validCompositeKeys = new Set(
    candidateDocs.map((d) => `${d.sourceType}::${d.sourceId}`)
  );
  const existingMap = new Map<
    string,
    { id: string; contentHash: string; embeddingModel: string }
  >();
  const obsoleteChunkIds: string[] = [];

  for (const ch of existingChunks) {
    const key = `${ch.sourceType}::${ch.sourceId}`;
    if (!validCompositeKeys.has(key)) {
      obsoleteChunkIds.push(ch.id);
    } else {
      existingMap.set(key, {
        id: ch.id,
        contentHash: ch.contentHash,
        embeddingModel: ch.embeddingModel,
      });
    }
  }

  if (obsoleteChunkIds.length > 0) {
    await prisma.financialKnowledgeChunk.deleteMany({
      where: {
        userId,
        id: { in: obsoleteChunkIds },
      },
    });
  }

  // Filtra apenas documentos novos ou cujo contentHash mudou
  const docsToEmbed = candidateDocs.filter((doc) => {
    const existing = existingMap.get(`${doc.sourceType}::${doc.sourceId}`);
    return !existing || existing.contentHash !== doc.contentHash;
  });

  let embeddingModelUsed = existingChunks[0]?.embeddingModel || 'financial-semantic-v1';
  let upsertedCount = 0;

  // Processa em lotes de até 64 itens para eficiência
  const BATCH_SIZE = 64;
  for (let i = 0; i < docsToEmbed.length; i += BATCH_SIZE) {
    const slice = docsToEmbed.slice(i, i + BATCH_SIZE);
    const { vectors, model } = await generateEmbeddingsBatch(
      slice.map((d) => d.contentText),
      userKeys
    );
    embeddingModelUsed = model;

    await prisma.$transaction(
      slice.map((doc, idx) => {
        const vector = vectors[idx] || computeDeterministicFinancialEmbedding(doc.contentText);
        return prisma.financialKnowledgeChunk.upsert({
          where: {
            userId_sourceType_sourceId: {
              userId,
              sourceType: doc.sourceType,
              sourceId: doc.sourceId,
            },
          },
          create: {
            userId,
            sourceType: doc.sourceType,
            sourceId: doc.sourceId,
            referenceDate: doc.referenceDate,
            month: doc.month,
            year: doc.year,
            categoryId: doc.categoryId,
            amountInCents: doc.amountInCents,
            title: doc.title,
            contentText: doc.contentText,
            metadataJson: doc.metadataJson,
            contentHash: doc.contentHash,
            embeddingJson: JSON.stringify(vector),
            embeddingModel: model,
          },
          update: {
            referenceDate: doc.referenceDate,
            month: doc.month,
            year: doc.year,
            categoryId: doc.categoryId,
            amountInCents: doc.amountInCents,
            title: doc.title,
            contentText: doc.contentText,
            metadataJson: doc.metadataJson,
            contentHash: doc.contentHash,
            embeddingJson: JSON.stringify(vector),
            embeddingModel: model,
          },
        });
      })
    );

    upsertedCount += slice.length;
  }

  return {
    totalActiveChunks: candidateDocs.length,
    upsertedCount,
    deletedCount: obsoleteChunkIds.length,
    embeddingModelUsed,
  };
}

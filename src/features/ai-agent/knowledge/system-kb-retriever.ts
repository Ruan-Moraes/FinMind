import { prisma } from '@/shared/lib/prisma';
import {
  computeDeterministicFinancialEmbedding,
  cosineSimilarity,
  sanitizeRetrievedContentAgainstPromptInjection,
} from '@/features/ai-copilot/rag/rag-math-and-security';
import {
  loadKnowledgeDocumentsFromDisk,
  syncSystemKnowledgeBase,
} from '@/features/ai-agent/knowledge/system-kb-sync';

export interface RetrievedSystemKnowledgeChunk {
  id: string;
  docId: string;
  module: string;
  sectionPath: string;
  screens: string[];
  relatedTools: string[];
  contentText: string;
  score: number;
  embeddingModel: string;
}

const STOP_WORDS = new Set([
  'como', 'para', 'onde', 'qual', 'quais', 'faco', 'fazer', 'uma', 'uns', 'com',
  'por', 'que', 'dos', 'das', 'nos', 'nas', 'meu', 'minha', 'meus', 'sistema', 'tela',
]);

function normalizeTokens(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

function safeParseStringArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

let lastVerifiedKbSignature: string | null = null;

export async function retrieveSystemKnowledge(params: {
  query: string;
  activeTab?: string;
  topK?: number;
}): Promise<{
  chunks: RetrievedSystemKnowledgeChunk[];
  totalIndexedChunks: number;
  embeddingModelUsed: string;
}> {
  const { query, activeTab, topK = 6 } = params;

  type StoredChunkRow = {
    id: string;
    docId: string;
    module: string;
    sectionPath: string;
    screensJson: string;
    relatedToolsJson: string;
    tagsJson: string;
    contentText: string;
    embeddingJson: string;
    embeddingModel: string;
  };

  let allChunks: StoredChunkRow[] = [];
  const hasSystemKbDelegate = Boolean(
    (prisma as unknown as Record<string, unknown>).systemKnowledgeChunk
  );

  if (hasSystemKbDelegate) {
    if (!lastVerifiedKbSignature) {
      const diskDocs = await loadKnowledgeDocumentsFromDisk();
      const diskSig = diskDocs.map((d) => `${d.frontmatter.docId}:${d.contentHash}`).sort().join('|');
      const dbDocs = await prisma.systemKnowledgeDocument.findMany({
        select: { docId: true, contentHash: true },
      });
      const dbSig = dbDocs.map((d) => `${d.docId}:${d.contentHash}`).sort().join('|');
      if (diskSig !== dbSig) {
        await syncSystemKnowledgeBase();
      }
      lastVerifiedKbSignature = diskSig;
    }

    allChunks = await prisma.systemKnowledgeChunk.findMany();
    if (allChunks.length === 0) {
      await syncSystemKnowledgeBase();
      allChunks = await prisma.systemKnowledgeChunk.findMany();
    }
  } else {
    const diskDocs = await loadKnowledgeDocumentsFromDisk();
    allChunks = diskDocs.flatMap((d) =>
      d.chunks.map((c) => ({
        id: `${c.docId}:${c.chunkIndex}`,
        docId: c.docId,
        module: c.module,
        sectionPath: c.sectionPath,
        screensJson: JSON.stringify(c.screens),
        relatedToolsJson: JSON.stringify(c.relatedTools),
        tagsJson: JSON.stringify(c.tags),
        contentText: c.contentText,
        embeddingJson: JSON.stringify(computeDeterministicFinancialEmbedding(c.contentText)),
        embeddingModel: 'financial-semantic-v1',
      }))
    );
  }

  if (allChunks.length === 0) {
    return { chunks: [], totalIndexedChunks: 0, embeddingModelUsed: 'none' };
  }

  const queryModel = 'financial-semantic-v1';
  const queryVector = computeDeterministicFinancialEmbedding(query);
  const localQueryVec = queryVector;
  const queryTokens = normalizeTokens(query);

  const scored: RetrievedSystemKnowledgeChunk[] = allChunks.map((chunk) => {
    let vec: number[] = [];
    try {
      vec = JSON.parse(chunk.embeddingJson);
    } catch {
      vec = [];
    }

    let semanticSim = 0;
    if (vec.length === queryVector.length && chunk.embeddingModel === queryModel) {
      semanticSim = Math.max(0, cosineSimilarity(queryVector, vec));
    } else {
      const localChunkVec = computeDeterministicFinancialEmbedding(chunk.contentText);
      semanticSim = Math.max(0, cosineSimilarity(localQueryVec, localChunkVec));
    }

    const tags = safeParseStringArray(chunk.tagsJson);
    const screens = safeParseStringArray(chunk.screensJson);
    const relatedTools = safeParseStringArray(chunk.relatedToolsJson);

    const searchable = `${chunk.sectionPath} ${tags.join(' ')} ${chunk.contentText}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    let hits = 0;
    for (const tok of queryTokens) {
      if (searchable.includes(tok)) hits += 1;
    }
    const lexicalScore = queryTokens.length > 0 ? hits / queryTokens.length : 0;

    let contextBoost = 0;
    if (activeTab && (chunk.module === activeTab || screens.includes(activeTab))) {
      contextBoost += 0.12;
    }

    const score = Number((semanticSim * 0.5 + lexicalScore * 0.38 + contextBoost).toFixed(4));

    return {
      id: chunk.id,
      docId: chunk.docId,
      module: chunk.module,
      sectionPath: chunk.sectionPath,
      screens,
      relatedTools,
      contentText: sanitizeRetrievedContentAgainstPromptInjection(chunk.contentText),
      score,
      embeddingModel: chunk.embeddingModel,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return {
    chunks: scored.slice(0, topK),
    totalIndexedChunks: allChunks.length,
    embeddingModelUsed: queryModel,
  };
}

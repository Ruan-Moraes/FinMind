import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/shared/lib/prisma';
import { generateEmbeddingsBatch } from '@/features/ai-copilot/rag/embedding-gateway';
import {
  parseKnowledgeMarkdown,
  type ParsedKnowledgeDocument,
} from '@/features/ai-agent/knowledge/markdown-chunker';

export const DEFAULT_KB_DIR = path.join(process.cwd(), 'docs', 'knowledge');

export async function loadKnowledgeDocumentsFromDisk(
  kbDir: string = DEFAULT_KB_DIR
): Promise<ParsedKnowledgeDocument[]> {
  const entries = await fs.readdir(kbDir);
  const mdFiles = entries.filter((f) => f.endsWith('.md')).sort();
  const docs: ParsedKnowledgeDocument[] = [];

  for (const file of mdFiles) {
    const absPath = path.join(kbDir, file);
    const raw = await fs.readFile(absPath, 'utf8');
    docs.push(parseKnowledgeMarkdown(raw, `docs/knowledge/${file}`));
  }
  return docs;
}

export async function syncSystemKnowledgeBase(params?: {
  kbDir?: string;
  userKeys?: { openaiApiKey?: string | null; geminiApiKey?: string | null };
}): Promise<{
  totalDocs: number;
  totalChunks: number;
  embeddedChunks: number;
  removedDocs: number;
  embeddingModel: string;
}> {
  const docs = await loadKnowledgeDocumentsFromDisk(params?.kbDir || DEFAULT_KB_DIR);
  const activeDocIds = new Set(docs.map((d) => d.frontmatter.docId));

  const existingDocs = await prisma.systemKnowledgeDocument.findMany({
    include: { chunks: true },
  });

  let removedDocs = 0;
  for (const existing of existingDocs) {
    if (!activeDocIds.has(existing.docId)) {
      await prisma.systemKnowledgeDocument.delete({ where: { id: existing.id } });
      removedDocs += 1;
    }
  }

  const existingChunksByKey = new Map<string, string>();
  for (const d of existingDocs) {
    for (const c of d.chunks) {
      existingChunksByKey.set(`${c.docId}::${c.chunkIndex}`, c.contentHash);
    }
  }

  const chunksToEmbed: Array<{
    docId: string;
    chunkIndex: number;
    text: string;
  }> = [];

  for (const doc of docs) {
    for (const chunk of doc.chunks) {
      const prevHash = existingChunksByKey.get(`${chunk.docId}::${chunk.chunkIndex}`);
      if (prevHash !== chunk.contentHash) {
        chunksToEmbed.push({
          docId: chunk.docId,
          chunkIndex: chunk.chunkIndex,
          text: chunk.contentText,
        });
      }
    }
  }

  const embeddingMap = new Map<string, { vector: number[]; model: string }>();
  let embeddingModel = 'cached';

  for (let i = 0; i < chunksToEmbed.length; i += 48) {
    const batch = chunksToEmbed.slice(i, i + 48);
    const embRes = await generateEmbeddingsBatch(
      batch.map((b) => b.text),
      params?.userKeys
    );
    embeddingModel = embRes.model;
    batch.forEach((item, idx) => {
      embeddingMap.set(`${item.docId}::${item.chunkIndex}`, {
        vector: embRes.vectors[idx] || [],
        model: embRes.model,
      });
    });
  }

  let totalChunks = 0;
  for (const doc of docs) {
    const upsertedDoc = await prisma.systemKnowledgeDocument.upsert({
      where: { docId: doc.frontmatter.docId },
      create: {
        docId: doc.frontmatter.docId,
        filePath: doc.filePath,
        module: doc.frontmatter.module,
        version: doc.frontmatter.version,
        contentHash: doc.contentHash,
        chunkCount: doc.chunks.length,
        indexedAt: new Date(),
      },
      update: {
        filePath: doc.filePath,
        module: doc.frontmatter.module,
        version: doc.frontmatter.version,
        contentHash: doc.contentHash,
        chunkCount: doc.chunks.length,
        indexedAt: new Date(),
      },
    });

    await prisma.systemKnowledgeChunk.deleteMany({
      where: {
        docId: doc.frontmatter.docId,
        chunkIndex: { gte: doc.chunks.length },
      },
    });

    for (const chunk of doc.chunks) {
      totalChunks += 1;
      const emb = embeddingMap.get(`${chunk.docId}::${chunk.chunkIndex}`);
      if (!emb) continue;
      await prisma.systemKnowledgeChunk.upsert({
        where: {
          docId_chunkIndex: { docId: chunk.docId, chunkIndex: chunk.chunkIndex },
        },
        create: {
          documentId: upsertedDoc.id,
          docId: chunk.docId,
          chunkIndex: chunk.chunkIndex,
          module: chunk.module,
          sectionPath: chunk.sectionPath,
          screensJson: JSON.stringify(chunk.screens),
          relatedToolsJson: JSON.stringify(chunk.relatedTools),
          tagsJson: JSON.stringify(chunk.tags),
          contentText: chunk.contentText,
          contentHash: chunk.contentHash,
          embeddingJson: JSON.stringify(emb.vector),
          embeddingModel: emb.model,
        },
        update: {
          documentId: upsertedDoc.id,
          module: chunk.module,
          sectionPath: chunk.sectionPath,
          screensJson: JSON.stringify(chunk.screens),
          relatedToolsJson: JSON.stringify(chunk.relatedTools),
          tagsJson: JSON.stringify(chunk.tags),
          contentText: chunk.contentText,
          contentHash: chunk.contentHash,
          embeddingJson: JSON.stringify(emb.vector),
          embeddingModel: emb.model,
        },
      });
    }
  }

  return {
    totalDocs: docs.length,
    totalChunks,
    embeddedChunks: chunksToEmbed.length,
    removedDocs,
    embeddingModel,
  };
}

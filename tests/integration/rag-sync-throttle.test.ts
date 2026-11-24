import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { syncUserFinancialKnowledge } from '@/features/ai-copilot/rag';
import { ensureFreshUserFinancialKnowledge } from '@/features/ai-copilot/rag/knowledge-sync';

describe('RAG: sincronização limitada nas consultas', () => {
  let userId = '';
  afterAll(async () => {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('consulta não relê o banco dentro da janela; mutação (sync direto) e janela expirada reindexam', async () => {
    const user = await prisma.user.create({ data: { email: `rag-throttle-${Date.now()}@finmind.test`, name: 'T', passwordHash: 'h' } });
    userId = user.id;
    const mk = (description: string) =>
      prisma.transaction.create({ data: { userId, type: 'EXPENSE', nature: 'VARIABLE', amountInCents: 1000, date: new Date('2026-11-05T12:00:00Z'), description } });
    const count = () => prisma.financialKnowledgeChunk.count({ where: { userId } });

    await mk('Primeira');
    await syncUserFinancialKnowledge(userId);
    expect(await count()).toBe(1);

    await mk('Segunda (escrita fora do fluxo de sync)');
    await ensureFreshUserFinancialKnowledge(userId); // dentro da janela: não reindexa
    expect(await count()).toBe(1);

    await ensureFreshUserFinancialKnowledge(userId, undefined, 0); // janela expirada: reindexa
    expect(await count()).toBe(2);

    await mk('Terceira');
    await syncUserFinancialKnowledge(userId); // mutação sincroniza direto
    expect(await count()).toBe(3);
  });
});

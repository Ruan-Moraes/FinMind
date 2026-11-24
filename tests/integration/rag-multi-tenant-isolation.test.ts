import { describe, it, expect } from 'vitest';
import assert from 'node:assert/strict';
import { prisma } from '@/shared/lib/prisma';
import { getSixMonthsHistory } from '@/features/analytics';
import { syncUserFinancialKnowledge, retrieveFinancialContextForQuery } from '@/features/ai-copilot/rag';
import { executeContextualFinancialAssistant } from '@/features/ai-copilot/assistant';

describe('Integração DB & RAG — Cenários 23, 24 e 25: Indexação Incremental, Isolamento Multi-Usuário e Assistente', () => {
  it('indexa entidades financeiras, garante isolamento estrito entre userId A e B e sintetiza respostas ancoradas', async () => {
  const ragUserA = await prisma.user.upsert({
    where: { email: 'rag-user-a@finmind.local' },
    create: {
      email: 'rag-user-a@finmind.local',
      name: 'Usuário RAG A',
      passwordHash: 'hash-a',
    },
    update: {},
  });

  const ragUserB = await prisma.user.upsert({
    where: { email: 'rag-user-b@finmind.local' },
    create: {
      email: 'rag-user-b@finmind.local',
      name: 'Usuário RAG B',
      passwordHash: 'hash-b',
    },
    update: {},
  });

  await prisma.financialKnowledgeChunk.deleteMany({
    where: { userId: { in: [ragUserA.id, ragUserB.id] } },
  });
  await prisma.transaction.deleteMany({
    where: { userId: { in: [ragUserA.id, ragUserB.id] } },
  });
  await prisma.portfolioGoal.deleteMany({
    where: { userId: { in: [ragUserA.id, ragUserB.id] } },
  });
  await prisma.account.deleteMany({
    where: { userId: { in: [ragUserA.id, ragUserB.id] } },
  });

  const accA = await prisma.account.create({
    data: {
      userId: ragUserA.id,
      name: 'Conta Principal A',
      type: 'CHECKING',
      initialBalanceInCents: 500000, // R$ 5.000,00
    },
  });

  await prisma.transaction.create({
    data: {
      userId: ragUserA.id,
      type: 'EXPENSE',
      nature: 'STATIC',
      amountInCents: 41233,
      date: new Date('2026-11-10T12:00:00'),
      description: 'Mensalidade Faculdade Uninter',
      counterparty: 'UNINTER EDUCACIONAL S A',
      paymentMethod: 'PIX',
      purpose: 'Educação e Faculdade',
      status: 'COMPLETED',
      sourceAccountId: accA.id,
    },
  });

  await prisma.portfolioGoal.create({
    data: {
      userId: ragUserA.id,
      title: 'Reserva Patrimonial de R$ 10.000',
      targetAmountInCents: 1000000,
      targetMonth: 12,
      targetYear: 2027,
    },
  });

  await prisma.recurrenceRule.create({
    data: {
      userId: ragUserA.id,
      description: 'Assinatura Internet Fibra',
      type: 'EXPENSE',
      nature: 'STATIC',
      amountInCents: 12000,
      dayOfMonth: 12,
      accountId: accA.id,
    },
  });

  // 1ª Sincronização RAG para Usuário A
  const sync1 = await syncUserFinancialKnowledge(ragUserA.id);
  assert.ok(sync1.upsertedCount >= 3, 'Deve indexar transações, meta de carteira e resumo mensal');

  // 2ª Sincronização idempotente (contentHash inalterado -> 0 reindexações desnecessárias)
  const sync2 = await syncUserFinancialKnowledge(ragUserA.id);
  assert.equal(sync2.upsertedCount, 0, 'Sincronização incremental por contentHash deve evitar duplicidades e reprocessamento');
  assert.ok(sync2.totalActiveChunks >= 3);

  // Recuperação RAG para Usuário A
  const ragCtxA = await retrieveFinancialContextForQuery({
    userId: ragUserA.id,
    query: 'Quanto gastei com faculdade Uninter e como está minha meta de reserva?',
    topK: 5,
  });
  assert.ok(ragCtxA.chunks.length > 0, 'Usuário A deve recuperar seus próprios chunks financeiros');
  assert.ok(
    ragCtxA.chunks.some((c) => c.contentText.includes('Uninter')),
    'Busca semântica deve recuperar o lançamento da Uninter'
  );

  // Isolamento Multi-usuário: Usuário B buscando "Uninter" NUNCA deve receber dados do Usuário A
  const ragCtxB = await retrieveFinancialContextForQuery({
    userId: ragUserB.id,
    query: 'Quanto gastei com faculdade Uninter?',
    topK: 5,
  });
  assert.equal(
    ragCtxB.chunks.some((c) => c.contentText.includes('Uninter')),
    false,
    'ISOLAMENTO CRÍTICO: Usuário B jamais pode recuperar chunks do Usuário A'
  );

  // Assistente Financeiro Contextualizado para Usuário A
  const assistantResp = await executeContextualFinancialAssistant({
    userId: ragUserA.id,
    question: 'Quais foram meus gastos com educação e quanto falta para atingir minha meta?',
    referenceMonth: 11,
    referenceYear: 2026,
  });

  assert.equal(assistantResp.ok, true);
  assert.equal(assistantResp.hasSufficientData, true);
  assert.ok(assistantResp.directAnswer.length > 20);
  assert.ok(assistantResp.historicalFacts.length > 0, 'Deve listar fatos históricos reais');
  assert.ok(assistantResp.calculatedResults.length > 0, 'Deve listar cálculos determinísticos');
  assert.ok(
    assistantResp.projectionsAndEstimates.some((p) => p.toLowerCase().includes('projeção') || p.toLowerCase().includes('estimativa')),
    'Projeções devem ser explicitamente rotuladas como estimativas não garantidas'
  );
  assert.ok(assistantResp.personalizedRecommendations.length > 0);
  assert.ok(assistantResp.retrievedSources.length > 0);

  // Consulta consolidada de 6 meses (1 única query no banco)
  const history6m = await getSixMonthsHistory(ragUserA.id, 11, 2026, 1);
  assert.equal(history6m.length, 6);

  // Limpa usuários de teste RAG
  await prisma.user.deleteMany({
    where: { id: { in: [ragUserA.id, ragUserB.id] } },
  });

    expect(assistantResp.ok).toBe(true);
  });
});
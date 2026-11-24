import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { composeAgentTurnFromTools } from '@/features/ai-agent/services/agent-tool-plan-builder';
import { getMutationToolExecutor } from '@/features/ai-agent/tools/tool-dispatcher';

describe('Integração: Agente IA — Cadastro de Categorias, Classificação e Execução em Lote (Batch + Rollback)', () => {
  let userId = '';

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Batch Agent User',
        email: `batch-agent-${Date.now()}@finmind.local`,
        passwordHash: 'hash',
        settings: { create: { fiscalMonthStartDay: 1 } },
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('agrupa múltiplas categorias, regras fixas e classificação de lançamentos em 1 único Plano em Lote com verificação e rollback completo', async () => {
    const acc = await prisma.account.create({
      data: { userId, name: 'Conta Principal', type: 'CHECKING', initialBalanceInCents: 100000 },
    });
    const tx1 = await prisma.transaction.create({
      data: {
        userId,
        sourceAccountId: acc.id,
        type: 'EXPENSE',
        nature: 'VARIABLE',
        description: 'PIX iFood Restaurante',
        amountInCents: 4590,
        date: new Date(Date.UTC(2026, 10, 10)),
        status: 'COMPLETED',
      },
    });
    const tx2 = await prisma.transaction.create({
      data: {
        userId,
        sourceAccountId: acc.id,
        type: 'EXPENSE',
        nature: 'STATIC',
        description: 'Uninter Faculdade Mensalidade',
        amountInCents: 38354,
        date: new Date(Date.UTC(2026, 10, 6)),
        status: 'COMPLETED',
      },
    });

    const turn = await composeAgentTurnFromTools({
      userId,
      sessionId: null,
      runId: 'run-batch-test-1',
      executionMode: 'LIVE_AGENT_TOOLS',
      providerLabel: 'OPENAI',
      modelLabel: 'GPT 6.1 Terra',
      systemSources: [],
      apiWarning: null,
      interactionMode: 'VISUAL',
      actionTools: [
        { name: 'upsert_category', args: { name: 'Alimentação & Delivery', type: 'EXPENSE', defaultNature: 'VARIABLE' } },
        { name: 'upsert_category', args: { name: 'Salário & Renda', type: 'INCOME', defaultNature: 'STATIC' } },
        { name: 'upsert_static_rule', args: { description: 'Salário', type: 'INCOME', amountBRL: 1970, dayOfMonth: 5, dayType: 'BUSINESS_DAY' } },
        { name: 'upsert_static_rule', args: { description: 'Assinatura OpenAI', type: 'EXPENSE', amountBRL: 110, dayOfMonth: 15, dayType: 'CALENDAR_DAY' } },
        { name: 'categorize_transactions', args: { categoryName: 'Alimentação & Delivery', categoryType: 'EXPENSE', descriptionContains: 'iFood' } },
      ],
      contentBlocks: [],
      llmNarrative: '',
    });

    expect(turn.pendingMutation).toBeTruthy();
    expect(turn.pendingMutation?.toolName).toBe('batch_mutations');
    expect(turn.pendingMutation?.title).toBe('Plano em Lote (5 ações)');
    expect(turn.pendingMutation?.reversible).toBe(true);

    const batchExecutor = getMutationToolExecutor('batch_mutations')!;
    const execRes = await batchExecutor.executeAndVerify(userId, turn.pendingMutation!.params);
    expect(execRes.ok).toBe(true);
    expect(execRes.verified).toBe(true);
    expect(execRes.summary).toContain('5/5');

    const cats = await prisma.category.findMany({ where: { userId } });
    expect(cats.some((c) => c.name === 'Alimentação & Delivery' && c.type === 'EXPENSE')).toBe(true);
    expect(cats.some((c) => c.name === 'Salário & Renda' && c.type === 'INCOME')).toBe(true);

    const rules = await prisma.recurrenceRule.findMany({ where: { userId } });
    expect(rules).toHaveLength(2);
    expect(rules.some((r) => r.description === 'Salário' && r.dayType === 'BUSINESS_DAY')).toBe(true);
    expect(rules.some((r) => r.description === 'Assinatura OpenAI' && r.amountInCents === 11000)).toBe(true);

    const refreshedTx1 = await prisma.transaction.findUnique({ where: { id: tx1.id } });
    const refreshedTx2 = await prisma.transaction.findUnique({ where: { id: tx2.id } });
    expect(refreshedTx1?.categoryId).toBeTruthy();
    expect(refreshedTx2?.categoryId).toBeNull();

    const undoRes = await batchExecutor.rollback!(userId, null, execRes.afterState);
    expect(undoRes.ok).toBe(true);
    expect(undoRes.summary).toContain('5/5');

    expect(await prisma.category.count({ where: { userId } })).toBe(0);
    expect(await prisma.recurrenceRule.count({ where: { userId } })).toBe(0);
    const undoneTx1 = await prisma.transaction.findUnique({ where: { id: tx1.id } });
    expect(undoneTx1?.categoryId).toBeNull();
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { getMutationToolExecutor } from '@/features/ai-agent/tools/tool-dispatcher';
import { executeReadAnalyticsTool, loadAnalyticsExecutionContext } from '@/features/ai-agent/tools/tool-executors-analytics';

const run = async (userId: string, tool: string, args: Record<string, unknown>) => {
  const ex = getMutationToolExecutor(tool)!;
  const preview = await ex.preparePreview(userId, args);
  const res = await ex.executeAndVerify(userId, preview.normalizedParams);
  return { ex, preview, res };
};

describe('Integração: correções da auditoria do Agente IA', () => {
  let userId = '';
  let accId = '';
  let cardId = '';

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `agent-audit-${Date.now()}@finmind.test`, name: 'Agent Audit', passwordHash: 'hash' },
    });
    userId = user.id;
    accId = (await prisma.account.create({ data: { userId, name: 'Itaú', type: 'SAVINGS', initialBalanceInCents: 500000 } })).id;
    cardId = (await prisma.creditCard.create({ data: { userId, name: 'Visa Platinum', brand: 'Visa', limitInCents: 500000, closingDay: 3, dueDay: 10 } })).id;
    await prisma.category.create({ data: { userId, name: 'Lazer', type: 'EXPENSE', defaultNature: 'VARIABLE', color: '#f43f5e', icon: 'Sparkles' } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('upsert_static_rule: editar só o valor mantém dia, tipo de dia e cartão vinculado', async () => {
    const rule = await prisma.recurrenceRule.create({
      data: {
        userId, description: 'Spotify', type: 'EXPENSE', nature: 'STATIC', amountInCents: 2190,
        dayOfMonth: 12, dayType: 'BUSINESS_DAY', includeSaturday: true, creditCardId: cardId,
      },
    });
    const { ex, preview, res } = await run(userId, 'upsert_static_rule', { matchDescription: 'Spotify', amountBRL: 34.9 });
    expect(res.ok).toBe(true);
    const row = await prisma.recurrenceRule.findUnique({ where: { id: rule.id } });
    expect(row).toMatchObject({ amountInCents: 3490, dayOfMonth: 12, dayType: 'BUSINESS_DAY', includeSaturday: true, creditCardId: cardId });

    const undo = await ex.rollback!(userId, preview.beforeState, res.afterState);
    expect(undo.ok).toBe(true);
    expect((await prisma.recurrenceRule.findUnique({ where: { id: rule.id } }))?.amountInCents).toBe(2190);
  });

  it('upsert_static_rule: cria custo fixo no cartão e desvincula com removeCard', async () => {
    const created = await run(userId, 'upsert_static_rule', { description: 'Netflix', type: 'EXPENSE', amountBRL: 55.9, cardName: 'Visa' });
    expect(created.res.ok).toBe(true);
    const row = await prisma.recurrenceRule.findFirst({ where: { userId, description: 'Netflix' } });
    expect(row?.creditCardId).toBe(cardId);
    expect(row?.dayOfMonth).toBe(5);

    const unlinked = await run(userId, 'upsert_static_rule', { matchDescription: 'Netflix', removeCard: true });
    expect(unlinked.res.ok).toBe(true);
    expect((await prisma.recurrenceRule.findFirst({ where: { userId, description: 'Netflix' } }))?.creditCardId).toBeNull();

    const ex = getMutationToolExecutor('upsert_static_rule')!;
    await expect(ex.preparePreview(userId, { description: 'Salário', type: 'INCOME', amountBRL: 5000, cardName: 'Visa' })).rejects.toThrow(/Somente custos fixos/);
    await expect(ex.preparePreview(userId, { description: 'Sem valor', type: 'EXPENSE' })).rejects.toThrow(/faltam: amountBRL/);
  });

  it('upsert_credit_card: editar só o limite mantém bandeira e dias', async () => {
    const { res } = await run(userId, 'upsert_credit_card', { matchName: 'Visa', name: 'Visa Platinum', limitBRL: 8000 });
    expect(res.ok).toBe(true);
    const card = await prisma.creditCard.findUnique({ where: { id: cardId } });
    expect(card).toMatchObject({ brand: 'Visa', limitInCents: 800000, closingDay: 3, dueDay: 10 });
  });

  it('upsert_account: renomear não transforma poupança em conta corrente', async () => {
    const { res } = await run(userId, 'upsert_account', { matchName: 'Itaú', name: 'Itaú Reserva' });
    expect(res.ok).toBe(true);
    const acc = await prisma.account.findUnique({ where: { id: accId } });
    expect(acc).toMatchObject({ name: 'Itaú Reserva', type: 'SAVINGS' });
  });

  it('metas: edição parcial mantém prazo e exclusão ambígua é recusada', async () => {
    await prisma.portfolioGoal.create({ data: { userId, title: 'Viagem Europa', targetAmountInCents: 1000000, targetMonth: 7, targetYear: 2027 } });
    await prisma.portfolioGoal.create({ data: { userId, title: 'Viagem Japão', targetAmountInCents: 2000000, targetMonth: 3, targetYear: 2028 } });
    const { res } = await run(userId, 'upsert_portfolio_goal', { matchTitle: 'Europa', targetAmountBRL: 12000 });
    expect(res.ok).toBe(true);
    const goal = await prisma.portfolioGoal.findFirst({ where: { userId, title: 'Viagem Europa' } });
    expect(goal).toMatchObject({ targetAmountInCents: 1200000, targetMonth: 7, targetYear: 2027 });

    await expect(getMutationToolExecutor('delete_portfolio_goal')!.preparePreview(userId, { matchTitle: 'Viagem' })).rejects.toThrow(/mais de um/);
    await expect(getMutationToolExecutor('upsert_portfolio_goal')!.preparePreview(userId, { title: 'Nova', targetAmountBRL: 10 })).rejects.toThrow(/faltam/);
  });

  it('delete_transaction: excluir 1 parcela avisa e o Desfazer devolve à compra original', async () => {
    const created = await run(userId, 'create_transaction', {
      type: 'EXPENSE', description: 'Notebook', amountBRL: 3000, date: '2026-11-05', cardName: 'Visa', installments: 3,
    });
    expect(created.res.ok).toBe(true);
    const parcels = await prisma.transaction.findMany({ where: { userId, description: { contains: 'Notebook' } }, orderBy: { date: 'asc' } });
    expect(parcels).toHaveLength(3);
    const groupId = parcels[0].installmentGroupId;

    const del = await run(userId, 'delete_transaction', { transactionId: parcels[1].id });
    expect(del.preview.summary).toMatch(/SOMENTE a parcela/);
    expect(del.res.ok).toBe(true);

    const undo = await del.ex.rollback!(userId, del.preview.beforeState, del.res.afterState);
    expect(undo.ok).toBe(true);
    const after = await prisma.transaction.findMany({ where: { userId, description: { contains: 'Notebook' } } });
    expect(after).toHaveLength(3);
    expect(new Set(after.map((t) => t.installmentGroupId))).toEqual(new Set([groupId]));
  });

  it('update/delete_transaction: localiza lançamento antigo fora dos 300 mais recentes', async () => {
    await prisma.transaction.create({ data: { userId, type: 'EXPENSE', amountInCents: 1234, date: new Date('2020-01-15T12:00:00Z'), description: 'Assinatura Antiga Única', sourceAccountId: accId } });
    await prisma.transaction.createMany({
      data: Array.from({ length: 320 }, (_, i) => ({
        userId, type: 'EXPENSE', amountInCents: 100 + i, date: new Date(`2026-10-${String((i % 27) + 1).padStart(2, '0')}T12:00:00Z`),
        description: `Padaria ${i}`, sourceAccountId: accId,
      })),
    });
    const preview = await getMutationToolExecutor('update_transaction')!.preparePreview(userId, { matchDescription: 'Assinatura Antiga', amountBRL: 20 });
    expect(preview.title).toMatch(/Assinatura Antiga Única/);
  });

  it('categorize_transactions: filtra no banco, respeita o tipo, avisa categoria nova, aprende e desfaz tudo', async () => {
    // 320 "Padaria N" de despesa já existem (teste anterior); uma receita com o mesmo texto não pode ser categorizada.
    await prisma.transaction.create({ data: { userId, type: 'INCOME', amountInCents: 999, date: new Date('2026-10-02T12:00:00Z'), description: 'Padaria reembolso', destinationAccountId: accId } });
    const { ex, preview, res } = await run(userId, 'categorize_transactions', { categoryName: 'Padaria & Café', descriptionContains: 'padaria' });
    expect(preview.summary).toMatch(/categoria NOVA/);
    expect(preview.title).toMatch(/320 lançamento/);
    expect(res.ok).toBe(true);
    const after = res.afterState as { createdCategoryId: string; memory: unknown[] };
    expect(after.createdCategoryId).toBeTruthy();
    expect(after.memory.length).toBeGreaterThan(0);
    const income = await prisma.transaction.findFirst({ where: { userId, description: 'Padaria reembolso' } });
    expect(income?.categoryId).toBeNull();

    const undo = await ex.rollback!(userId, preview.beforeState, res.afterState);
    expect(undo.ok).toBe(true);
    expect(await prisma.category.findFirst({ where: { id: after.createdCategoryId } })).toBeNull();
    expect(await prisma.transaction.count({ where: { userId, categoryId: after.createdCategoryId } })).toBe(0);
    expect(await prisma.reconciliationMemoryRule.count({ where: { userId, categoryId: after.createdCategoryId } })).toBe(0);
  });

  it('delete_category: mostra o impacto e o Desfazer religa lançamentos e limites', async () => {
    const cat = await prisma.category.findFirst({ where: { userId, name: 'Lazer' } });
    const tx = await prisma.transaction.create({ data: { userId, type: 'EXPENSE', amountInCents: 5000, date: new Date('2026-11-08T12:00:00Z'), description: 'Cinema', sourceAccountId: accId, categoryId: cat!.id } });
    await prisma.budget.create({ data: { userId, categoryId: cat!.id, month: 11, year: 2026, maxAmountInCents: 30000 } });

    const { ex, preview, res } = await run(userId, 'delete_category', { categoryName: 'Lazer' });
    expect(preview.summary).toMatch(/1 lançamento/);
    expect(res.ok).toBe(true);
    expect((await prisma.transaction.findUnique({ where: { id: tx.id } }))?.categoryId).toBeNull();

    const undo = await ex.rollback!(userId, preview.beforeState, res.afterState);
    expect(undo.ok).toBe(true);
    const restored = await prisma.category.findFirst({ where: { userId, name: 'Lazer' } });
    expect((await prisma.transaction.findUnique({ where: { id: tx.id } }))?.categoryId).toBe(restored!.id);
    expect(await prisma.budget.count({ where: { userId, categoryId: restored!.id } })).toBe(1);
  });

  it('upsert_value_forecast: edita por matchTitle e recusa duplicata', async () => {
    const created = await run(userId, 'upsert_value_forecast', { title: '13º salário', type: 'INCOME', amountBRL: 4000, expectedDate: '2026-12-20' });
    expect(created.res.ok).toBe(true);
    await expect(
      getMutationToolExecutor('upsert_value_forecast')!.preparePreview(userId, { title: '13º Salário', type: 'INCOME', amountBRL: 1, expectedDate: '2026-12-20' })
    ).rejects.toThrow(/Já existe a previsão/);
    const edited = await run(userId, 'upsert_value_forecast', { matchTitle: '13º', amountBRL: 4500 });
    expect(edited.res.ok).toBe(true);
    const items = await prisma.valueForecastItem.findMany({ where: { userId } });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ amountInCents: 450000, type: 'INCOME' });
    expect(items[0].expectedDate.toISOString().slice(0, 10)).toBe('2026-12-20');
  });

  it('delete_balance_target: exclui e restaura meta de saldo; edição parcial mantém a data', async () => {
    await run(userId, 'upsert_balance_target', { title: 'Reserva 2027', plannedBalanceBRL: 10000, targetDate: '2027-06-30', notes: 'emergência' });
    const edited = await run(userId, 'upsert_balance_target', { matchTitle: 'Reserva 2027', plannedBalanceBRL: 15000 });
    const row = await prisma.balanceTargetCheck.findFirst({ where: { userId, title: 'Reserva 2027' } });
    expect(edited.res.ok).toBe(true);
    expect(row?.targetDate.toISOString().slice(0, 10)).toBe('2027-06-30');
    expect(row?.notes).toBe('emergência');

    const del = await run(userId, 'delete_balance_target', { matchTitle: 'Reserva' });
    expect(del.res.ok).toBe(true);
    expect(await prisma.balanceTargetCheck.count({ where: { userId } })).toBe(0);
    await del.ex.rollback!(userId, del.preview.beforeState, del.res.afterState);
    expect(await prisma.balanceTargetCheck.count({ where: { userId } })).toBe(1);
  });

  it('batch_mutations: lote parcial retorna ok=true/verified=false com afterState para desfazer', async () => {
    const goodPreview = await getMutationToolExecutor('upsert_category')!.preparePreview(userId, { name: 'Pets', type: 'EXPENSE' });
    const batch = getMutationToolExecutor('batch_mutations')!;
    const res = await batch.executeAndVerify(userId, {
      items: [
        { toolName: 'upsert_category', title: 'Pets', summary: '', params: goodPreview.normalizedParams, beforeState: goodPreview.beforeState },
        { toolName: 'delete_transaction', title: 'Inexistente', summary: '', params: { transactionId: 'nao-existe' }, beforeState: null },
      ],
    });
    expect(res.ok).toBe(true);
    expect(res.verified).toBe(false);
    const undo = await batch.rollback!(userId, null, res.afterState);
    expect(undo.ok).toBe(true);
    expect(await prisma.category.findFirst({ where: { userId, name: 'Pets' } })).toBeNull();
  });

  it('query_health_reports: lê os diagnósticos salvos', async () => {
    await prisma.aiAnalysisReport.create({
      data: { userId, provider: 'MOTOR_DETERMINISTICO', connectionMode: 'SMART_LOCAL', healthScore: 35, summary: 'Gastos acima da renda', risksJson: '["Cartão alto"]' },
    });
    const ctx = await loadAnalyticsExecutionContext(userId, 11, 2026);
    const data = (await executeReadAnalyticsTool('query_health_reports', {}, ctx)) as { reports: Array<{ healthScore: number; band: string; risks: string[] }> };
    expect(data.reports[0]).toMatchObject({ healthScore: 35, band: 'Crítico', risks: ['Cartão alto'] });
  });
});

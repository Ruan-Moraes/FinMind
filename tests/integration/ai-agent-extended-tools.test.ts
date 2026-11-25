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

describe('Integração: ferramentas estendidas do Agente IA', () => {
  let userId = '';
  let accId = '';

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `agent-ext-${Date.now()}@finmind.test`, name: 'Agent Ext', passwordHash: 'hash' },
    });
    userId = user.id;
    accId = (await prisma.account.create({ data: { userId, name: 'Nubank', type: 'CHECKING', initialBalanceInCents: 100000 } })).id;
    await prisma.account.create({ data: { userId, name: 'Reserva', type: 'SAVINGS', initialBalanceInCents: 0 } });
    await prisma.category.create({ data: { userId, name: 'Alimentação', type: 'EXPENSE', defaultNature: 'VARIABLE', color: '#f43f5e', icon: 'Utensils' } });
    await prisma.category.create({ data: { userId, name: 'Transporte', type: 'EXPENSE', defaultNature: 'VARIABLE', color: '#0ea5e9', icon: 'Car' } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('create_transaction: recusa conta inexistente e NÃO atribui categoria arbitrária', async () => {
    const ex = getMutationToolExecutor('create_transaction')!;
    await expect(
      ex.preparePreview(userId, { type: 'EXPENSE', description: 'Teste', amountBRL: 10, date: '2026-11-10', accountName: 'Banco Fantasma' })
    ).rejects.toThrow(/Não encontrei conta/);
    await expect(
      ex.preparePreview(userId, { type: 'EXPENSE', description: 'Teste', amountBRL: 10, date: '2026-11-10', accountName: 'Nubank', categoryName: 'Inexistente' })
    ).rejects.toThrow(/Não encontrei categoria/);

    const { res } = await run(userId, 'create_transaction', { type: 'EXPENSE', description: 'Xyz Sem Regra', amountBRL: 25.5, date: '2026-11-10', accountName: 'Nubank' });
    expect(res.ok).toBe(true);
    const tx = await prisma.transaction.findFirst({ where: { userId, description: 'Xyz Sem Regra' } });
    expect(tx?.categoryId).toBeNull();
    expect(tx?.sourceAccountId).toBe(accId);
  });

  it('create_transaction: exige conta explícita quando há várias e nenhuma padrão', async () => {
    const ex = getMutationToolExecutor('create_transaction')!;
    await expect(
      ex.preparePreview(userId, { type: 'EXPENSE', description: 'Sem conta', amountBRL: 10, date: '2026-11-10' })
    ).rejects.toThrow(/Em qual conta/);
  });

  it('create_transaction: transferência entre contas e rollback', async () => {
    const { ex, res } = await run(userId, 'create_transaction', {
      type: 'TRANSFER', description: 'Guardar', amountBRL: 100, date: '2026-11-11', accountName: 'Nubank', destinationAccountName: 'Reserva',
    });
    expect(res.ok).toBe(true);
    const tx = await prisma.transaction.findFirst({ where: { userId, description: 'Guardar' } });
    expect(tx?.destinationAccountId).toBeTruthy();
    const rb = await ex.rollback!(userId, { action: 'CREATE' }, res.afterState);
    expect(rb.ok).toBe(true);
    expect(await prisma.transaction.count({ where: { userId, description: 'Guardar' } })).toBe(0);
  });

  it('cartão parcelado + pagar fatura + desfazer pagamento', async () => {
    const card = await run(userId, 'upsert_credit_card', { name: 'Visa', brand: 'Visa', limitBRL: 5000, closingDay: 20, dueDay: 28 });
    expect(card.res.ok).toBe(true);
    const buy = await run(userId, 'create_transaction', {
      type: 'EXPENSE', description: 'Notebook', amountBRL: 300, date: '2026-11-05', cardName: 'Visa', installments: 3, categoryName: 'Alimentação',
    });
    expect(buy.res.ok).toBe(true);
    const rows = await prisma.transaction.findMany({ where: { userId, description: { contains: 'Notebook' } } });
    expect(rows.length).toBe(3);
    expect(rows.reduce((s, r) => s + r.amountInCents, 0)).toBe(30000);

    const invoices = (await executeReadAnalyticsTool('query_credit_card_invoices', { onlyUnpaid: true }, await loadAnalyticsExecutionContext(userId, 11, 2026))) as {
      cards: Array<{ invoices: Array<{ month: number; year: number; totalInCents: number }> }>;
    };
    const first = invoices.cards[0].invoices.find((i) => i.totalInCents > 0)!;
    expect(first).toBeTruthy();

    const pay = await run(userId, 'pay_credit_card_invoice', { cardName: 'Visa', month: first.month, year: first.year, accountName: 'Nubank' });
    expect(pay.res.ok).toBe(true);
    const inv = await prisma.creditCardInvoice.findFirst({ where: { creditCard: { userId }, month: first.month, year: first.year } });
    expect(inv?.status).toBe('PAID');
    await expect(
      getMutationToolExecutor('pay_credit_card_invoice')!.preparePreview(userId, { cardName: 'Visa', month: first.month, year: first.year, accountName: 'Nubank' })
    ).rejects.toThrow(/já está paga/);

    const rb = await pay.ex.rollback!(userId, pay.preview.beforeState, pay.res.afterState);
    expect(rb.ok).toBe(true);
    expect((await prisma.creditCardInvoice.findFirst({ where: { id: inv!.id } }))?.status).not.toBe('PAID');
  });

  it('update/delete_transaction: localiza, recusa ambiguidade, edita, exclui e restaura', async () => {
    await prisma.transaction.createMany({
      data: [
        { userId, type: 'EXPENSE', nature: 'VARIABLE', amountInCents: 1000, date: new Date('2026-11-01T12:00:00Z'), description: 'Padaria Sol', status: 'COMPLETED', sourceAccountId: accId },
        { userId, type: 'EXPENSE', nature: 'VARIABLE', amountInCents: 2000, date: new Date('2026-11-02T12:00:00Z'), description: 'Padaria Lua', status: 'COMPLETED', sourceAccountId: accId },
      ],
    });
    const upd = getMutationToolExecutor('update_transaction')!;
    await expect(upd.preparePreview(userId, { matchDescription: 'Padaria', categoryName: 'Alimentação' })).rejects.toThrow(/mais de um|possíveis/);

    const edited = await run(userId, 'update_transaction', { matchDescription: 'Padaria Sol', amountBRL: 12.5, categoryName: 'Alimentação' });
    expect(edited.res.ok).toBe(true);
    const row = await prisma.transaction.findFirst({ where: { userId, description: 'Padaria Sol' } });
    expect(row?.amountInCents).toBe(1250);
    expect(row?.categoryId).toBeTruthy();
    await edited.ex.rollback!(userId, edited.preview.beforeState, edited.res.afterState);
    expect((await prisma.transaction.findFirst({ where: { userId, description: 'Padaria Sol' } }))?.amountInCents).toBe(1000);

    const del = await run(userId, 'delete_transaction', { matchDescription: 'Padaria Lua' });
    expect(del.res.ok).toBe(true);
    expect(await prisma.transaction.count({ where: { userId, description: 'Padaria Lua' } })).toBe(0);
    await del.ex.rollback!(userId, del.preview.beforeState, del.res.afterState);
    expect(await prisma.transaction.count({ where: { userId, description: 'Padaria Lua' } })).toBe(1);
  });

  it('orçamentos: define, consulta consumo e remove', async () => {
    const set = await run(userId, 'upsert_budget', { categoryName: 'Alimentação', amountBRL: 20, month: 11, year: 2026 });
    expect(set.res.ok).toBe(true);
    const ctx = await loadAnalyticsExecutionContext(userId, 11, 2026);
    const out = (await executeReadAnalyticsTool('query_budgets', {}, ctx)) as { budgets: Array<{ category: string; limitInCents: number; status: string }> };
    expect(out.budgets[0]).toMatchObject({ category: 'Alimentação', limitInCents: 2000 });
    const del = await run(userId, 'delete_budget', { categoryName: 'Alimentação', month: 11, year: 2026 });
    expect(del.res.ok).toBe(true);
    expect(await prisma.budget.count({ where: { userId } })).toBe(0);
  });

  it('regras fixas: duplicata recusada, edição, pular mês e ajuste de valor', async () => {
    const created = await run(userId, 'upsert_static_rule', { description: 'Aluguel', type: 'EXPENSE', amountBRL: 1000, dayOfMonth: 5 });
    expect(created.res.ok).toBe(true);
    const ex = getMutationToolExecutor('upsert_static_rule')!;
    await expect(ex.preparePreview(userId, { description: 'aluguel', type: 'EXPENSE', amountBRL: 900 })).rejects.toThrow(/Já existe/);
    await expect(ex.preparePreview(userId, { description: 'X', type: 'EXPENSE', amountBRL: 9, dayType: 'BUSINESS_DAY', dayOfMonth: 28 })).rejects.toThrow();

    const edit = await run(userId, 'upsert_static_rule', { matchDescription: 'Aluguel', description: 'Aluguel', type: 'EXPENSE', amountBRL: 1100, dayOfMonth: 6 });
    expect(edit.res.ok).toBe(true);
    expect(await prisma.recurrenceRule.count({ where: { userId } })).toBe(1);

    const skip = await run(userId, 'set_static_rule_month', { matchDescription: 'Aluguel', month: 12, year: 2026, action: 'SKIP' });
    expect(skip.res.ok).toBe(true);
    const ov = await run(userId, 'set_static_rule_month', { matchDescription: 'Aluguel', month: 1, year: 2027, action: 'OVERRIDE', amountBRL: 900 });
    expect(ov.res.ok).toBe(true);
    const ctx = await loadAnalyticsExecutionContext(userId, 12, 2026);
    const dec = (await executeReadAnalyticsTool('query_static_rules', { month: 12, year: 2026 }, ctx)) as { rules: Array<{ skippedThisMonth: boolean }> };
    expect(dec.rules[0].skippedThisMonth).toBe(true);
    await skip.ex.rollback!(userId, skip.preview.beforeState, skip.res.afterState);
    const rule = await prisma.recurrenceRule.findFirst({ where: { userId } });
    expect(rule?.skippedMonths).toBe('[]');

    const del = await run(userId, 'delete_static_rule', { matchDescription: 'Aluguel' });
    expect(del.res.ok).toBe(true);
  });

  it('meta de carteira: alterar meta inexistente NÃO cria meta nova por engano', async () => {
    const ex = getMutationToolExecutor('upsert_portfolio_goal')!;
    await expect(
      ex.preparePreview(userId, { matchTitle: 'Viagem Marte', title: 'Viagem Marte', targetAmountBRL: 5000, targetMonth: 12, targetYear: 2027 })
    ).rejects.toThrow(/Não encontrei meta/);
  });

  it('previsão e meta de saldo: cria, edita e exclui', async () => {
    const f = await run(userId, 'upsert_value_forecast', { title: 'Bônus', type: 'INCOME', amountBRL: 500, expectedDate: '2026-12-20' });
    expect(f.res.ok).toBe(true);
    const bt = await run(userId, 'upsert_balance_target', { title: 'Reserva 5k', plannedBalanceBRL: 5000, targetDate: '2027-06-30' });
    expect(bt.res.ok).toBe(true);
    const btEdit = await run(userId, 'upsert_balance_target', { matchTitle: 'Reserva 5k', title: 'Reserva 6k', plannedBalanceBRL: 6000, targetDate: '2027-06-30' });
    expect(btEdit.res.ok).toBe(true);
    expect(await prisma.balanceTargetCheck.count({ where: { userId } })).toBe(1);
    const del = await run(userId, 'delete_value_forecast', { matchTitle: 'Bônus' });
    expect(del.res.ok).toBe(true);
    expect(await prisma.valueForecastItem.count({ where: { userId } })).toBe(0);
  });

  it('contas: cria, recusa duplicada e edita', async () => {
    const acc = await run(userId, 'upsert_account', { name: 'Carteira', type: 'CASH', initialBalanceBRL: 50 });
    expect(acc.res.ok).toBe(true);
    await expect(getMutationToolExecutor('upsert_account')!.preparePreview(userId, { name: 'carteira' })).rejects.toThrow(/Já existe/);
    const edit = await run(userId, 'upsert_account', { matchName: 'Carteira', name: 'Carteira Física', type: 'CASH' });
    expect(edit.res.ok).toBe(true);
  });
});

import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import {
  getAccountsWithBalances,
  getCreditCardsWithSummary,
  getPortfolioGoalsProgress,
  getStaticBaselineSummary,
  getMonthSummary,
} from '@/features/analytics';

const TEST_USER_EMAIL = 'test.goals.budgets.rules@finmind.local';

describe('Integração SQLite: Metas de Patrimônio, Orçamentos e Regras Recorrentes', () => {
  afterAll(async () => {
    const existing = await prisma.user.findUnique({ where: { email: TEST_USER_EMAIL } });
    if (existing) {
      await prisma.budget.deleteMany({ where: { userId: existing.id } });
      await prisma.portfolioGoal.deleteMany({ where: { userId: existing.id } });
      await prisma.recurrenceRule.deleteMany({ where: { userId: existing.id } });
      await prisma.transaction.deleteMany({ where: { userId: existing.id } });
      await prisma.account.deleteMany({ where: { userId: existing.id } });
      await prisma.category.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  });

  it('calcula progresso de metas (PortfolioGoal), baseline estático (RecurrenceRule) e consumo de orçamentos (Budget)', async () => {
    const existing = await prisma.user.findUnique({ where: { email: TEST_USER_EMAIL } });
    if (existing) {
      await prisma.budget.deleteMany({ where: { userId: existing.id } });
      await prisma.portfolioGoal.deleteMany({ where: { userId: existing.id } });
      await prisma.recurrenceRule.deleteMany({ where: { userId: existing.id } });
      await prisma.transaction.deleteMany({ where: { userId: existing.id } });
      await prisma.account.deleteMany({ where: { userId: existing.id } });
      await prisma.category.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    const user = await prisma.user.create({
      data: {
        email: TEST_USER_EMAIL,
        name: 'Ruan Moraes Teste',
        passwordHash: 'hash',
      },
    });

    const acc = await prisma.account.create({
      data: {
        userId: user.id,
        name: 'Reserva Nubank',
        type: 'SAVINGS',
        initialBalanceInCents: 2000000, // R$ 20.000,00
      },
    });

    const catFood = await prisma.category.create({
      data: {
        userId: user.id,
        name: 'Alimentação & Delivery',
        type: 'EXPENSE',
        defaultNature: 'VARIABLE',
        color: '#f59e0b',
      },
    });

    // 1. Criar Regras Recorrentes (Salário R$ 10.000 e Aluguel R$ 3.000 -> folga estática R$ 7.000)
    await prisma.recurrenceRule.createMany({
      data: [
        {
          userId: user.id,
          description: 'Salário Mensal',
          type: 'INCOME',
          nature: 'STATIC',
          amountInCents: 1000000,
          dayOfMonth: 5,
          accountId: acc.id,
          isActive: true,
        },
        {
          userId: user.id,
          description: 'Aluguel Apartamento',
          type: 'EXPENSE',
          nature: 'STATIC',
          amountInCents: 300000,
          dayOfMonth: 10,
          accountId: acc.id,
          isActive: true,
        },
      ],
    });

    // 2. Criar Meta de Patrimônio de R$ 50.000,00 para Dez/2027
    await prisma.portfolioGoal.create({
      data: {
        userId: user.id,
        title: 'Reserva de Emergência Completa',
        targetAmountInCents: 5000000,
        targetMonth: 12,
        targetYear: 2027,
      },
    });

    // 3. Criar Orçamento Mensal de R$ 1.000,00 em Alimentação e lançar despesa de R$ 650,00
    await prisma.budget.create({
      data: {
        userId: user.id,
        categoryId: catFood.id,
        month: 3,
        year: 2026,
        maxAmountInCents: 100000,
      },
    });

    await prisma.transaction.createMany({
      data: [
        {
          userId: user.id,
          type: 'INCOME',
          nature: 'STATIC',
          amountInCents: 1000000,
          date: new Date(2026, 2, 5, 12, 0, 0),
          description: 'Salário Mensal Recebido',
          status: 'COMPLETED',
          sourceAccountId: acc.id,
        },
        {
          userId: user.id,
          type: 'EXPENSE',
          nature: 'VARIABLE',
          amountInCents: 65000,
          date: new Date(2026, 2, 15, 12, 0, 0),
          description: 'Supermercado Mensal',
          status: 'COMPLETED',
          sourceAccountId: acc.id,
          categoryId: catFood.id,
        },
      ],
    });

    const summary = await getMonthSummary(user.id, 3, 2026, 1);
    expect(summary.variableExpenseInCents).toBe(65000);
    const foodCatBreakdown = summary.categoryBreakdown.find(
      (c) => c.categoryId === catFood.id
    );
    expect(foodCatBreakdown?.amountInCents).toBe(65000);

    const baseline = await getStaticBaselineSummary(user.id, summary);
    expect(baseline.staticIncomeInCents).toBe(1000000);
    expect(baseline.staticExpenseInCents).toBe(300000);
    expect(baseline.freeDiscretionaryIncomeInCents).toBe(700000);

    const [accounts, cards] = await Promise.all([
      getAccountsWithBalances(user.id),
      getCreditCardsWithSummary(user.id, 3, 2026),
    ]);
    const goalsProgress = await getPortfolioGoalsProgress(user.id, accounts, cards);
    expect(goalsProgress).toHaveLength(1);
    expect(goalsProgress[0].remainingDistanceInCents).toBe(2065000);
    expect(goalsProgress[0].progressPercent).toBeGreaterThan(55);
    expect(goalsProgress[0].willReachOnTime).toBe(true);
  });
});

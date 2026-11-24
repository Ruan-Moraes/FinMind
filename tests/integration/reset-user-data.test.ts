import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { resetAllFinancialDataForUser } from '@/features/auth/services/reset-user-data';
import { DEFAULT_CATEGORIES } from '@/features/planning/domain/default-categories';

const TEST_EMAIL = 'test.reset.user.vitest@finmind.local';

async function cleanupUser() {
  const u = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (!u) return;
  await prisma.transaction.deleteMany({ where: { userId: u.id } });
  await prisma.account.deleteMany({ where: { userId: u.id } });
  await prisma.category.deleteMany({ where: { userId: u.id } });
  await prisma.userSettings.deleteMany({ where: { userId: u.id } });
  await prisma.user.delete({ where: { id: u.id } });
}

describe('Integração SQLite: Reset Transacional de Dados Financeiros (resetAllFinancialDataForUser)', () => {
  afterAll(cleanupUser);

  it('bloqueia confirmação com nome inválido e limpa todas as entidades + recria DEFAULT_CATEGORIES quando confirmado', async () => {
    await cleanupUser();

    const user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Maria Silva Teste',
        passwordHash: 'hash',
        settings: { create: { theme: 'DARK', density: 'COMFORTABLE' } },
      },
    });

    const acc = await prisma.account.create({
      data: { userId: user.id, name: 'Conta Teste', type: 'CHECKING', initialBalanceInCents: 100000 },
    });
    await prisma.userSettings.update({
      where: { userId: user.id },
      data: { defaultAccountId: acc.id },
    });
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'EXPENSE',
        nature: 'VARIABLE',
        amountInCents: 5000,
        date: new Date(),
        description: 'Lanche',
        status: 'COMPLETED',
        sourceAccountId: acc.id,
      },
    });

    // 1. Confirmação incorreta NÃO apaga nada
    const denied = await resetAllFinancialDataForUser(
      { id: user.id, name: user.name },
      'Nome Errado'
    );
    expect(denied.ok).toBe(false);
    expect(await prisma.transaction.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(1);

    // 2. Modo VALUES_ONLY apaga lançamentos e zera saldo da conta, preservando categoria e meta
    const customCat = await prisma.category.create({
      data: { userId: user.id, name: 'Viagens Custom', type: 'EXPENSE', defaultNature: 'VARIABLE' },
    });
    const customGoal = await prisma.portfolioGoal.create({
      data: {
        userId: user.id,
        title: 'Reserva 2027',
        targetAmountInCents: 1000000,
        targetMonth: 12,
        targetYear: 2027,
      },
    });

    const valuesOnlyRes = await resetAllFinancialDataForUser(
      { id: user.id, name: user.name },
      'Maria Silva Teste',
      'VALUES_ONLY'
    );
    expect(valuesOnlyRes.ok).toBe(true);
    expect(await prisma.transaction.count({ where: { userId: user.id } })).toBe(0);
    const accAfterValuesOnly = await prisma.account.findUnique({ where: { id: acc.id } });
    expect(accAfterValuesOnly?.initialBalanceInCents).toBe(0);
    expect(await prisma.category.findUnique({ where: { id: customCat.id } })).not.toBeNull();
    expect(await prisma.portfolioGoal.findUnique({ where: { id: customGoal.id } })).not.toBeNull();

    // 3. Modo ALL (case-insensitive e espaços extras) zera tudo e recria DEFAULT_CATEGORIES
    const confirmed = await resetAllFinancialDataForUser(
      { id: user.id, name: user.name },
      '  maria   silva teste ',
      'ALL'
    );
    expect(confirmed.ok).toBe(true);

    expect(await prisma.transaction.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(0);

    const settingsAfter = await prisma.userSettings.findUnique({ where: { userId: user.id } });
    expect(settingsAfter?.defaultAccountId).toBeNull();

    const categoriesAfter = await prisma.category.findMany({ where: { userId: user.id } });
    expect(categoriesAfter).toHaveLength(DEFAULT_CATEGORIES.length);
  });
});

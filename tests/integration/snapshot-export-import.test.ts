import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { exportUserSnapshot } from '@/features/dashboard/services/snapshot-export';
import { importUserSnapshot } from '@/features/dashboard/services/snapshot-import';

describe('Integração: Snapshot Completo (Exportação & Restauração Pareada)', () => {
  const email = `snapshot-test-${Date.now()}@finmind.local`;
  let userId = '';

  afterAll(async () => {
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it('exporta todos os dados, substitui alterações posteriores e pareia 100% ao importar', async () => {
    const user = await prisma.user.create({
      data: { email, name: 'Teste Snapshot', passwordHash: 'hash' },
    });
    userId = user.id;

    const acc = await prisma.account.create({
      data: { userId, name: 'Conta Backup', type: 'CHECKING', initialBalanceInCents: 250000 },
    });
    const cat = await prisma.category.create({
      data: { userId, name: 'Categoria Backup', type: 'EXPENSE', defaultNature: 'VARIABLE' },
    });
    await prisma.userSettings.create({
      data: { userId, theme: 'LIGHT', density: 'COMPACT', defaultAccountId: acc.id },
    });
    await prisma.transaction.create({
      data: {
        userId,
        type: 'EXPENSE',
        nature: 'VARIABLE',
        amountInCents: 45000,
        date: new Date('2026-11-10T12:00:00Z'),
        description: 'Lançamento Original Snapshot',
        sourceAccountId: acc.id,
        categoryId: cat.id,
      },
    });
    await prisma.portfolioGoal.create({
      data: { userId, title: 'Meta Snapshot', targetAmountInCents: 900000, targetMonth: 12, targetYear: 2027 },
    });
    await prisma.recurrenceRule.create({
      data: { userId, description: 'Custo Estático Snapshot', type: 'EXPENSE', nature: 'STATIC', amountInCents: 120000 },
    });
    await prisma.valueForecastItem.create({
      data: { userId, title: 'Freela Previsto', type: 'INCOME', amountInCents: 180000, expectedDate: new Date('2026-12-05T12:00:00Z') },
    });
    await prisma.balanceTargetCheck.create({
      data: { userId, title: 'Meta Dia 10', plannedBalanceInCents: 400000, targetDate: new Date('2026-12-10T12:00:00Z') },
    });

    // 1. Exportar Snapshot completo
    const exported = await exportUserSnapshot(userId);
    expect(exported.snapshot.format).toBe('finmind-snapshot');
    expect(exported.snapshot.data.accounts).toHaveLength(1);
    expect(exported.snapshot.data.transactions).toHaveLength(1);
    expect(exported.snapshot.data.valueForecastItems).toHaveLength(1);
    expect(exported.snapshot.data.balanceTargetChecks).toHaveLength(1);

    // 2. Alterar drasticamente o estado atual (adicionar lixo e apagar dados reais)
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.portfolioGoal.deleteMany({ where: { userId } });
    await prisma.account.create({
      data: { userId, name: 'Conta Lixo Pós-Backup', type: 'CASH', initialBalanceInCents: 999 },
    });

    // 3. Rejeitar snapshot inválido sem corromper o banco
    const invalidRes = await importUserSnapshot(userId, { format: 'outro', version: 99 });
    expect(invalidRes.ok).toBe(false);

    // 4. Importar o snapshot original e validar pareamento exato
    const imported = await importUserSnapshot(userId, JSON.parse(exported.json));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.counts.accounts).toBe(1);
    expect(imported.counts.transactions).toBe(1);
    expect(imported.counts.portfolioGoals).toBe(1);
    expect(imported.counts.valueForecastItems).toBe(1);
    expect(imported.counts.balanceTargetChecks).toBe(1);

    const [accountsAfter, txsAfter, goalsAfter, settingsAfter] = await Promise.all([
      prisma.account.findMany({ where: { userId } }),
      prisma.transaction.findMany({ where: { userId }, include: { sourceAccount: true, category: true } }),
      prisma.portfolioGoal.findMany({ where: { userId } }),
      prisma.userSettings.findUnique({ where: { userId } }),
    ]);

    expect(accountsAfter).toHaveLength(1);
    expect(accountsAfter[0].name).toBe('Conta Backup');
    expect(txsAfter).toHaveLength(1);
    expect(txsAfter[0].description).toBe('Lançamento Original Snapshot');
    expect(txsAfter[0].sourceAccount?.name).toBe('Conta Backup');
    expect(txsAfter[0].category?.name).toBe('Categoria Backup');
    expect(goalsAfter).toHaveLength(1);
    expect(goalsAfter[0].title).toBe('Meta Snapshot');
    expect(settingsAfter?.theme).toBe('LIGHT');
    expect(settingsAfter?.defaultAccountId).toBe(accountsAfter[0].id);
  });

  it('importa backups antigos que ainda trazem `subcategories` e `subcategoryId` (campos removidos)', async () => {
    const { snapshot } = await exportUserSnapshot(userId);
    const legacy = JSON.parse(JSON.stringify(snapshot));
    legacy.data.subcategories = [{ id: 'old-sub', categoryId: legacy.data.categories[0].id, name: 'Antiga' }];
    legacy.data.transactions[0].subcategoryId = 'old-sub';
    const res = await importUserSnapshot(userId, legacy);
    expect(res.ok).toBe(true);
  });
});

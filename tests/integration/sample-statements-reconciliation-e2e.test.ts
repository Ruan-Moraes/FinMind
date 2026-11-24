import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { parseMultipleStatementFiles } from '@/features/reconciliation/parsers';
import { runIntelligentReconciliationPipeline } from '@/features/reconciliation/engine';
import { persistConfirmedBatchItemsInTx } from '@/features/reconciliation/engine/batch-item-persister';
import { getMonthSummary } from '@/features/analytics';

const TEST_EMAIL = 'test.samples.vitest@finmind.local';
let userId = '';
let accountId = '';

describe('Integração SQLite: Conferência Matemática Exata dos 3 Extratos de Exemplo', () => {
  beforeAll(async () => {
    const existing = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    if (existing) await prisma.user.delete({ where: { id: existing.id } });

    const created = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Conferência Extratos',
        passwordHash: 'hash-test',
        settings: { create: { fiscalMonthStartDay: 1 } },
        accounts: {
          create: { name: 'Conta Principal Teste', type: 'CHECKING', initialBalanceInCents: 0 },
        },
        categories: {
          create: [
            { name: 'Salário', type: 'INCOME', defaultNature: 'STATIC' },
            { name: 'Moradia', type: 'EXPENSE', defaultNature: 'STATIC' },
            { name: 'Alimentação', type: 'EXPENSE', defaultNature: 'VARIABLE' },
            { name: 'Transporte', type: 'EXPENSE', defaultNature: 'VARIABLE' },
          ],
        },
      },
      include: { accounts: true },
    });
    userId = created.id;
    accountId = created.accounts[0].id;
  });

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('lê os 3 extratos reais, detecta 1 duplicidade Uber (-45,30) e fecha R$ 8.925,50 / R$ 4.776,90 no banco', async () => {
    const dir = path.resolve(process.cwd(), 'exemplos-extratos');
    const fileNames = [
      'extrato-nubank-novembro-2026.csv',
      'extrato-itau-novembro-2026.ofx',
      'extrato-mercado-pago-novembro-2026.csv',
    ];

    const parsedFiles = await parseMultipleStatementFiles(
      fileNames.map((name, idx) => ({
        fileId: `sample-${idx}`,
        fileName: name,
        content: fs.readFileSync(path.join(dir, name), 'utf8'),
      }))
    );

    expect(parsedFiles).toHaveLength(3);
    expect(parsedFiles.every((f) => f.status === 'PROCESSED')).toBe(true);

    const categories = await prisma.category.findMany({ where: { userId } });
    const plan = await runIntelligentReconciliationPipeline({
      files: [],
      parsedFiles,
      recurrenceRules: [],
      existingTransactions: [],
      existingInvoices: [],
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        defaultNature: c.defaultNature,
      })),
      memoryRules: [],
    });

    // 10 (Nubank) + 7 (Itaú) + 7 (Mercado Pago) = 24 movimentações (23 únicas + 1 duplicada)
    expect(plan.summary.totalMovements).toBe(24);
    expect(plan.summary.duplicatesCount).toBe(1);

    const uniqueItems = plan.items.filter((i) => i.decisionType !== 'SKIP_DUPLICATE');
    expect(uniqueItems).toHaveLength(23);

    const batch = await prisma.statementImportBatch.create({
      data: {
        userId,
        fileCount: 3,
        totalMovements: 24,
        status: 'COMMITTED',
      },
    });

    const persisted = await prisma.$transaction((tx) =>
      persistConfirmedBatchItemsInTx({
        tx,
        userId,
        batchId: batch.id,
        payload: {
          targetType: 'ACCOUNT',
          sourceAccountId: accountId,
          files: plan.files,
          items: plan.items,
        },
        selectedItems: uniqueItems,
        fileIdMap: new Map(),
        defaultAccountId: accountId,
        validDestinationAccountId: null,
        validCreditCardId: null,
        cardClosingDay: 25,
        resolveCategoryId: (catId) => catId || null,
        rollbackSnapshot: {
          updatedTransactions: [],
          updatedInvoices: [],
        },
      })
    );

    expect(persisted.createdCount).toBe(23);

    const summary = await getMonthSummary(userId, 11, 2026);
    expect(summary.totalIncomeInCents).toBe(892550);
    expect(summary.totalExpenseInCents).toBe(477690);
    expect(summary.netBalanceInCents).toBe(414860);
  });
});

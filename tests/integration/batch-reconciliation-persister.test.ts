import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { runIntelligentReconciliationPipeline } from '@/features/reconciliation/engine';
import {
  resolveBatchCategoriesAndAccountsInTx,
  calibrateAccountBalanceInTx,
} from '@/features/reconciliation/engine/batch-balance-calibrator';
import { persistConfirmedBatchItemsInTx } from '@/features/reconciliation/engine/batch-item-persister';
import type { BatchRollbackSnapshot, ConfirmImportBatchPayload } from '@/features/reconciliation/engine/batch-persistence-types';

const TEST_EMAIL = 'test.batch.persister.vitest@finmind.local';

describe('Integração SQLite: Batch Persister, Reconcilers e Calibrador de Saldo', () => {
  afterAll(async () => {
    const u = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    if (u) {
      await prisma.transaction.deleteMany({ where: { userId: u.id } });
      await prisma.reconciliationMemoryRule.deleteMany({ where: { userId: u.id } });
      await prisma.statementImportFile.deleteMany({ where: { batch: { userId: u.id } } });
      await prisma.statementImportBatch.deleteMany({ where: { userId: u.id } });
      await prisma.recurrenceRule.deleteMany({ where: { userId: u.id } });
      await prisma.account.deleteMany({ where: { userId: u.id } });
      await prisma.category.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  });

  it('executa resolveBatchCategoriesAndAccountsInTx, persistConfirmedBatchItemsInTx e calibrateAccountBalanceFromStatementInTx', async () => {
    const existing = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    if (existing) {
      await prisma.transaction.deleteMany({ where: { userId: existing.id } });
      await prisma.reconciliationMemoryRule.deleteMany({ where: { userId: existing.id } });
      await prisma.statementImportFile.deleteMany({ where: { batch: { userId: existing.id } } });
      await prisma.statementImportBatch.deleteMany({ where: { userId: existing.id } });
      await prisma.recurrenceRule.deleteMany({ where: { userId: existing.id } });
      await prisma.account.deleteMany({ where: { userId: existing.id } });
      await prisma.category.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, name: 'Teste Persister', passwordHash: 'hash' },
    });
    const acc = await prisma.account.create({
      data: { userId: user.id, name: 'Conta Mercado Pago', type: 'CHECKING', initialBalanceInCents: 0 },
    });
    const cat = await prisma.category.create({
      data: { userId: user.id, name: 'Internet & Telefonia', type: 'EXPENSE', defaultNature: 'STATIC', color: '#6366f1' },
    });
    const rule = await prisma.recurrenceRule.create({
      data: {
        userId: user.id,
        description: 'Internet Claro Fibra',
        type: 'EXPENSE',
        nature: 'STATIC',
        amountInCents: 12000,
        dayOfMonth: 12,
        categoryId: cat.id,
        accountId: acc.id,
      },
    });

    const acc2 = await prisma.account.create({
      data: { userId: user.id, name: 'Conta Reserva', type: 'SAVINGS', initialBalanceInCents: 0 },
    });
    const pendingTx = await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'EXPENSE',
        nature: 'VARIABLE',
        amountInCents: 8500,
        date: new Date('2026-11-14T12:00:00'),
        description: 'Fatura Energia Prevista',
        status: 'PENDING',
        sourceAccountId: acc.id,
        categoryId: cat.id,
      },
    });

    const plan = await runIntelligentReconciliationPipeline({
      files: [
        {
          fileId: 'f1',
          fileName: 'extrato-mp.csv',
          content: [
            'Data;Descricao;Valor;Saldo',
            '12/11/2026;PAGAMENTO CLARO NET;-120,00;880,00',
            '14/11/2026;PAGAMENTO CONTA ENERGIA;-85,00;795,00',
            '15/11/2026;PIX RECEBIDO SERVICO;+500,00;1295,00',
          ].join('\n'),
        },
      ],
      categories: [{ id: cat.id, name: cat.name, type: cat.type, defaultNature: cat.defaultNature }],
      recurrenceRules: [
        {
          id: rule.id,
          description: rule.description,
          type: 'EXPENSE',
          nature: 'STATIC',
          amountInCents: rule.amountInCents,
          dayOfMonth: rule.dayOfMonth,
          frequency: 'MONTHLY',
          categoryId: cat.id,
          categoryName: cat.name,
          accountId: acc.id,
        },
      ],
      existingTransactions: [
        {
          id: pendingTx.id,
          description: pendingTx.description,
          type: 'EXPENSE',
          nature: 'VARIABLE',
          amountInCents: pendingTx.amountInCents,
          date: '2026-11-14',
          status: 'PENDING',
          categoryId: cat.id,
          categoryName: cat.name,
          sourceAccountId: acc.id,
          recurrenceRuleId: null,
          externalTransactionHash: null,
          rawBankDescription: null,
        },
      ],
    });

    const payload: ConfirmImportBatchPayload = {
      targetType: 'ACCOUNT',
      sourceAccountId: acc.id,
      destinationAccountId: acc2.id,
      files: plan.files,
      items: plan.items,
      calibrateBalanceFromStatement: true,
    };

    const rollbackSnapshot: BatchRollbackSnapshot = {
      updatedTransactions: [],
      updatedInvoices: [],
      updatedAccountBalances: [],
    };

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.statementImportBatch.create({
        data: {
          userId: user.id,
          status: 'COMMITTED',
          fileCount: plan.files.length,
          totalMovements: plan.items.length,
          reconciledCount: 0,
          createdTransactionsCount: 0,
          skippedDuplicatesCount: 0,
          aiProvider: 'LOCAL',
          aiModelId: 'deterministic',
          summaryJson: '{}',
        },
      });

      const fileIdMap = new Map<string, string>();
      for (const f of plan.files) {
        const dbFile = await tx.statementImportFile.create({
          data: {
            batchId: batch.id,
            fileName: f.fileName,
            fileFormat: f.fileFormat,
            fileHash: f.fileHash,
            bankName: f.bankName,
            itemCount: f.extractedCount,
            status: f.status,
          },
        });
        fileIdMap.set(f.fileId, dbFile.id);
      }

      const resolved = await resolveBatchCategoriesAndAccountsInTx({
        tx,
        user: { id: user.id },
        payload,
        selectedItems: plan.items,
        rollbackSnapshot,
      });

      const persisted = await persistConfirmedBatchItemsInTx({
        tx,
        userId: user.id,
        batchId: batch.id,
        payload,
        selectedItems: plan.items,
        fileIdMap,
        defaultAccountId: resolved.defaultAccountId,
        validDestinationAccountId: resolved.validDestinationAccountId,
        validCreditCardId: null,
        cardClosingDay: 25,
        resolveCategoryId: resolved.resolveCategoryId,
        rollbackSnapshot,
      });

      await calibrateAccountBalanceInTx({
        tx,
        userId: user.id,
        payload,
        defaultAccountId: resolved.defaultAccountId,
        rollbackSnapshot,
      });

      return persisted;
    });

    expect(result.createdCount).toBeGreaterThanOrEqual(2);
    expect(result.reconciledCount).toBeGreaterThanOrEqual(2);

    const updatedAccount = await prisma.account.findUnique({ where: { id: acc.id } });
    // Movimentação líquida = +500 - 120 - 85 = +295; saldo final oficial do extrato = 1295 -> saldo inicial calibrado = 1000 (100.000 centavos)
    expect(updatedAccount?.initialBalanceInCents).toBe(100000);
  });
});

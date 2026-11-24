import { describe, it, expect } from 'vitest';
import assert from 'node:assert/strict';
import { prisma } from '@/shared/lib/prisma';
import { getAccountsWithBalances } from '@/features/analytics';
import { runIntelligentReconciliationPipeline } from '@/features/reconciliation/engine';
import { TEST_CATEGORIES, TEST_RECURRENCE_RULES } from '../helpers/statement-fixtures';

describe('Integração DB — Cenários 19 e 20: Persistência Transacional, Reimportação e Reversão Controlada', () => {
  it('persiste lote conciliado, bloqueia duplicidade em reimportação (DUPLICATE_IN_DB) e reverte restaurando saldo exato', async () => {
    const categories = TEST_CATEGORIES;
    const recurrenceRules = TEST_RECURRENCE_RULES;
  const testUser = await prisma.user.upsert({
    where: { email: 'test-reconcile@finmind.local' },
    create: {
      email: 'test-reconcile@finmind.local',
      name: 'Teste Conciliação',
      passwordHash: 'hash',
    },
    update: {},
  });

  // Limpa dados anteriores do usuário de teste
  await prisma.transaction.deleteMany({ where: { userId: testUser.id } });
  await prisma.statementImportBatch.deleteMany({ where: { userId: testUser.id } });
  await prisma.reconciliationMemoryRule.deleteMany({ where: { userId: testUser.id } });
  await prisma.recurrenceRule.deleteMany({ where: { userId: testUser.id } });
  await prisma.account.deleteMany({ where: { userId: testUser.id } });

  const testAccount = await prisma.account.create({
    data: {
      userId: testUser.id,
      name: 'Conta Corrente Teste',
      type: 'CHECKING',
      initialBalanceInCents: 100000, // Saldo inicial: R$ 1.000,00
    },
  });

  const dbRuleInternet = await prisma.recurrenceRule.create({
    data: {
      userId: testUser.id,
      description: 'Internet',
      type: 'EXPENSE',
      nature: 'STATIC',
      amountInCents: 12000,
      dayOfMonth: 12,
      accountId: testAccount.id,
    },
  });

  const pendingRentTx = await prisma.transaction.create({
    data: {
      userId: testUser.id,
      type: 'EXPENSE',
      nature: 'STATIC',
      amountInCents: 120000,
      date: new Date('2026-11-10T12:00:00'),
      description: 'Aluguel Previsto',
      status: 'PENDING',
      sourceAccountId: testAccount.id,
    },
  });

  // Verifica saldo antes da importação (Transação PENDING não afeta saldo consolidado: R$ 1.000,00)
  const balancesBefore = await getAccountsWithBalances(testUser.id);
  assert.equal(balancesBefore[0].currentBalanceInCents, 100000);

  // Simula confirmação de lote com 1 conciliação de Transaction PENDING (Aluguel -1200), 1 conciliação de RecurrenceRule (Internet -120) e 1 Receita (+3500)
  const batchRecord = await prisma.statementImportBatch.create({
    data: {
      userId: testUser.id,
      status: 'COMMITTED',
      fileCount: 1,
      totalMovements: 3,
      reconciledCount: 2,
      createdTransactionsCount: 2,
      skippedDuplicatesCount: 0,
      summaryJson: JSON.stringify({
        updatedTransactions: [
          {
            id: pendingRentTx.id,
            previousStatus: pendingRentTx.status,
            previousAmountInCents: pendingRentTx.amountInCents,
            previousDate: pendingRentTx.date.toISOString(),
            previousDescription: pendingRentTx.description,
            previousCategoryId: null,
            previousSourceAccountId: testAccount.id,
            previousImportBatchId: null,
            previousImportFileId: null,
            previousExternalHash: null,
            previousRawBankDescription: null,
            previousFinancialAction: null,
          },
        ],
        updatedInvoices: [],
      }),
    },
  });

  await prisma.transaction.update({
    where: { id: pendingRentTx.id },
    data: {
      status: 'COMPLETED',
      importBatchId: batchRecord.id,
      externalTransactionHash: 'hash-aluguel-1',
      rawBankDescription: 'PIX ENVIADO IMOBILIARIA ABC',
    },
  });

  await prisma.transaction.createMany({
    data: [
      {
        userId: testUser.id,
        type: 'EXPENSE',
        nature: 'STATIC',
        amountInCents: 12000,
        date: new Date('2026-11-12T12:00:00'),
        description: 'Internet',
        status: 'COMPLETED',
        sourceAccountId: testAccount.id,
        recurrenceRuleId: dbRuleInternet.id,
        importBatchId: batchRecord.id,
        externalTransactionHash: 'hash-claro-1',
        rawBankDescription: 'PAGAMENTO CLARO NET',
      },
      {
        userId: testUser.id,
        type: 'INCOME',
        nature: 'STATIC',
        amountInCents: 350000,
        date: new Date('2026-11-05T12:00:00'),
        description: 'Salário',
        status: 'COMPLETED',
        sourceAccountId: testAccount.id,
        importBatchId: batchRecord.id,
        externalTransactionHash: 'hash-salario-1',
        rawBankDescription: 'TED RECEBIDA EMPRESA XYZ',
      },
    ],
  });

  // Saldo esperado após confirmação: 1.000,00 + 3.500,00 - 1.200,00 - 120,00 = R$ 3.180,00 (318000 centavos)
  const balancesAfterCommit = await getAccountsWithBalances(testUser.id);
  assert.equal(balancesAfterCommit[0].currentBalanceInCents, 318000);

  // Testa Cenário 19: Reimportação do mesmo extrato deve detectar DUPLICATE_IN_DB
  const dbTxsAfterCommit = await prisma.transaction.findMany({ where: { userId: testUser.id } });
  const reimportPlan = await runIntelligentReconciliationPipeline({
    files: [
      {
        fileId: 'f-reimport',
        fileName: 'extrato-reimportado.csv',
        content: '12/11/2026;PAGAMENTO CLARO NET;-120,00',
      },
    ],
    categories,
    recurrenceRules,
    existingTransactions: dbTxsAfterCommit.map((t) => ({
      id: t.id,
      description: t.description,
      type: t.type as 'INCOME' | 'EXPENSE' | 'TRANSFER',
      nature: t.nature as 'STATIC' | 'VARIABLE',
      amountInCents: t.amountInCents,
      date: t.date.toISOString().slice(0, 10),
      status: t.status as 'COMPLETED' | 'PENDING',
      categoryId: t.categoryId,
      categoryName: null,
      sourceAccountId: t.sourceAccountId,
      recurrenceRuleId: t.recurrenceRuleId,
      externalTransactionHash: t.externalTransactionHash,
      rawBankDescription: t.rawBankDescription,
    })),
  });
  assert.equal(reimportPlan.items[0].decisionType, 'SKIP_DUPLICATE');
  assert.equal(reimportPlan.items[0].matchPrecision, 'DUPLICATE_IN_DB');

  // Testa Cenário 20: Reversão do lote confirmado restaura o lançamento PENDING e o saldo exato de R$ 1.000,00
  const snap = JSON.parse(batchRecord.summaryJson);
  for (const prev of snap.updatedTransactions) {
    await prisma.transaction.update({
      where: { id: prev.id },
      data: {
        status: prev.previousStatus,
        importBatchId: null,
        externalTransactionHash: null,
        rawBankDescription: null,
      },
    });
  }
  await prisma.transaction.deleteMany({
    where: {
      userId: testUser.id,
      importBatchId: batchRecord.id,
    },
  });
  await prisma.statementImportBatch.update({
    where: { id: batchRecord.id },
    data: { status: 'REVERTED', revertedAt: new Date() },
  });

  const balancesAfterRevert = await getAccountsWithBalances(testUser.id);
  assert.equal(balancesAfterRevert[0].currentBalanceInCents, 100000, 'Saldo deve voltar exatamente a R$ 1.000,00 após reversão');
  const restoredPendingTx = await prisma.transaction.findUnique({ where: { id: pendingRentTx.id } });
  assert.equal(restoredPendingTx?.status, 'PENDING', 'Lançamento previsto deve voltar ao status PENDING');

  // Limpa usuário temporário de teste
  await prisma.user.delete({ where: { id: testUser.id } });

    expect(balancesAfterRevert[0].currentBalanceInCents).toBe(100000);
  });
});
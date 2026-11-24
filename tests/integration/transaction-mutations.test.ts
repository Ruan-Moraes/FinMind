import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import {
  createTransactionForUser,
  updateTransactionForUser,
  deleteTransactionForUser,
} from '@/features/transactions/services/transaction-mutations';

const TEST_EMAIL = 'test.tx.mutations.vitest@finmind.local';

async function cleanupUser() {
  const u = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (!u) return;
  await prisma.attachment.deleteMany({ where: { transaction: { userId: u.id } } });
  await prisma.transaction.deleteMany({ where: { userId: u.id } });
  await prisma.reconciliationMemoryRule.deleteMany({ where: { userId: u.id } });
  await prisma.installmentGroup.deleteMany({ where: { userId: u.id } });
  await prisma.creditCardInvoice.deleteMany({ where: { creditCard: { userId: u.id } } });
  await prisma.creditCard.deleteMany({ where: { userId: u.id } });
  await prisma.account.deleteMany({ where: { userId: u.id } });
  await prisma.category.deleteMany({ where: { userId: u.id } });
  await prisma.financialKnowledgeChunk.deleteMany({ where: { userId: u.id } });
  await prisma.user.delete({ where: { id: u.id } });
}

describe('Integração SQLite: Serviços de Mutação de Transações (Create, Update, Delete & Parcelas)', () => {
  afterAll(cleanupUser);

  it('valida Zod, cria transação com anexo, parcela em cartão, edita com aprendizado de memória e exclui série', async () => {
    await cleanupUser();

    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, name: 'Teste Tx Mutations', passwordHash: 'hash' },
    });
    const acc1 = await prisma.account.create({
      data: { userId: user.id, name: 'Conta Corrente', type: 'CHECKING', initialBalanceInCents: 100000 },
    });
    const acc2 = await prisma.account.create({
      data: { userId: user.id, name: 'Poupança', type: 'SAVINGS', initialBalanceInCents: 50000 },
    });
    const cat = await prisma.category.create({
      data: { userId: user.id, name: 'Compras & Lazer', type: 'EXPENSE', defaultNature: 'VARIABLE', color: '#f97316' },
    });
    const card = await prisma.creditCard.create({
      data: {
        userId: user.id,
        name: 'Visa Infinite',
        brand: 'Visa',
        limitInCents: 500000,
        closingDay: 20,
        dueDay: 1,
        color: '#6366f1',
      },
    });

    // 1. Rejeita payload inválido via Zod / valor zero
    const invalidRes = await createTransactionForUser(user.id, {
      type: 'EXPENSE',
      nature: 'VARIABLE',
      amountRaw: '0,00',
      date: '2026-11-10',
      description: 'Valor zero',
      status: 'COMPLETED',
      paymentTarget: 'ACCOUNT',
    });
    expect(invalidRes.ok).toBe(false);

    // 2. Cria despesa em conta com anexo
    const createAccRes = await createTransactionForUser(user.id, {
      type: 'EXPENSE',
      nature: 'VARIABLE',
      amountRaw: '150,00',
      date: '2026-11-10',
      description: 'Jantar Restaurante Central',
      status: 'COMPLETED',
      paymentTarget: 'ACCOUNT',
      sourceAccountId: acc1.id,
      categoryId: cat.id,
      attachment: {
        fileName: 'recibo.pdf',
        mimeType: 'application/pdf',
        sizeInBytes: 1024,
        fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQ=',
      },
    });
    expect(createAccRes.ok).toBe(true);

    const createdSimple = await prisma.transaction.findFirst({
      where: { userId: user.id, description: 'Jantar Restaurante Central' },
      include: { attachments: true },
    });
    expect(createdSimple?.attachments).toHaveLength(1);

    // 3. Edita transação migrando de conta -> cartão e gravando regra de memória
    const updateToCardRes = await updateTransactionForUser(user.id, {
      id: createdSimple!.id,
      type: 'EXPENSE',
      nature: 'VARIABLE',
      amountRaw: '180,00',
      date: '2026-11-22', // após fechamento dia 20 -> fatura 12/2026
      description: 'Jantar Restaurante Central Editado',
      status: 'COMPLETED',
      paymentTarget: 'CREDIT_CARD',
      creditCardId: card.id,
      categoryId: cat.id,
      tags: 'jantar,cartao',
    });
    expect(updateToCardRes.ok).toBe(true);

    const memoryRule = await prisma.reconciliationMemoryRule.findFirst({
      where: { userId: user.id, categoryId: cat.id },
    });
    expect(memoryRule).not.toBeNull();

    // 4. Edita de volta para transferência entre contas
    const updateToTransferRes = await updateTransactionForUser(user.id, {
      id: createdSimple!.id,
      type: 'TRANSFER',
      nature: 'VARIABLE',
      amountRaw: '200,00',
      date: '2026-11-12',
      description: 'Transferência Reserva',
      status: 'COMPLETED',
      paymentTarget: 'ACCOUNT',
      sourceAccountId: acc1.id,
      destinationAccountId: acc2.id,
    });
    expect(updateToTransferRes.ok).toBe(true);

    // 5. Exclui transação simples
    const delSimpleRes = await deleteTransactionForUser(user.id, createdSimple!.id, false);
    expect(delSimpleRes.ok).toBe(true);

    // 6. Cria compra parcelada em 3x no cartão com anexo na 1ª parcela e depois exclui série inteira
    const createInstallmentRes = await createTransactionForUser(user.id, {
      type: 'EXPENSE',
      nature: 'VARIABLE',
      amountRaw: '300,00',
      date: '2026-11-15',
      description: 'Fone Bluetooth',
      status: 'COMPLETED',
      paymentTarget: 'CREDIT_CARD',
      creditCardId: card.id,
      categoryId: cat.id,
      installments: 3,
      attachment: {
        fileName: 'nf.pdf',
        mimeType: 'application/pdf',
        sizeInBytes: 512,
        fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQ=',
      },
    });
    expect(createInstallmentRes.ok).toBe(true);

    const parcels = await prisma.transaction.findMany({
      where: { userId: user.id, creditCardId: card.id },
      orderBy: { installmentNumber: 'asc' },
    });
    expect(parcels).toHaveLength(3);
    expect(parcels[0].installmentGroupId).not.toBeNull();

    const delSeriesRes = await deleteTransactionForUser(user.id, parcels[0].id, true);
    expect(delSeriesRes.ok).toBe(true);

    const remaining = await prisma.transaction.count({ where: { userId: user.id } });
    expect(remaining).toBe(0);
  });
});

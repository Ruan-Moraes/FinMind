import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import {
  getAccountsWithBalances,
  getCreditCardsWithSummary,
} from '@/features/analytics';
import {
  createAccountForUser,
  updateAccountForUser,
  archiveOrDeleteAccountForUser,
  createCreditCardForUser,
  payCreditCardInvoiceForUser,
} from '@/features/accounts/services/account-card-mutations';
import { buildInstallmentPlan } from '@/features/credit-cards/domain/installment-builder';

const TEST_USER_EMAIL = 'test.accounts.cards.vitest@finmind.local';

describe('Integração SQLite: Contas, Recalibração, Arquivamento RN-03, Cartões e Faturas RN-02', () => {
  afterAll(async () => {
    const existing = await prisma.user.findUnique({ where: { email: TEST_USER_EMAIL } });
    if (existing) {
      await prisma.transaction.deleteMany({ where: { userId: existing.id } });
      await prisma.installmentGroup.deleteMany({ where: { userId: existing.id } });
      await prisma.creditCardInvoice.deleteMany({
        where: { creditCard: { userId: existing.id } },
      });
      await prisma.creditCard.deleteMany({ where: { userId: existing.id } });
      await prisma.account.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  });

  it('cria contas, recalibra saldo atual, aplica RN-03 (arquivar vs deletar) e processa fatura parcelada (RN-01/RN-02)', async () => {
    const existing = await prisma.user.findUnique({ where: { email: TEST_USER_EMAIL } });
    if (existing) {
      await prisma.transaction.deleteMany({ where: { userId: existing.id } });
      await prisma.installmentGroup.deleteMany({ where: { userId: existing.id } });
      await prisma.creditCardInvoice.deleteMany({
        where: { creditCard: { userId: existing.id } },
      });
      await prisma.creditCard.deleteMany({ where: { userId: existing.id } });
      await prisma.account.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    const user = await prisma.user.create({
      data: {
        email: TEST_USER_EMAIL,
        name: 'Teste Contas e Cartões',
        passwordHash: 'hash',
      },
    });

    // 1. Criar conta principal e conta vazia temporária
    const mainAccRes = await createAccountForUser(user.id, {
      name: 'Itaú Uniclass',
      type: 'CHECKING',
      initialBalanceRaw: '1000,00',
      color: '#f97316',
    });
    const emptyAccRes = await createAccountForUser(user.id, {
      name: 'Carteira Vazia',
      type: 'CASH',
      initialBalanceRaw: '0,00',
      color: '#10b981',
    });

    expect(mainAccRes.ok).toBe(true);
    expect(emptyAccRes.ok).toBe(true);
    if (!mainAccRes.ok || !emptyAccRes.ok) return;

    // 2. Criar uma receita de R$ 500,00 na conta principal -> saldo passa a R$ 1.500,00
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'INCOME',
        nature: 'VARIABLE',
        amountInCents: 50000,
        date: new Date(2026, 2, 10, 12, 0, 0),
        description: 'Reembolso Cliente',
        status: 'COMPLETED',
        sourceAccountId: mainAccRes.account.id,
      },
    });

    let balances = await getAccountsWithBalances(user.id);
    const mainBalance1 = balances.find((a) => a.id === mainAccRes.account.id);
    expect(mainBalance1?.currentBalanceInCents).toBe(150000);

    // 3. Recalibrar saldo consolidado diretamente para R$ 2.200,00 (RF-02)
    const updateRes = await updateAccountForUser(user.id, {
      id: mainAccRes.account.id,
      name: 'Itaú Uniclass Personalité',
      type: 'CHECKING',
      targetCurrentBalanceRaw: '2200,00',
      color: '#f97316',
    });
    expect(updateRes.ok).toBe(true);

    balances = await getAccountsWithBalances(user.id);
    const mainBalance2 = balances.find((a) => a.id === mainAccRes.account.id);
    expect(mainBalance2?.currentBalanceInCents).toBe(220000);

    // 4. RN-03: Conta sem transações é DELETED; conta com transações é ARCHIVED
    const delEmpty = await archiveOrDeleteAccountForUser(user.id, emptyAccRes.account.id);
    expect(delEmpty.ok && delEmpty.mode === 'DELETED').toBe(true);

    const archiveMain = await archiveOrDeleteAccountForUser(user.id, mainAccRes.account.id);
    expect(archiveMain.ok && archiveMain.mode === 'ARCHIVED').toBe(true);

    // Reativar conta principal para pagar fatura
    await prisma.account.update({
      where: { id: mainAccRes.account.id },
      data: { isArchived: false },
    });

    // 5. Criar cartão de crédito e lançar compra parcelada em 3x de R$ 600,00 (R$ 200/mês)
    const cardRes = await createCreditCardForUser(user.id, {
      name: 'Nubank Ultravioleta',
      brand: 'Mastercard',
      limitRaw: '10000,00',
      closingDay: 25,
      dueDay: 5,
      color: '#8b5cf6',
    });
    expect(cardRes.ok).toBe(true);
    if (!cardRes.ok) return;

    const parcels = buildInstallmentPlan({
      totalAmountInCents: 60000,
      totalInstallments: 3,
      txDate: new Date(2026, 2, 12, 12, 0, 0), // 12/03/2026 (antes do fechamento dia 25 -> fatura 03/2026)
      closingDay: cardRes.card.closingDay,
      description: 'Monitor LG Ultrawide',
    });

    for (const p of parcels) {
      const inv = await prisma.creditCardInvoice.upsert({
        where: {
          creditCardId_month_year: {
            creditCardId: cardRes.card.id,
            month: p.invoiceMonth,
            year: p.invoiceYear,
          },
        },
        create: {
          creditCardId: cardRes.card.id,
          month: p.invoiceMonth,
          year: p.invoiceYear,
          status: 'OPEN',
        },
        update: {},
      });

      await prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'EXPENSE',
          nature: 'VARIABLE',
          amountInCents: p.amountInCents,
          date: p.date,
          description: p.description,
          status: 'COMPLETED',
          creditCardId: cardRes.card.id,
          invoiceId: inv.id,
          installmentNumber: p.installmentNumber,
          totalInstallments: p.totalInstallments,
        },
      });
    }

    const cardsSummaryBefore = await getCreditCardsWithSummary(user.id, 3, 2026);
    expect(cardsSummaryBefore).toHaveLength(1);
    expect(cardsSummaryBefore[0].currentInvoiceInCents).toBe(20000);
    expect(cardsSummaryBefore[0].usedLimitInCents).toBe(60000);
    expect(cardsSummaryBefore[0].availableLimitInCents).toBe(940000);

    // 6. Pagar a fatura de 03/2026 debitando da conta principal (RN-02)
    const payRes = await payCreditCardInvoiceForUser(user.id, {
      creditCardId: cardRes.card.id,
      month: 3,
      year: 2026,
      sourceAccountId: mainAccRes.account.id,
    });
    expect(payRes.ok).toBe(true);

    const cardsSummaryAfter = await getCreditCardsWithSummary(user.id, 3, 2026);
    expect(cardsSummaryAfter[0].currentInvoiceStatus).toBe('PAID');
    expect(cardsSummaryAfter[0].usedLimitInCents).toBe(40000); // Restam 2 parcelas de R$ 200

    const finalBalances = await getAccountsWithBalances(user.id);
    const finalMain = finalBalances.find((a) => a.id === mainAccRes.account.id);
    // R$ 2.200,00 - R$ 200,00 (fatura paga) = R$ 2.000,00 (200.000 centavos)
    expect(finalMain?.currentBalanceInCents).toBe(200000);
  });
});

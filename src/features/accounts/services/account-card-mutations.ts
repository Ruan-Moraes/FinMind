import { prisma } from '@/shared/lib/prisma';
import { parseInputToCents } from '@/shared/lib/currency';
import {
  computeNetAccountMovementsInCents,
  recalibrateInitialBalanceInCents,
} from '@/features/credit-cards/domain/installment-builder';
import { syncUserFinancialKnowledge } from '@/features/ai-copilot/rag';

export async function createAccountForUser(
  userId: string,
  data: {
    name: string;
    type: 'CHECKING' | 'SAVINGS' | 'CASH';
    initialBalanceRaw: string;
    color: string;
  }
) {
  if (!data.name.trim()) {
    return { ok: false as const, error: 'Informe o nome da conta.' };
  }

  const initialBalanceInCents = parseInputToCents(data.initialBalanceRaw);

  const account = await prisma.account.create({
    data: {
      userId,
      name: data.name.trim(),
      type: data.type,
      initialBalanceInCents,
      color: data.color || '#10b981',
    },
  });

  return { ok: true as const, account };
}

export async function updateAccountForUser(
  userId: string,
  data: {
    id: string;
    name: string;
    type: 'CHECKING' | 'SAVINGS' | 'CASH';
    initialBalanceRaw?: string;
    targetCurrentBalanceRaw?: string;
    color: string;
  }
) {
  if (!data.name.trim()) {
    return { ok: false as const, error: 'Informe o nome da conta.' };
  }

  const existing = await prisma.account.findFirst({
    where: { id: data.id, userId },
  });

  if (!existing) {
    return { ok: false as const, error: 'Conta bancária não encontrada.' };
  }

  let initialBalanceInCents = existing.initialBalanceInCents;

  if (data.targetCurrentBalanceRaw !== undefined && data.targetCurrentBalanceRaw.trim() !== '') {
    const desiredCurrentCents = parseInputToCents(data.targetCurrentBalanceRaw);
    const txs = await prisma.transaction.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        creditCardId: null,
        OR: [{ sourceAccountId: existing.id }, { destinationAccountId: existing.id }],
      },
      select: {
        type: true,
        amountInCents: true,
        sourceAccountId: true,
        destinationAccountId: true,
      },
    });

    const netMovementsInCents = computeNetAccountMovementsInCents(existing.id, txs);
    initialBalanceInCents = recalibrateInitialBalanceInCents({
      desiredCurrentBalanceInCents: desiredCurrentCents,
      netMovementsInCents,
    });
  } else if (data.initialBalanceRaw !== undefined) {
    initialBalanceInCents = parseInputToCents(data.initialBalanceRaw);
  }

  const updated = await prisma.account.update({
    where: { id: existing.id },
    data: {
      name: data.name.trim(),
      type: data.type,
      initialBalanceInCents,
      color: data.color || '#10b981',
    },
  });

  return { ok: true as const, account: updated };
}

export async function archiveOrDeleteAccountForUser(userId: string, accountId: string) {
  const existing = await prisma.account.findFirst({
    where: { id: accountId, userId },
  });
  if (!existing) {
    return { ok: false as const, error: 'Conta bancária não encontrada.' };
  }

  const txCount = await prisma.transaction.count({
    where: {
      userId,
      OR: [{ sourceAccountId: accountId }, { destinationAccountId: accountId }],
    },
  });

  if (txCount > 0) {
    await prisma.account.update({
      where: { id: existing.id },
      data: { isArchived: true },
    });
    return {
      ok: true as const,
      mode: 'ARCHIVED' as const,
      message: 'A conta possui transações vinculadas e foi arquivada com segurança (RN-03).',
    };
  }

  await prisma.account.delete({
    where: { id: existing.id },
  });

  return { ok: true as const, mode: 'DELETED' as const };
}

export async function createCreditCardForUser(
  userId: string,
  data: {
    name: string;
    brand: string;
    limitRaw: string;
    closingDay: number;
    dueDay: number;
    color: string;
  }
) {
  const limitInCents = parseInputToCents(data.limitRaw);
  if (!data.name.trim() || limitInCents <= 0) {
    return { ok: false as const, error: 'Informe nome e limite válido para o cartão.' };
  }

  const card = await prisma.creditCard.create({
    data: {
      userId,
      name: data.name.trim(),
      brand: data.brand || 'Mastercard',
      limitInCents,
      closingDay: Math.min(31, Math.max(1, Number(data.closingDay) || 25)),
      dueDay: Math.min(31, Math.max(1, Number(data.dueDay) || 5)),
      color: data.color || '#6366f1',
    },
  });

  return { ok: true as const, card };
}

export async function payCreditCardInvoiceForUser(
  userId: string,
  data: {
    creditCardId: string;
    month: number;
    year: number;
    sourceAccountId: string;
  }
) {
  const [invoice, sourceAccount] = await Promise.all([
    prisma.creditCardInvoice.findUnique({
      where: {
        creditCardId_month_year: {
          creditCardId: data.creditCardId,
          month: data.month,
          year: data.year,
        },
      },
      include: {
        creditCard: true,
        transactions: true,
      },
    }),
    prisma.account.findFirst({
      where: { id: data.sourceAccountId, userId },
    }),
  ]);

  if (!invoice || invoice.creditCard.userId !== userId) {
    return { ok: false as const, error: 'Fatura não encontrada para este período.' };
  }
  if (!sourceAccount) {
    return { ok: false as const, error: 'Conta bancária de origem não encontrada.' };
  }
  if (invoice.status === 'PAID') {
    return { ok: false as const, error: 'Esta fatura já consta como paga.' };
  }

  const totalInvoiceCents = invoice.transactions.reduce((acc, t) => acc + t.amountInCents, 0);
  if (totalInvoiceCents <= 0) {
    return { ok: false as const, error: 'O valor da fatura é R$ 0,00.' };
  }

  await prisma.$transaction([
    prisma.creditCardInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'PAID',
        paidAmountInCents: totalInvoiceCents,
        paidAt: new Date(),
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: 'EXPENSE',
        nature: 'VARIABLE',
        amountInCents: totalInvoiceCents,
        date: new Date(),
        description: `Pagamento Fatura ${invoice.creditCard.name} (${String(data.month).padStart(2, '0')}/${data.year})`,
        status: 'COMPLETED',
        sourceAccountId: sourceAccount.id,
        tags: 'fatura,cartao',
        purpose: 'CREDIT_CARD_BILL',
        financialAction: 'CREDIT_CARD_BILL_PAYMENT',
        isUserConfirmed: true,
      },
    }),
  ]);

  await syncUserFinancialKnowledge(userId).catch(() => {});
  return { ok: true as const, paidAmountInCents: totalInvoiceCents };
}

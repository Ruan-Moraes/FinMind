import { prisma } from '@/shared/lib/prisma';
import { parseInputToCents } from '@/shared/lib/currency';
import { buildMemoryPatternKey } from '@/features/reconciliation/engine';
import { syncUserFinancialKnowledge } from '@/features/ai-copilot/rag';
import { logWarn } from '@/shared/lib/logger';
import { resolveCreditCardInvoicePeriod } from '@/features/credit-cards/domain/installment-builder';
import {
  extractFirstZodError,
  updateTransactionSchema,
} from '@/features/planning/schemas/finance-schemas';

function syncKnowledgeSafe(userId: string) {
  return syncUserFinancialKnowledge(userId).catch((err) =>
    logWarn('TransactionManageMutations', 'Falha não-fatal ao sincronizar RAG', {
      userId,
      error: err,
    })
  );
}

export async function updateTransactionForUser(userId: string, raw: unknown) {
  const parsed = updateTransactionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: extractFirstZodError(parsed.error) };

  const payload = parsed.data;
  const existing = await prisma.transaction.findFirst({ where: { id: payload.id, userId } });
  if (!existing) return { ok: false as const, error: 'Transação não encontrada.' };

  const amountInCents = parseInputToCents(payload.amountRaw);
  if (amountInCents <= 0) return { ok: false as const, error: 'Informe um valor maior que R$ 0,00.' };

  const txDate = payload.date ? new Date(`${payload.date}T12:00:00`) : existing.date;

  if (payload.type === 'EXPENSE' && payload.paymentTarget === 'CREDIT_CARD' && payload.creditCardId) {
    const card = await prisma.creditCard.findFirst({ where: { id: payload.creditCardId, userId } });
    if (!card) return { ok: false as const, error: 'Cartão de crédito não encontrado.' };

    const { month, year } = resolveCreditCardInvoicePeriod(txDate, card.closingDay);
    const invoice = await prisma.creditCardInvoice.upsert({
      where: { creditCardId_month_year: { creditCardId: card.id, month, year } },
      create: { creditCardId: card.id, month, year, status: 'OPEN' },
      update: {},
    });

    await prisma.transaction.update({
      where: { id: existing.id },
      data: {
        type: 'EXPENSE',
        nature: payload.nature,
        amountInCents,
        date: txDate,
        description: payload.description,
        status: 'COMPLETED',
        sourceAccountId: null,
        destinationAccountId: null,
        creditCardId: card.id,
        invoiceId: invoice.id,
        categoryId: payload.categoryId || null,
        tags: payload.tags?.trim() || '',
        isUserConfirmed: true,
      },
    });
  } else {
    await prisma.transaction.update({
      where: { id: existing.id },
      data: {
        type: payload.type,
        nature: payload.nature,
        amountInCents,
        date: txDate,
        description: payload.description,
        status: payload.status,
        sourceAccountId: payload.sourceAccountId || null,
        destinationAccountId: payload.type === 'TRANSFER' ? payload.destinationAccountId || null : null,
        creditCardId: null,
        invoiceId: null,
        categoryId: payload.type === 'TRANSFER' ? null : payload.categoryId || null,
        tags: payload.tags?.trim() || '',
        isUserConfirmed: true,
      },
    });
  }

  const patternKey = buildMemoryPatternKey(existing.rawBankDescription || payload.description);
  if (patternKey.length >= 4 && payload.type !== 'TRANSFER' && payload.categoryId) {
    await prisma.reconciliationMemoryRule.upsert({
      where: { userId_normalizedPattern: { userId, normalizedPattern: patternKey } },
      create: {
        userId,
        normalizedPattern: patternKey,
        merchantKeyword: (existing.counterparty || '').toUpperCase().slice(0, 40),
        financialAction: existing.financialAction || '',
        purpose: existing.purpose || '',
        targetType: payload.type,
        nature: payload.nature,
        categoryId: payload.categoryId,
        recurrenceRuleId: existing.recurrenceRuleId,
        confirmCount: 1,
        lastConfirmedAt: new Date(),
      },
      update: {
        targetType: payload.type,
        nature: payload.nature,
        categoryId: payload.categoryId,
        confirmCount: { increment: 1 },
        lastConfirmedAt: new Date(),
      },
    });
  }

  await syncKnowledgeSafe(userId);
  return { ok: true as const };
}

export async function deleteTransactionForUser(
  userId: string,
  id: string,
  deleteInstallmentSeries = false
) {
  const tx = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!tx) return { ok: false as const, error: 'Transação não encontrada.' };

  if (deleteInstallmentSeries && tx.installmentGroupId) {
    await prisma.installmentGroup.deleteMany({ where: { id: tx.installmentGroupId, userId } });
    await prisma.transaction.deleteMany({ where: { installmentGroupId: tx.installmentGroupId, userId } });
  } else {
    await prisma.transaction.delete({ where: { id: tx.id } });
  }

  await syncKnowledgeSafe(userId);
  return { ok: true as const };
}

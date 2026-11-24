import { prisma } from '@/shared/lib/prisma';
import { parseInputToCents } from '@/shared/lib/currency';
import { enrichTransactionMetadata } from '@/features/reconciliation/engine';
import { syncUserFinancialKnowledge } from '@/features/ai-copilot/rag';
import { logWarn } from '@/shared/lib/logger';
import { buildInstallmentPlan } from '@/features/credit-cards/domain/installment-builder';
import {
  createTransactionSchema,
  extractFirstZodError,
} from '@/features/planning/schemas/finance-schemas';

export {
  updateTransactionForUser,
  deleteTransactionForUser,
} from '@/features/transactions/services/transaction-manage-mutations';

function syncKnowledgeSafe(userId: string) {
  return syncUserFinancialKnowledge(userId).catch((err) =>
    logWarn('TransactionMutations', 'Falha não-fatal ao sincronizar RAG', { userId, error: err })
  );
}

export async function createTransactionForUser(userId: string, raw: unknown) {
  const parsed = createTransactionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: extractFirstZodError(parsed.error) };

  const payload = parsed.data;
  const totalAmountInCents = parseInputToCents(payload.amountRaw);
  if (totalAmountInCents <= 0) {
    return { ok: false as const, error: 'Informe um valor maior que R$ 0,00.' };
  }

  const txDate = payload.date ? new Date(`${payload.date}T12:00:00`) : new Date();
  const [userCategories, userMemoryRules] = await Promise.all([
    prisma.category.findMany({ where: { userId } }),
    prisma.reconciliationMemoryRule.findMany({ where: { userId } }),
  ]);

  const enriched = enrichTransactionMetadata({
    rawDescription: payload.description,
    type: payload.type,
    categories: userCategories,
    memoryRules: userMemoryRules,
  });

  const resolvedCategoryId =
    payload.type === 'TRANSFER'
      ? null
      : payload.categoryId || enriched.suggestedCategoryId || null;

  if (payload.type === 'EXPENSE' && payload.paymentTarget === 'CREDIT_CARD' && payload.creditCardId) {
    const card = await prisma.creditCard.findFirst({
      where: { id: payload.creditCardId, userId },
    });
    if (!card) return { ok: false as const, error: 'Cartão de crédito não encontrado.' };

    const parcels = buildInstallmentPlan({
      totalAmountInCents,
      totalInstallments: Number(payload.installments || 1),
      txDate,
      closingDay: card.closingDay,
      description: payload.description,
    });

    const installmentGroupId =
      parcels.length > 1
        ? (
            await prisma.installmentGroup.create({
              data: {
                userId,
                description: payload.description,
                totalAmountInCents,
                totalInstallments: parcels.length,
              },
            })
          ).id
        : undefined;

    for (let i = 0; i < parcels.length; i++) {
      const parcel = parcels[i];
      const invoice = await prisma.creditCardInvoice.upsert({
        where: {
          creditCardId_month_year: {
            creditCardId: card.id,
            month: parcel.invoiceMonth,
            year: parcel.invoiceYear,
          },
        },
        create: { creditCardId: card.id, month: parcel.invoiceMonth, year: parcel.invoiceYear, status: 'OPEN' },
        update: {},
      });

      const createdTx = await prisma.transaction.create({
        data: {
          userId,
          type: 'EXPENSE',
          nature: payload.nature,
          amountInCents: parcel.amountInCents,
          date: parcel.date,
          description: parcel.description,
          status: 'COMPLETED',
          creditCardId: card.id,
          invoiceId: invoice.id,
          categoryId: resolvedCategoryId,
          installmentGroupId: installmentGroupId || null,
          installmentNumber: parcel.installmentNumber,
          totalInstallments: parcel.totalInstallments,
          tags: payload.tags?.trim() || '',
          counterparty: enriched.counterparty,
          paymentMethod: 'CARTAO_CREDITO',
          purpose: enriched.purpose,
          financialAction: enriched.financialActionCode,
          aiConfidenceScore: enriched.confidenceScore,
          aiConfidenceLevel: enriched.confidenceLevel,
          isAiClassified: !payload.categoryId && Boolean(enriched.suggestedCategoryId),
          isUserConfirmed: true,
        },
      });

      if (i === 0 && payload.attachment) {
        await prisma.attachment.create({ data: { transactionId: createdTx.id, ...payload.attachment } });
      }
    }

    await syncKnowledgeSafe(userId);
    return { ok: true as const };
  }

  const createdTx = await prisma.transaction.create({
    data: {
      userId,
      type: payload.type,
      nature: payload.nature,
      amountInCents: totalAmountInCents,
      date: txDate,
      description: payload.description,
      status: payload.status,
      sourceAccountId: payload.sourceAccountId || null,
      destinationAccountId: payload.type === 'TRANSFER' ? payload.destinationAccountId || null : null,
      categoryId: resolvedCategoryId,
      tags: payload.tags?.trim() || '',
      counterparty: enriched.counterparty,
      paymentMethod: enriched.paymentMethod,
      purpose: enriched.purpose,
      financialAction: enriched.financialActionCode,
      aiConfidenceScore: enriched.confidenceScore,
      aiConfidenceLevel: enriched.confidenceLevel,
      isAiClassified: !payload.categoryId && Boolean(enriched.suggestedCategoryId),
      isUserConfirmed: true,
    },
  });

  if (payload.attachment) {
    await prisma.attachment.create({ data: { transactionId: createdTx.id, ...payload.attachment } });
  }

  await syncKnowledgeSafe(userId);
  return { ok: true as const };
}

import { type Prisma } from "@prisma/client";
import { buildMemoryPatternKey, type ReconciledStatementItem } from '@/features/reconciliation/engine';
import { type BatchRollbackSnapshot, type ConfirmImportBatchPayload } from '@/features/reconciliation/engine/batch-persistence-types';
import { reconcileExistingTransactionOrRuleInTx } from '@/features/reconciliation/engine/batch-item-reconcilers';
export async function persistConfirmedBatchItemsInTx(params: {
  tx: Prisma.TransactionClient;
  userId: string;
  batchId: string;
  payload: ConfirmImportBatchPayload;
  selectedItems: ReconciledStatementItem[];
  fileIdMap: Map<string, string>;
  defaultAccountId: string | null;
  validDestinationAccountId: string | null;
  validCreditCardId: string | null;
  cardClosingDay: number;
  resolveCategoryId: (catId?: string | null, fallbackName?: string | null, fallbackType?: string) => string | null;
  rollbackSnapshot: BatchRollbackSnapshot;
}) {
  const {
    tx, userId, batchId, payload, selectedItems, fileIdMap,
    defaultAccountId, validDestinationAccountId, validCreditCardId, cardClosingDay,
    resolveCategoryId, rollbackSnapshot
  } = params;
  const user = { id: userId };
  const batch = { id: batchId };
      let createdCount = 0;
      let reconciledCount = 0;
      for (const item of selectedItems) { const amountInCents = Math.round(Number(item.amountInCents));
        if (!amountInCents || amountInCents <= 0) continue;
        const txDate = item.date ? new Date(`${item.date}T12:00:00`) : new Date();
        const dbFileId = fileIdMap.get(item.fileId) || null;
        const finalDescription = (
          item.normalizedDescription ||
          item.originalDescription ||
          'Movimentação Importada'
        ).trim();
        const resolvedItemCategoryId = resolveCategoryId(
          item.categoryId, item.categoryName,
          item.type === 'INCOME' ? 'INCOME' : 'EXPENSE'
        );
        const recRes = await reconcileExistingTransactionOrRuleInTx({
          tx, userId, batchId, dbFileId, item, amountInCents, txDate,
          finalDescription, resolvedItemCategoryId, defaultAccountId, rollbackSnapshot, });
        if (recRes.handled) { createdCount += recRes.createdDelta;
          reconciledCount += recRes.reconciledDelta;
        }
        else if (item.decisionType === 'PAY_CREDIT_CARD_INVOICE') {
          if (item.matchedInvoiceId) {
            const invoice = await tx.creditCardInvoice.findUnique({
              where: { id: item.matchedInvoiceId },
            });
            if (invoice && invoice.status !== 'PAID') {
              rollbackSnapshot.updatedInvoices.push({
                id: invoice.id, previousStatus: invoice.status,
                previousPaidAmountInCents: invoice.paidAmountInCents,
                previousPaidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null, });
              await tx.creditCardInvoice.update({
                where: { id: invoice.id },
                data: {
                  status: 'PAID', paidAmountInCents: amountInCents,
                  paidAt: txDate, },
              });
            }
          }
          await tx.transaction.create({
            data: {
              userId: user.id, type: 'EXPENSE',
              nature: 'VARIABLE', amountInCents,
              date: txDate, description: finalDescription,
              status: 'COMPLETED', sourceAccountId: defaultAccountId,
              creditCardId: null, // Debita da conta bancária, não cria nova compra no cartão
              categoryId: resolvedItemCategoryId, tags: 'fatura,cartao,conciliado',
              importBatchId: batch.id, importFileId: dbFileId,
              externalTransactionHash: item.externalHash, rawBankDescription: item.originalDescription,
              financialAction: 'CREDIT_CARD_BILL_PAYMENT', counterparty: item.counterparty,
              paymentMethod: item.paymentMethod, purpose: 'CREDIT_CARD_BILL',
              aiConfidenceScore: item.confidenceScore, aiConfidenceLevel: item.confidenceLevel,
              isAiClassified: true, isUserConfirmed: true,
            }, });
          reconciledCount += 1;
          createdCount += 1;
        }
        else if (item.decisionType === 'RECORD_SELF_TRANSFER' || item.type === 'TRANSFER') {
          const isOutflow = item.direction === 'OUTFLOW';
          await tx.transaction.create({
            data: {
              userId: user.id, type: 'TRANSFER',
              nature: 'VARIABLE', amountInCents,
              date: txDate, description: finalDescription,
              status: 'COMPLETED', sourceAccountId: isOutflow ? defaultAccountId : validDestinationAccountId,
              destinationAccountId: isOutflow ? validDestinationAccountId : defaultAccountId,
              categoryId: null, tags: 'transferencia,contas-proprias',
              importBatchId: batch.id, importFileId: dbFileId,
              externalTransactionHash: item.externalHash, rawBankDescription: item.originalDescription,
              financialAction: item.financialActionCode, counterparty: item.counterparty,
              paymentMethod: item.paymentMethod, purpose: 'SELF_TRANSFER',
              aiConfidenceScore: item.confidenceScore, aiConfidenceLevel: item.confidenceLevel,
              isAiClassified: true, isUserConfirmed: true,
            }, });
          createdCount += 1;
        }
        else {
          if (
            item.type === 'EXPENSE' &&
            payload.targetType === 'CREDIT_CARD' &&
            validCreditCardId
          ) { let targetMonth = txDate.getMonth() + 1;
            let targetYear = txDate.getFullYear();
            if (txDate.getDate() >= cardClosingDay) { targetMonth += 1;
              if (targetMonth > 12) { targetMonth = 1;
                targetYear += 1;
              }
            }
            const invoice = await tx.creditCardInvoice.upsert({
              where: {
                creditCardId_month_year: {
                  creditCardId: validCreditCardId, month: targetMonth,
                  year: targetYear, },
              },
              create: {
                creditCardId: validCreditCardId, month: targetMonth,
                year: targetYear, status: 'OPEN',
              },
              update: {},
            });
            await tx.transaction.create({
              data: {
                userId: user.id, type: 'EXPENSE',
                nature: item.nature, amountInCents,
                date: txDate, description: finalDescription,
                status: 'COMPLETED', creditCardId: validCreditCardId,
                invoiceId: invoice.id, categoryId: resolvedItemCategoryId,
                tags: item.tags || 'extrato,ia', importBatchId: batch.id,
                importFileId: dbFileId, externalTransactionHash: item.externalHash,
                rawBankDescription: item.originalDescription, financialAction: item.financialActionCode,
                counterparty: item.counterparty, paymentMethod: item.paymentMethod,
                purpose: item.purpose, aiConfidenceScore: item.confidenceScore,
                aiConfidenceLevel: item.confidenceLevel, isAiClassified: Boolean(item.isAiClassified),
                isUserConfirmed: true, },
            });
            createdCount += 1;
          } else {
            await tx.transaction.create({
              data: {
                userId: user.id, type: item.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
                nature: item.nature, amountInCents,
                date: txDate, description: finalDescription,
                status: 'COMPLETED', sourceAccountId: defaultAccountId,
                categoryId: resolvedItemCategoryId, tags: item.tags || 'extrato,ia',
                importBatchId: batch.id, importFileId: dbFileId,
                externalTransactionHash: item.externalHash, rawBankDescription: item.originalDescription,
                financialAction: item.financialActionCode, counterparty: item.counterparty,
                paymentMethod: item.paymentMethod, purpose: item.purpose,
                aiConfidenceScore: item.confidenceScore, aiConfidenceLevel: item.confidenceLevel,
                isAiClassified: Boolean(item.isAiClassified), isUserConfirmed: true,
              }, });
            createdCount += 1;
          }
        }
        const patternKey = buildMemoryPatternKey(item.originalDescription);
        if (patternKey.length >= 4) {
          const merchantKey = (item.counterparty || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .trim()
            .slice(0, 40);
          await tx.reconciliationMemoryRule.upsert({
            where: {
              userId_normalizedPattern: {
                userId: user.id, normalizedPattern: patternKey,
              }, },
            create: {
              userId: user.id, normalizedPattern: patternKey,
              merchantKeyword: merchantKey, financialAction: item.financialActionCode,
              purpose: item.purpose, targetType: item.type,
              nature: item.nature, categoryId: resolvedItemCategoryId,
              recurrenceRuleId: item.matchedRuleId || null, confirmCount: 1,
              lastConfirmedAt: new Date(), },
            update: {
              merchantKeyword: merchantKey || undefined, financialAction: item.financialActionCode,
              purpose: item.purpose, targetType: item.type,
              nature: item.nature, categoryId: resolvedItemCategoryId,
              recurrenceRuleId: item.matchedRuleId || null,
              confirmCount: { increment: 1 },
              lastConfirmedAt: new Date(), },
          });
        }
      }
  return { createdCount, reconciledCount };
}
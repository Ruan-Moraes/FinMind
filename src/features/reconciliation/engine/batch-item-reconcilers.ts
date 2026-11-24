import { type Prisma } from "@prisma/client";
import { type ReconciledStatementItem } from '@/features/reconciliation/engine';
import { type BatchRollbackSnapshot } from '@/features/reconciliation/engine/batch-persistence-types';

export async function reconcileExistingTransactionOrRuleInTx(params: {
  tx: Prisma.TransactionClient;
  userId: string;
  batchId: string;
  dbFileId: string | null;
  item: ReconciledStatementItem;
  amountInCents: number;
  txDate: Date;
  finalDescription: string;
  resolvedItemCategoryId: string | null;
  defaultAccountId: string | null;
  rollbackSnapshot: BatchRollbackSnapshot;
}): Promise<{ createdDelta: number; reconciledDelta: number; handled: boolean }> {
  const {
    tx, userId, batchId, dbFileId, item, amountInCents, txDate,
    finalDescription, resolvedItemCategoryId, defaultAccountId, rollbackSnapshot
  } = params;
  const user = { id: userId };
  const batch = { id: batchId };
  let createdCount = 0;
  let reconciledCount = 0;
        if (item.decisionType === 'RECONCILE_TRANSACTION' && item.matchedTransactionId) {
          const existingTx = await tx.transaction.findFirst({
            where: { id: item.matchedTransactionId, userId: user.id },
          });

          if (existingTx) {
            rollbackSnapshot.updatedTransactions.push({
              id: existingTx.id,
              previousStatus: existingTx.status,
              previousAmountInCents: existingTx.amountInCents,
              previousDate: existingTx.date.toISOString(),
              previousDescription: existingTx.description,
              previousCategoryId: existingTx.categoryId,
              previousSourceAccountId: existingTx.sourceAccountId,
              previousImportBatchId: existingTx.importBatchId,
              previousImportFileId: existingTx.importFileId,
              previousExternalHash: existingTx.externalTransactionHash,
              previousRawBankDescription: existingTx.rawBankDescription,
              previousFinancialAction: existingTx.financialAction,
            });

            await tx.transaction.update({
              where: { id: existingTx.id },
              data: {
                status: 'COMPLETED',
                amountInCents,
                date: txDate,
                description: finalDescription || existingTx.description,
                categoryId: resolvedItemCategoryId || existingTx.categoryId,
                sourceAccountId: existingTx.sourceAccountId || defaultAccountId,
                importBatchId: batch.id,
                importFileId: dbFileId,
                externalTransactionHash: item.externalHash,
                rawBankDescription: item.originalDescription,
                financialAction: item.financialActionCode,
                counterparty: item.counterparty,
                paymentMethod: item.paymentMethod,
                purpose: item.purpose,
                aiConfidenceScore: item.confidenceScore,
                aiConfidenceLevel: item.confidenceLevel,
                isAiClassified: Boolean(item.isAiClassified),
                isUserConfirmed: true,
              },
            });

            reconciledCount += 1;
          }
          return { createdDelta: createdCount, reconciledDelta: reconciledCount, handled: true };
        }
        // 2. Conciliação com Regra Fixa / Recorrente (RecurrenceRule — Aluguel, Internet, Academia, Salário)
        if (item.decisionType === 'RECONCILE_RULE' && item.matchedRuleId) {
          const rule = await tx.recurrenceRule.findFirst({
            where: { id: item.matchedRuleId, userId: user.id },
          });

          if (rule) {
            // Verifica se já existe uma transação PENDING daquela regra no mesmo mês/ano
            const monthStart = new Date(txDate.getFullYear(), txDate.getMonth(), 1, 0, 0, 0);
            const monthEnd = new Date(txDate.getFullYear(), txDate.getMonth() + 1, 0, 23, 59, 59);

            const pendingRuleTx = await tx.transaction.findFirst({
              where: {
                userId: user.id,
                recurrenceRuleId: rule.id,
                status: 'PENDING',
                date: { gte: monthStart, lte: monthEnd },
              },
            });

            if (pendingRuleTx) {
              rollbackSnapshot.updatedTransactions.push({
                id: pendingRuleTx.id,
                previousStatus: pendingRuleTx.status,
                previousAmountInCents: pendingRuleTx.amountInCents,
                previousDate: pendingRuleTx.date.toISOString(),
                previousDescription: pendingRuleTx.description,
                previousCategoryId: pendingRuleTx.categoryId,
                previousSourceAccountId: pendingRuleTx.sourceAccountId,
                previousImportBatchId: pendingRuleTx.importBatchId,
                previousImportFileId: pendingRuleTx.importFileId,
                previousExternalHash: pendingRuleTx.externalTransactionHash,
                previousRawBankDescription: pendingRuleTx.rawBankDescription,
                previousFinancialAction: pendingRuleTx.financialAction,
              });

              await tx.transaction.update({
                where: { id: pendingRuleTx.id },
                data: {
                  status: 'COMPLETED',
                  amountInCents,
                  date: txDate,
                  categoryId: resolvedItemCategoryId || rule.categoryId,
                  sourceAccountId:
                    defaultAccountId || rule.accountId || pendingRuleTx.sourceAccountId,
                  importBatchId: batch.id,
                  importFileId: dbFileId,
                  externalTransactionHash: item.externalHash,
                  rawBankDescription: item.originalDescription,
                  financialAction: item.financialActionCode,
                  counterparty: item.counterparty,
                  paymentMethod: item.paymentMethod,
                  purpose: item.purpose,
                  aiConfidenceScore: item.confidenceScore,
                  aiConfidenceLevel: item.confidenceLevel,
                  isAiClassified: Boolean(item.isAiClassified),
                  isUserConfirmed: true,
                },
              });
            } else {
              await tx.transaction.create({
                data: {
                  userId: user.id,
                  type: rule.type,
                  nature: rule.nature,
                  amountInCents,
                  date: txDate,
                  description: finalDescription || rule.description,
                  status: 'COMPLETED',
                  sourceAccountId: defaultAccountId || rule.accountId || null,
                  categoryId: resolvedItemCategoryId || rule.categoryId || null,
                  recurrenceRuleId: rule.id,
                  tags: item.tags || 'conciliado,recorrente',
                  importBatchId: batch.id,
                  importFileId: dbFileId,
                  externalTransactionHash: item.externalHash,
                  rawBankDescription: item.originalDescription,
                  financialAction: item.financialActionCode,
                  counterparty: item.counterparty,
                  paymentMethod: item.paymentMethod,
                  purpose: item.purpose,
                  aiConfidenceScore: item.confidenceScore,
                  aiConfidenceLevel: item.confidenceLevel,
                  isAiClassified: Boolean(item.isAiClassified),
                  isUserConfirmed: true,
                },
              });
              createdCount += 1;
            }
            reconciledCount += 1;
          }
          return { createdDelta: createdCount, reconciledDelta: reconciledCount, handled: true };
        }
  return { createdDelta: 0, reconciledDelta: 0, handled: false };
}
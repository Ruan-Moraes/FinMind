'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/lib/prisma';
import { requireAuthenticatedUser } from '@/features/auth';
import { syncUserFinancialKnowledge } from '@/features/ai-copilot/rag';
import { type BatchRollbackSnapshot, type ConfirmImportBatchPayload } from '@/features/reconciliation/engine/batch-persistence-types';
import { calibrateAccountBalanceInTx, resolveBatchCategoriesAndAccountsInTx } from '@/features/reconciliation/engine/batch-balance-calibrator';
import { persistConfirmedBatchItemsInTx } from '@/features/reconciliation/engine/batch-item-persister';
export async function confirmStatementImportBatchAction(
  payload: ConfirmImportBatchPayload
): Promise<{
  ok: boolean;
  batchId?: string;
  createdCount?: number;
  reconciledCount?: number;
  skippedCount?: number;
  error?: string;
}> {
  const user = await requireAuthenticatedUser();
  const selectedItems = (payload.items || []).filter(
    (item) => item.selectedForImport && item.decisionType !== 'SKIP_DUPLICATE'
  );
  if (selectedItems.length === 0) {
    return {
      ok: false,
      error: 'Nenhuma movimentação selecionada para confirmação.',
    };
  }
  let cardClosingDay = 25;
  let validCreditCardId: string | null = null;
  if (payload.targetType === 'CREDIT_CARD' && payload.creditCardId) {
    const card = await prisma.creditCard.findFirst({
      where: { id: payload.creditCardId, userId: user.id },
    });
    if (card) {
      cardClosingDay = card.closingDay;
      validCreditCardId = card.id;
    }
  }
  const provider = user.settings?.aiProvider || 'OPENAI';
  const modelId =
    provider === 'OPENAI'
      ? user.settings?.openaiModel || 'gpt-4o-mini'
      : provider === 'GEMINI'
      ? user.settings?.geminiModel || 'gemini-2.0-flash'
      : user.settings?.claudeModel || 'claude-3-5-sonnet-latest';
  try {
    const result = await prisma.$transaction(async (tx) => {
      const rollbackSnapshot: BatchRollbackSnapshot = {
        createdAccountId: null,
        updatedAccountBalances: [],
        updatedTransactions: [],
        updatedInvoices: [],
      };
      const { resolveCategoryId, defaultAccountId, validDestinationAccountId } =
        await resolveBatchCategoriesAndAccountsInTx({
          tx, user, payload, selectedItems, rollbackSnapshot,
        });
      const skippedDuplicatesCount = (payload.items || []).filter(
        (i) => i.decisionType === 'SKIP_DUPLICATE' || !i.selectedForImport
      ).length;
      const batch = await tx.statementImportBatch.create({
        data: {
          userId: user.id,
          status: 'COMMITTED',
          fileCount: payload.files.length || 1,
          totalMovements: payload.items.length,
          reconciledCount: 0,
          createdTransactionsCount: 0,
          skippedDuplicatesCount,
          aiProvider: provider,
          aiModelId: modelId,
          summaryJson: '{}',
        },
      });
      const fileIdMap = new Map<string, string>();
      for (const f of payload.files) {
        const createdFile = await tx.statementImportFile.create({
          data: {
            batchId: batch.id,
            fileName: f.fileName,
            fileFormat: f.fileFormat,
            bankName: f.bankName,
            periodStart: f.periodStart ? new Date(`${f.periodStart}T00:00:00`) : null,
            periodEnd: f.periodEnd ? new Date(`${f.periodEnd}T23:59:59`) : null,
            fileHash: f.fileHash || '',
            itemCount: f.extractedCount,
            status: f.status,
          },
        });
        fileIdMap.set(f.fileId, createdFile.id);
      }
      const { createdCount, reconciledCount } = await persistConfirmedBatchItemsInTx({
        tx,
        userId: user.id,
        batchId: batch.id,
        payload,
        selectedItems,
        fileIdMap,
        defaultAccountId,
        validDestinationAccountId,
        validCreditCardId,
        cardClosingDay,
        resolveCategoryId,
        rollbackSnapshot,
      });
      await calibrateAccountBalanceInTx({
        tx,
        userId: user.id,
        payload,
        defaultAccountId,
        rollbackSnapshot,
      });
      await tx.statementImportBatch.update({
        where: { id: batch.id },
        data: {
          reconciledCount,
          createdTransactionsCount: createdCount,
          summaryJson: JSON.stringify(rollbackSnapshot),
        },
      });
      return {
        batchId: batch.id,
        createdCount,
        reconciledCount,
        skippedCount: skippedDuplicatesCount,
      };
    });
    await syncUserFinancialKnowledge(user.id).catch(() => {});
    revalidatePath('/');
    return {
      ok: true,
      ...result,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Falha ao confirmar importação: ${err.message}`
          : 'Erro inesperado ao persistir lote de importação.',
    };
  }
}
export async function revertStatementImportBatchAction(batchId: string): Promise<{
  ok: boolean;
  revertedCreatedCount?: number;
  restoredReconciledCount?: number;
  error?: string;
}> {
  const user = await requireAuthenticatedUser();
  const batch = await prisma.statementImportBatch.findFirst({
    where: { id: batchId, userId: user.id },
  });
  if (!batch) {
    return { ok: false, error: 'Lote de importação não encontrado.' };
  }
  if (batch.status === 'REVERTED') {
    return { ok: false, error: 'Este lote de importação já foi revertido anteriormente.' };
  }
  let snapshot: BatchRollbackSnapshot = {
    createdAccountId: null,
    updatedAccountBalances: [],
    updatedTransactions: [],
    updatedInvoices: [],
  };
  try {
    snapshot = JSON.parse(batch.summaryJson || '{}') as BatchRollbackSnapshot;
  } catch {
  }
  const updatedTxList = Array.isArray(snapshot.updatedTransactions)
    ? snapshot.updatedTransactions
    : [];
  const updatedInvList = Array.isArray(snapshot.updatedInvoices)
    ? snapshot.updatedInvoices
    : [];
  const updatedAccBalances = Array.isArray(snapshot.updatedAccountBalances)
    ? snapshot.updatedAccountBalances
    : [];
  const updatedTxIds = new Set(updatedTxList.map((t) => t.id));
  await prisma.$transaction(async (tx) => {
    for (const prev of updatedTxList) {
      await tx.transaction.updateMany({
        where: { id: prev.id, userId: user.id },
        data: {
          status: prev.previousStatus,
          amountInCents: prev.previousAmountInCents,
          date: new Date(prev.previousDate),
          description: prev.previousDescription,
          categoryId: prev.previousCategoryId,
          sourceAccountId: prev.previousSourceAccountId,
          importBatchId: prev.previousImportBatchId,
          importFileId: prev.previousImportFileId,
          externalTransactionHash: prev.previousExternalHash,
          rawBankDescription: prev.previousRawBankDescription,
          financialAction: prev.previousFinancialAction,
        },
      });
    }
    for (const inv of updatedInvList) {
      await tx.creditCardInvoice.updateMany({
        where: { id: inv.id },
        data: {
          status: inv.previousStatus,
          paidAmountInCents: inv.previousPaidAmountInCents,
          paidAt: inv.previousPaidAt ? new Date(inv.previousPaidAt) : null,
        },
      });
    }
    await tx.transaction.deleteMany({
      where: {
        userId: user.id,
        importBatchId: batch.id,
        id: { notIn: Array.from(updatedTxIds) },
      },
    });
    for (const accBal of updatedAccBalances) {
      await tx.account.updateMany({
        where: { id: accBal.id, userId: user.id },
        data: {
          initialBalanceInCents: accBal.previousInitialBalanceInCents,
        },
      });
    }
    await tx.statementImportBatch.update({
      where: { id: batch.id },
      data: {
        status: 'REVERTED',
        revertedAt: new Date(),
      },
    });
  });
  await syncUserFinancialKnowledge(user.id).catch(() => {});
  revalidatePath('/');
  return {
    ok: true,
    revertedCreatedCount: batch.createdTransactionsCount,
    restoredReconciledCount: updatedTxList.length + updatedInvList.length,
  };
}

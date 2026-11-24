import { type Prisma } from "@prisma/client";
import { type BatchRollbackSnapshot, type ConfirmImportBatchPayload } from '@/features/reconciliation/engine/batch-persistence-types';
import { type ReconciledStatementItem } from '@/features/reconciliation/engine';

export async function resolveBatchCategoriesAndAccountsInTx(params: {
  tx: Prisma.TransactionClient;
  user: { id: string; settings?: { defaultAccountId?: string | null } | null };
  payload: ConfirmImportBatchPayload;
  selectedItems: ReconciledStatementItem[];
  rollbackSnapshot: BatchRollbackSnapshot;
}) {
  const { tx, user, payload, selectedItems, rollbackSnapshot } = params;
      const userCategories = await tx.category.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, type: true },
      });
      const validCategoryIds = new Set(userCategories.map((c) => c.id));
      const resolveCategoryId = (
        catId?: string | null,
        fallbackName?: string | null,
        fallbackType?: string
      ): string | null => {
        if (catId && validCategoryIds.has(catId)) return catId;
        if (fallbackName) {
          const byName = userCategories.find(
            (c) => c.name.toLowerCase() === fallbackName.toLowerCase()
          );
          if (byName) return byName.id;
        }
        if (fallbackType) {
          const byType = userCategories.find((c) => c.type === fallbackType);
          if (byType) return byType.id;
        }
        return null;
      };

      // Valida ou cria automaticamente a Conta Bancária de destino quando o usuário ainda não tem conta ou quando o ID selecionado na UI é antigo
      const userAccounts = await tx.account.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
      });

      const primaryDetectedBank =
        payload.files.find((f) => f.bankName && f.bankName !== 'Instituição Financeira')?.bankName ||
        selectedItems.find((i) => i.bankName && i.bankName !== 'Instituição Financeira')?.bankName ||
        'Mercado Pago';

      let defaultAccountId: string | null = null;
      const requestedAccountId = payload.sourceAccountId || user.settings?.defaultAccountId || null;

      if (requestedAccountId) {
        const found = userAccounts.find((a) => a.id === requestedAccountId);
        if (found) {
          defaultAccountId = found.id;
        }
      }

      if (!defaultAccountId && payload.targetType === 'ACCOUNT') {
        const matchedByName = userAccounts.find(
          (a) => a.name.toLowerCase() === primaryDetectedBank.toLowerCase()
        );
        if (matchedByName) {
          defaultAccountId = matchedByName.id;
        } else if (userAccounts.length > 0) {
          defaultAccountId = userAccounts[0].id;
        } else {
          const createdAccount = await tx.account.create({
            data: {
              userId: user.id,
              name: primaryDetectedBank,
              type: 'CHECKING',
              initialBalanceInCents: 0,
              color: primaryDetectedBank.toLowerCase().includes('nubank')
                ? '#8A05BE'
                : primaryDetectedBank.toLowerCase().includes('itau') ||
                  primaryDetectedBank.toLowerCase().includes('itaú')
                ? '#EC7000'
                : '#009EE3',
            },
          });
          defaultAccountId = createdAccount.id;
          rollbackSnapshot.createdAccountId = createdAccount.id;

          await tx.userSettings.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              defaultAccountId: createdAccount.id,
            },
            update: {
              defaultAccountId: createdAccount.id,
            },
          });
        }
      }

      const validDestinationAccountId =
        payload.destinationAccountId &&
        userAccounts.some((a) => a.id === payload.destinationAccountId)
          ? payload.destinationAccountId
          : null;

  return { resolveCategoryId, defaultAccountId, validDestinationAccountId };
}

export async function calibrateAccountBalanceInTx(params: {
  tx: Prisma.TransactionClient;
  userId: string;
  payload: ConfirmImportBatchPayload;
  defaultAccountId: string | null;
  rollbackSnapshot: BatchRollbackSnapshot;
}) {
  const { tx, userId, payload, defaultAccountId, rollbackSnapshot } = params;
  const user = { id: userId };
      if (
        payload.targetType === 'ACCOUNT' &&
        defaultAccountId &&
        payload.calibrateBalanceFromStatement !== false
      ) {
        const filesWithClosingBalance = (payload.files || [])
          .filter((f) => f.status === 'PROCESSED' && typeof f.closingBalanceInCents === 'number')
          .sort((a, b) => {
            const endA = a.periodEnd || a.periodStart || '';
            const endB = b.periodEnd || b.periodStart || '';
            return endA.localeCompare(endB);
          });

        if (filesWithClosingBalance.length > 0) {
          const latestFile = filesWithClosingBalance[filesWithClosingBalance.length - 1];
          const targetClosingBalanceInCents = Number(latestFile.closingBalanceInCents);
          const cutoffDateStr = latestFile.periodEnd || latestFile.periodStart || null;
          const cutoffDate = cutoffDateStr
            ? new Date(`${cutoffDateStr}T23:59:59.999`)
            : null;

          const targetAccount = await tx.account.findFirst({
            where: { id: defaultAccountId, userId: user.id },
          });

          if (targetAccount) {
            const accountCompletedTxs = await tx.transaction.findMany({
              where: {
                userId: user.id,
                status: 'COMPLETED',
                creditCardId: null,
                ...(cutoffDate ? { date: { lte: cutoffDate } } : {}),
                OR: [
                  { sourceAccountId: defaultAccountId },
                  { destinationAccountId: defaultAccountId },
                ],
              },
            });

            let netCompletedMovementsInCents = 0;
            for (const t of accountCompletedTxs) {
              if (t.type === 'INCOME' && t.sourceAccountId === defaultAccountId) {
                netCompletedMovementsInCents += t.amountInCents;
              } else if (t.type === 'EXPENSE' && t.sourceAccountId === defaultAccountId) {
                netCompletedMovementsInCents -= t.amountInCents;
              } else if (t.type === 'TRANSFER') {
                if (t.sourceAccountId === defaultAccountId) {
                  netCompletedMovementsInCents -= t.amountInCents;
                }
                if (t.destinationAccountId === defaultAccountId) {
                  netCompletedMovementsInCents += t.amountInCents;
                }
              }
            }

            const calibratedInitialBalanceInCents =
              targetClosingBalanceInCents - netCompletedMovementsInCents;

            if (targetAccount.initialBalanceInCents !== calibratedInitialBalanceInCents) {
              rollbackSnapshot.updatedAccountBalances = [
                ...(rollbackSnapshot.updatedAccountBalances || []),
                {
                  id: targetAccount.id,
                  previousInitialBalanceInCents: targetAccount.initialBalanceInCents,
                },
              ];

              await tx.account.update({
                where: { id: targetAccount.id },
                data: {
                  initialBalanceInCents: calibratedInitialBalanceInCents,
                },
              });
            }
          }
        }
      }

}
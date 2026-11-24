'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/features/auth';
import {
  deleteTransactionForUser,
  updateTransactionForUser,
} from '@/features/transactions/services/transaction-mutations';

export async function updateTransactionAction(payload: {
  id: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  nature: 'STATIC' | 'VARIABLE';
  amountRaw: string;
  date: string;
  description: string;
  status: 'COMPLETED' | 'PENDING';
  paymentTarget: 'ACCOUNT' | 'CREDIT_CARD';
  sourceAccountId?: string;
  destinationAccountId?: string;
  creditCardId?: string;
  categoryId?: string;
  tags?: string;
}) {
  const user = await requireAuthenticatedUser();
  const result = await updateTransactionForUser(user.id, payload);
  if (!result.ok) return result;

  revalidatePath('/');
  return { ok: true as const };
}

export async function deleteTransactionAction(id: string, deleteInstallmentSeries = false) {
  const user = await requireAuthenticatedUser();
  const result = await deleteTransactionForUser(user.id, id, deleteInstallmentSeries);
  if (!result.ok) return result;

  revalidatePath('/');
  return { ok: true as const };
}

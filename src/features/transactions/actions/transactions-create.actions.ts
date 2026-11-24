'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/features/auth';
import { createTransactionForUser } from '@/features/transactions/services/transaction-mutations';

export async function createTransactionAction(payload: {
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
  installments?: number;
  tags?: string;
  attachment?: {
    fileName: string;
    mimeType: string;
    sizeInBytes: number;
    fileDataUrl: string;
  } | null;
}) {
  const user = await requireAuthenticatedUser();
  const result = await createTransactionForUser(user.id, payload);
  if (!result.ok) return result;

  revalidatePath('/');
  return { ok: true as const };
}

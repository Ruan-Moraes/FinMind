'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/features/auth';
import {
  createAccountForUser,
  updateAccountForUser,
  archiveOrDeleteAccountForUser,
} from '@/features/accounts/services/account-card-mutations';

export async function createAccountAction(data: {
  name: string;
  type: 'CHECKING' | 'SAVINGS' | 'CASH';
  initialBalanceRaw: string;
  color: string;
}) {
  const user = await requireAuthenticatedUser();
  const result = await createAccountForUser(user.id, data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/');
  return { ok: true };
}

/**
 * RF-02: Editar conta bancária ou carteira física (incluindo ajuste direto de Saldo Consolidado ou Saldo Inicial).
 */
export async function updateAccountAction(data: {
  id: string;
  name: string;
  type: 'CHECKING' | 'SAVINGS' | 'CASH';
  initialBalanceRaw?: string;
  targetCurrentBalanceRaw?: string;
  color: string;
}) {
  const user = await requireAuthenticatedUser();
  const result = await updateAccountForUser(user.id, data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/');
  return { ok: true };
}

/**
 * RN-03: Exclusão/Arquivamento seguro de conta bancária.
 */
export async function archiveOrDeleteAccountAction(accountId: string) {
  const user = await requireAuthenticatedUser();
  const result = await archiveOrDeleteAccountForUser(user.id, accountId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/');
  return result;
}

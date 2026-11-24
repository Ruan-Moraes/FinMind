'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/lib/prisma';
import { requireAuthenticatedUser } from '@/features/auth';
import { parseInputToCents } from '@/shared/lib/currency';
import {
  createCreditCardForUser,
  payCreditCardInvoiceForUser,
} from '@/features/accounts/services/account-card-mutations';

export async function createCreditCardAction(data: {
  name: string;
  brand: string;
  limitRaw: string;
  closingDay: number;
  dueDay: number;
  color: string;
}) {
  const user = await requireAuthenticatedUser();
  const result = await createCreditCardForUser(user.id, data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/');
  return { ok: true };
}

/**
 * RF-03: Editar Cartão de Crédito existente.
 */
export async function updateCreditCardAction(data: {
  id: string;
  name: string;
  brand: string;
  limitRaw: string;
  closingDay: number;
  dueDay: number;
  color: string;
}) {
  const user = await requireAuthenticatedUser();
  const limitInCents = parseInputToCents(data.limitRaw);

  if (!data.name.trim() || limitInCents <= 0) {
    return { ok: false, error: 'Informe nome e limite válido para o cartão.' };
  }

  await prisma.creditCard.updateMany({
    where: { id: data.id, userId: user.id },
    data: {
      name: data.name.trim(),
      brand: data.brand || 'Mastercard',
      limitInCents,
      closingDay: Math.min(31, Math.max(1, Number(data.closingDay) || 25)),
      dueDay: Math.min(31, Math.max(1, Number(data.dueDay) || 5)),
      color: data.color || '#6366f1',
    },
  });

  revalidatePath('/');
  return { ok: true };
}

export async function deleteCreditCardAction(id: string) {
  const user = await requireAuthenticatedUser();
  await prisma.creditCard.deleteMany({
    where: { id, userId: user.id },
  });
  revalidatePath('/');
  return { ok: true };
}

/**
 * RN-02: Pagamento de fatura de cartão de crédito debitando da conta bancária escolhida.
 */
export async function payCreditCardInvoiceAction(data: {
  creditCardId: string;
  month: number;
  year: number;
  sourceAccountId: string;
}) {
  const user = await requireAuthenticatedUser();
  const result = await payCreditCardInvoiceForUser(user.id, data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath('/');
  return { ok: true };
}

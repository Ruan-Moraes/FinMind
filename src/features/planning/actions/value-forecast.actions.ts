'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/lib/prisma';
import { requireAuthenticatedUser } from '@/features/auth';
import { parseInputToCents } from '@/shared/lib/currency';

function parseIsoDateNoonUtc(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return dt;
}

export async function createValueForecastItemAction(data: {
  title: string;
  type: 'INCOME' | 'EXPENSE';
  amountRaw: string;
  expectedDate: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuthenticatedUser();
  const title = data.title.trim();
  if (!title) return { ok: false, error: 'Informe uma descrição para a previsão.' };

  const amountInCents = parseInputToCents(data.amountRaw);
  if (amountInCents <= 0) {
    return { ok: false, error: 'Informe um valor maior que zero.' };
  }

  const expectedDate = parseIsoDateNoonUtc(data.expectedDate);
  if (!expectedDate) {
    return { ok: false, error: 'Informe uma data prevista válida.' };
  }

  await prisma.valueForecastItem.create({
    data: {
      userId: user.id,
      title,
      type: data.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
      amountInCents,
      expectedDate,
      notes: data.notes?.trim() || null,
    },
  });

  revalidatePath('/');
  return { ok: true };
}

export async function deleteValueForecastItemAction(id: string): Promise<{ ok: boolean }> {
  const user = await requireAuthenticatedUser();
  await prisma.valueForecastItem.deleteMany({ where: { id, userId: user.id } });
  revalidatePath('/');
  return { ok: true };
}

export async function createBalanceTargetCheckAction(data: {
  title: string;
  plannedBalanceRaw: string;
  targetDate: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuthenticatedUser();
  const title = data.title.trim();
  if (!title) return { ok: false, error: 'Informe um nome para a meta de saldo.' };

  const plannedBalanceInCents = parseInputToCents(data.plannedBalanceRaw);
  if (plannedBalanceInCents <= 0) {
    return { ok: false, error: 'Informe o valor de saldo planejado maior que zero.' };
  }

  const targetDate = parseIsoDateNoonUtc(data.targetDate);
  if (!targetDate) {
    return { ok: false, error: 'Informe o dia da meta.' };
  }

  await prisma.balanceTargetCheck.create({
    data: {
      userId: user.id,
      title,
      plannedBalanceInCents,
      targetDate,
      notes: data.notes?.trim() || null,
    },
  });

  revalidatePath('/');
  return { ok: true };
}

export async function deleteBalanceTargetCheckAction(id: string): Promise<{ ok: boolean }> {
  const user = await requireAuthenticatedUser();
  await prisma.balanceTargetCheck.deleteMany({ where: { id, userId: user.id } });
  revalidatePath('/');
  return { ok: true };
}

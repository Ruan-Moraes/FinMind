'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/lib/prisma';
import { parseInputToCents } from '@/shared/lib/currency';
import { requireAuthenticatedUser } from '@/features/auth';
import { syncUserFinancialKnowledge } from '@/features/ai-copilot/rag';
import {
  setMonthlyOverrideValue,
  toggleSkippedMonthList,
} from '@/features/planning/domain/recurrence-month-skip';
import {
  deleteCategoryForUser,
  deleteRecurrenceRuleForUser,
  saveCategoryForUser,
  saveRecurrenceRuleForUser,
} from '@/features/planning/services/planning-mutations';

export async function createRecurrenceRuleAction(data: {
  description: string;
  type: 'INCOME' | 'EXPENSE';
  nature: 'STATIC' | 'VARIABLE';
  amountRaw: string;
  dayOfMonth: number;
  dayType?: 'CALENDAR_DAY' | 'BUSINESS_DAY';
  includeSaturday?: boolean;
  categoryId?: string;
  accountId?: string;
}) {
  const user = await requireAuthenticatedUser();
  const result = await saveRecurrenceRuleForUser(user.id, data);
  if (!result.ok) return result;

  revalidatePath('/');
  return { ok: true };
}

export async function updateRecurrenceRuleAction(data: {
  id: string;
  description: string;
  type: 'INCOME' | 'EXPENSE';
  nature: 'STATIC' | 'VARIABLE';
  amountRaw: string;
  dayOfMonth: number;
  dayType?: 'CALENDAR_DAY' | 'BUSINESS_DAY';
  includeSaturday?: boolean;
  categoryId?: string;
  accountId?: string;
}) {
  const user = await requireAuthenticatedUser();
  const result = await saveRecurrenceRuleForUser(user.id, data);
  if (!result.ok) return result;

  revalidatePath('/');
  return { ok: true };
}

export async function deleteRecurrenceRuleAction(id: string) {
  const user = await requireAuthenticatedUser();
  await deleteRecurrenceRuleForUser(user.id, id);
  revalidatePath('/');
  return { ok: true };
}

export async function toggleRecurrenceRuleSkipMonthAction(data: {
  id: string;
  month: number;
  year: number;
}) {
  try {
    const user = await requireAuthenticatedUser();
    const rule = await prisma.recurrenceRule.findFirst({
      where: { id: data.id, userId: user.id },
    });
    if (!rule) return { ok: false, error: 'Regra fixa não encontrada.' };

    const { nextJson, isSkipped } = toggleSkippedMonthList(
      rule.skippedMonths,
      data.year,
      data.month
    );
    await prisma.recurrenceRule.update({
      where: { id: rule.id },
      data: { skippedMonths: nextJson },
    });

    await syncUserFinancialKnowledge(user.id).catch(() => undefined);
    revalidatePath('/');
    return { ok: true, isSkipped, ruleDescription: rule.description };
  } catch (err) {
    console.error('[toggleRecurrenceRuleSkipMonthAction]', err);
    return {
      ok: false,
      error: 'Não foi possível atualizar o status deste mês. Tente novamente.',
    };
  }
}

export async function setRecurrenceRuleMonthOverrideAction(data: {
  id: string;
  month: number;
  year: number;
  amountRaw: string | null;
}) {
  try {
    const user = await requireAuthenticatedUser();
    const rule = await prisma.recurrenceRule.findFirst({
      where: { id: data.id, userId: user.id },
    });
    if (!rule) return { ok: false, error: 'Regra fixa não encontrada.' };

    let nextAmount: number | null = null;
    if (data.amountRaw !== null && data.amountRaw.trim() !== '') {
      const parsedCents = parseInputToCents(data.amountRaw);
      if (parsedCents <= 0) {
        return { ok: false, error: 'Informe um valor maior que R$ 0,00.' };
      }
      nextAmount = parsedCents === rule.amountInCents ? null : parsedCents;
    }

    const { nextJson } = setMonthlyOverrideValue(
      rule.monthlyOverrides,
      data.year,
      data.month,
      nextAmount
    );

    await prisma.recurrenceRule.update({
      where: { id: rule.id },
      data: { monthlyOverrides: nextJson },
    });

    await syncUserFinancialKnowledge(user.id).catch(() => undefined);
    revalidatePath('/');
    return { ok: true, effectiveAmountInCents: nextAmount ?? rule.amountInCents };
  } catch (err) {
    console.error('[setRecurrenceRuleMonthOverrideAction]', err);
    return {
      ok: false,
      error: 'Não foi possível salvar o valor ajustado deste mês. Tente novamente.',
    };
  }
}

export async function createCategoryAction(data: {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  defaultNature: 'STATIC' | 'VARIABLE';
  color: string;
  icon?: string;
}) {
  const user = await requireAuthenticatedUser();
  const result = await saveCategoryForUser(user.id, data);
  if (!result.ok) return result;

  revalidatePath('/');
  return { ok: true };
}

export async function updateCategoryAction(data: {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  defaultNature: 'STATIC' | 'VARIABLE';
  color: string;
  icon?: string;
}) {
  const user = await requireAuthenticatedUser();
  const result = await saveCategoryForUser(user.id, data);
  if (!result.ok) return result;

  revalidatePath('/');
  return { ok: true };
}

export async function deleteCategoryAction(id: string) {
  const user = await requireAuthenticatedUser();
  await deleteCategoryForUser(user.id, id);
  revalidatePath('/');
  return { ok: true };
}

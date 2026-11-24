'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/features/auth';
import {
  deleteBudgetForUser,
  deletePortfolioGoalForUser,
  upsertBudgetForUser,
  upsertPortfolioGoalForUser,
} from '@/features/planning/services/planning-mutations';

export async function upsertPortfolioGoalAction(data: {
  id?: string;
  title: string;
  targetAmountRaw: string;
  targetMonth: number;
  targetYear: number;
  notes?: string;
}) {
  const user = await requireAuthenticatedUser();
  const result = await upsertPortfolioGoalForUser(user.id, data);
  if (!result.ok) return result;

  revalidatePath('/');
  return { ok: true };
}

export async function deletePortfolioGoalAction(id: string) {
  const user = await requireAuthenticatedUser();
  await deletePortfolioGoalForUser(user.id, id);
  revalidatePath('/');
  return { ok: true };
}

export async function upsertBudgetAction(data: {
  categoryId: string;
  month: number;
  year: number;
  maxAmountRaw: string;
}) {
  const user = await requireAuthenticatedUser();
  const result = await upsertBudgetForUser(user.id, data);
  if (!result.ok) return result;

  revalidatePath('/');
  return { ok: true };
}

export async function deleteBudgetAction(id: string) {
  const user = await requireAuthenticatedUser();
  await deleteBudgetForUser(user.id, id);
  revalidatePath('/');
  return { ok: true };
}

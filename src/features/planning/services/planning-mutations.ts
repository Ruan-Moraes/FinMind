import { prisma } from '@/shared/lib/prisma';
import { parseInputToCents } from '@/shared/lib/currency';
import { syncUserFinancialKnowledge } from '@/features/ai-copilot/rag';
import { logWarn } from '@/shared/lib/logger';
import {
  budgetSchema,
  categorySchema,
  extractFirstZodError,
  portfolioGoalSchema,
  recurrenceRuleSchema,
} from '@/features/planning/schemas/finance-schemas';

function syncKnowledgeSafe(userId: string) {
  return syncUserFinancialKnowledge(userId).catch((err) =>
    logWarn('PlanningMutations', 'Falha não-fatal ao sincronizar RAG', { userId, error: err })
  );
}

export async function upsertPortfolioGoalForUser(userId: string, raw: unknown) {
  const parsed = portfolioGoalSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: extractFirstZodError(parsed.error) };

  const data = parsed.data;
  const targetAmountInCents = parseInputToCents(data.targetAmountRaw);
  if (targetAmountInCents <= 0) {
    return { ok: false as const, error: 'Informe um título e valor alvo maior que zero.' };
  }

  if (data.id) {
    await prisma.portfolioGoal.updateMany({
      where: { id: data.id, userId },
      data: {
        title: data.title,
        targetAmountInCents,
        targetMonth: data.targetMonth,
        targetYear: data.targetYear,
        notes: data.notes?.trim() || null,
      },
    });
  } else {
    await prisma.portfolioGoal.create({
      data: {
        userId,
        title: data.title,
        targetAmountInCents,
        targetMonth: data.targetMonth,
        targetYear: data.targetYear,
        notes: data.notes?.trim() || null,
      },
    });
  }

  await syncKnowledgeSafe(userId);
  return { ok: true as const };
}

export async function deletePortfolioGoalForUser(userId: string, id: string) {
  await prisma.portfolioGoal.deleteMany({ where: { id, userId } });
  await syncKnowledgeSafe(userId);
  return { ok: true as const };
}

export async function upsertBudgetForUser(userId: string, raw: unknown) {
  const parsed = budgetSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: extractFirstZodError(parsed.error) };

  const data = parsed.data;
  const maxAmountInCents = parseInputToCents(data.maxAmountRaw);
  if (maxAmountInCents <= 0) {
    return { ok: false as const, error: 'Selecione uma categoria e um limite maior que zero.' };
  }

  await prisma.budget.upsert({
    where: {
      userId_categoryId_month_year: {
        userId,
        categoryId: data.categoryId,
        month: data.month,
        year: data.year,
      },
    },
    create: {
      userId,
      categoryId: data.categoryId,
      month: data.month,
      year: data.year,
      maxAmountInCents,
    },
    update: { maxAmountInCents },
  });

  await syncKnowledgeSafe(userId);
  return { ok: true as const };
}

export async function deleteBudgetForUser(userId: string, id: string) {
  await prisma.budget.deleteMany({ where: { id, userId } });
  await syncKnowledgeSafe(userId);
  return { ok: true as const };
}

export async function saveRecurrenceRuleForUser(userId: string, raw: unknown) {
  const parsed = recurrenceRuleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: extractFirstZodError(parsed.error) };

  const data = parsed.data;
  const amountInCents = parseInputToCents(data.amountRaw);
  if (amountInCents <= 0) {
    return { ok: false as const, error: 'Preencha a descrição e o valor corretamente.' };
  }

  const record = {
    description: data.description,
    type: data.type,
    nature: data.nature,
    amountInCents,
    dayOfMonth: data.dayOfMonth,
    dayType: data.dayType,
    includeSaturday: data.includeSaturday,
    categoryId: data.categoryId || null,
    accountId: data.accountId || null,
  };

  if (data.id) {
    await prisma.recurrenceRule.updateMany({ where: { id: data.id, userId }, data: record });
  } else {
    await prisma.recurrenceRule.create({ data: { userId, ...record } });
  }

  await syncKnowledgeSafe(userId);
  return { ok: true as const };
}

export async function deleteRecurrenceRuleForUser(userId: string, id: string) {
  await prisma.recurrenceRule.deleteMany({ where: { id, userId } });
  await syncKnowledgeSafe(userId);
  return { ok: true as const };
}

export async function saveCategoryForUser(userId: string, raw: unknown) {
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: extractFirstZodError(parsed.error) };

  const data = parsed.data;
  if (data.id) {
    await prisma.category.updateMany({
      where: { id: data.id, userId },
      data: {
        name: data.name,
        type: data.type,
        defaultNature: data.defaultNature,
        color: data.color || '#6366f1',
        ...(data.icon ? { icon: data.icon } : {}),
      },
    });
  } else {
    await prisma.category.create({
      data: {
        userId,
        name: data.name,
        type: data.type,
        defaultNature: data.defaultNature,
        color: data.color || '#6366f1',
        icon: data.icon || 'Tag',
      },
    });
  }

  return { ok: true as const };
}

export async function deleteCategoryForUser(userId: string, id: string) {
  await prisma.category.deleteMany({ where: { id, userId } });
  return { ok: true as const };
}

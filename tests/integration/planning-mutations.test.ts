import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import {
  upsertPortfolioGoalForUser,
  deletePortfolioGoalForUser,
  upsertBudgetForUser,
  deleteBudgetForUser,
  saveRecurrenceRuleForUser,
  deleteRecurrenceRuleForUser,
  saveCategoryForUser,
  deleteCategoryForUser,
} from '@/features/planning/services/planning-mutations';

const TEST_EMAIL = 'test.planning.mutations.vitest@finmind.local';

async function cleanupUser() {
  const u = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (!u) return;
  await prisma.budget.deleteMany({ where: { userId: u.id } });
  await prisma.portfolioGoal.deleteMany({ where: { userId: u.id } });
  await prisma.recurrenceRule.deleteMany({ where: { userId: u.id } });
  await prisma.category.deleteMany({ where: { userId: u.id } });
  await prisma.financialKnowledgeChunk.deleteMany({ where: { userId: u.id } });
  await prisma.user.delete({ where: { id: u.id } });
}

describe('Integração SQLite: Serviços de Planejamento (Metas, Orçamentos, Regras e Categorias)', () => {
  afterAll(cleanupUser);

  it('executa CRUD completo com validação Zod em PortfolioGoal, Budget, RecurrenceRule e Category', async () => {
    await cleanupUser();
    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, name: 'Teste Planning', passwordHash: 'hash' },
    });

    // 1. Category Create, Update & Zod rejection
    expect((await saveCategoryForUser(user.id, { name: '', type: 'EXPENSE', defaultNature: 'VARIABLE' })).ok).toBe(false);
    expect(
      (await saveCategoryForUser(user.id, {
        name: 'Educação Online',
        type: 'EXPENSE',
        defaultNature: 'STATIC',
        color: '#6366f1',
        icon: 'GraduationCap',
      })).ok
    ).toBe(true);

    const cat = await prisma.category.findFirst({ where: { userId: user.id, name: 'Educação Online' } });
    expect(cat).not.toBeNull();

    expect(
      (await saveCategoryForUser(user.id, {
        id: cat!.id,
        name: 'Educação & Cursos',
        type: 'EXPENSE',
        defaultNature: 'STATIC',
        color: '#8b5cf6',
      })).ok
    ).toBe(true);

    // 2. PortfolioGoal Create, Update & Delete
    expect((await upsertPortfolioGoalForUser(user.id, { title: 'Meta Zero', targetAmountRaw: '0', targetMonth: 12, targetYear: 2027 })).ok).toBe(false);
    expect(
      (await upsertPortfolioGoalForUser(user.id, {
        title: 'Viagem Europa',
        targetAmountRaw: '15000,00',
        targetMonth: 7,
        targetYear: 2027,
        notes: 'Passagens + hotel',
      })).ok
    ).toBe(true);

    const goal = await prisma.portfolioGoal.findFirst({ where: { userId: user.id } });
    expect(goal?.targetAmountInCents).toBe(1500000);

    expect(
      (await upsertPortfolioGoalForUser(user.id, {
        id: goal!.id,
        title: 'Viagem Europa Atualizada',
        targetAmountRaw: '18000,00',
        targetMonth: 8,
        targetYear: 2027,
      })).ok
    ).toBe(true);
    expect((await deletePortfolioGoalForUser(user.id, goal!.id)).ok).toBe(true);

    // 3. Budget Upsert (create + update) & Delete
    expect((await upsertBudgetForUser(user.id, { categoryId: cat!.id, month: 11, year: 2026, maxAmountRaw: '0' })).ok).toBe(false);
    expect((await upsertBudgetForUser(user.id, { categoryId: cat!.id, month: 11, year: 2026, maxAmountRaw: '500,00' })).ok).toBe(true);
    expect((await upsertBudgetForUser(user.id, { categoryId: cat!.id, month: 11, year: 2026, maxAmountRaw: '750,00' })).ok).toBe(true);

    const budget = await prisma.budget.findFirst({ where: { userId: user.id, categoryId: cat!.id } });
    expect(budget?.maxAmountInCents).toBe(75000);
    expect((await deleteBudgetForUser(user.id, budget!.id)).ok).toBe(true);

    // 4. RecurrenceRule Create, Update & Delete
    expect((await saveRecurrenceRuleForUser(user.id, { description: 'X', type: 'EXPENSE', nature: 'STATIC', amountRaw: '0', dayOfMonth: 5 })).ok).toBe(false);
    expect(
      (await saveRecurrenceRuleForUser(user.id, {
        description: 'Faculdade EAD',
        type: 'EXPENSE',
        nature: 'STATIC',
        amountRaw: '380,00',
        dayOfMonth: 10,
        categoryId: cat!.id,
      })).ok
    ).toBe(true);

    const rule = await prisma.recurrenceRule.findFirst({ where: { userId: user.id } });
    expect(rule?.amountInCents).toBe(38000);

    expect(
      (await saveRecurrenceRuleForUser(user.id, {
        id: rule!.id,
        description: 'Faculdade EAD Reajustada',
        type: 'EXPENSE',
        nature: 'STATIC',
        amountRaw: '400,00',
        dayOfMonth: 12,
        categoryId: cat!.id,
      })).ok
    ).toBe(true);

    expect((await deleteRecurrenceRuleForUser(user.id, rule!.id)).ok).toBe(true);
    expect((await deleteCategoryForUser(user.id, cat!.id)).ok).toBe(true);
  });
});

import { test, expect } from '@playwright/test';
import { prisma } from '@/shared/lib/prisma';

test.describe('E2E: Ciclo Completo (Criar → Editar → Excluir) de Metas e Regras Estáticas', () => {
  test.afterAll(async () => {
    await prisma.portfolioGoal.deleteMany({
      where: { title: { startsWith: 'E2E Meta Ciclo ' } },
    });
    await prisma.recurrenceRule.deleteMany({
      where: { description: { startsWith: 'E2E Regra Ciclo ' } },
    });
  });

  test('cria, edita e exclui com confirmação uma Meta de Carteira e uma Regra Estática', async ({
    page,
  }) => {
    await page.goto('/');
    const suffix = Date.now().toString().slice(-4);
    const goalOriginal = `E2E Meta Ciclo ${suffix}`;
    const goalEdited = `E2E Meta Ciclo Editada ${suffix}`;
    const ruleOriginal = `E2E Regra Ciclo ${suffix}`;
    const ruleEdited = `E2E Regra Ciclo Editada ${suffix}`;

    await page.getByRole('button', { name: /Meta de Carteira & Custos Estáticos/i }).click();

    // 1. Criar Meta
    await page.getByRole('button', { name: /Definir Meta de Carteira/i }).click();
    await page.getByPlaceholder('Ex: Meta de R$ 7.000 na Carteira').fill(goalOriginal);
    await page.getByRole('button', { name: 'Salvar Meta' }).click();
    await expect(page.locator('main')).toContainText(goalOriginal, { timeout: 15000 });

    // 2. Editar Meta
    const goalCard = page.locator('main div.rounded-2xl', { hasText: goalOriginal }).last();
    await goalCard.locator('button[title="Editar meta"]').click();
    await page.getByPlaceholder('Ex: Meta de R$ 7.000 na Carteira').fill(goalEdited);
    await page.getByRole('button', { name: /Salvar Alterações|Salvar Meta/i }).click();
    await expect(page.locator('main')).toContainText(goalEdited, { timeout: 15000 });

    // 3. Excluir Meta via modal de confirmação
    const editedGoalCard = page.locator('main div.rounded-2xl', { hasText: goalEdited }).last();
    await editedGoalCard.locator('button[title="Excluir meta"]').click();
    await page.getByRole('button', { name: /Sim, Excluir|Confirmar Exclusão/i }).click();
    await expect(page.locator('main')).not.toContainText(goalEdited, { timeout: 15000 });

    // 4. Criar Regra Estática
    await page.getByRole('button', { name: /Novo Custo Estático/i }).click();
    await page.getByPlaceholder('Ex: Salário Fixo, Aluguel, Financiamento, Internet...').fill(ruleOriginal);
    await page.getByPlaceholder('1500,00').fill('150,00');
    await page.getByRole('button', { name: 'Salvar Regra Fixa' }).click();
    await expect(page.locator('main')).toContainText(ruleOriginal, { timeout: 15000 });

    // 5. Editar Regra Estática via menu contextual (⋯)
    const ruleRow = page.locator('tbody tr', { hasText: ruleOriginal }).first();
    await ruleRow.getByRole('button', { name: `Ações para ${ruleOriginal}` }).click();
    await page.getByRole('menuitem', { name: /Editar regra fixa/i }).click();
    await page.getByPlaceholder('Ex: Salário Fixo, Aluguel, Financiamento, Internet...').fill(ruleEdited);
    await page.getByRole('button', { name: /Salvar Alterações|Salvar Regra Fixa/i }).click();
    await expect(page.locator('main')).toContainText(ruleEdited, { timeout: 15000 });

    // 6. Excluir Regra Estática via menu contextual (⋯)
    const editedRuleRow = page.locator('tbody tr', { hasText: ruleEdited }).first();
    await editedRuleRow.getByRole('button', { name: `Ações para ${ruleEdited}` }).click();
    await page.getByRole('menuitem', { name: /Excluir regra/i }).click();
    await page.getByRole('button', { name: /Sim, Excluir|Confirmar Exclusão/i }).click();
    await expect(page.locator('main')).not.toContainText(ruleEdited, { timeout: 15000 });
  });
});

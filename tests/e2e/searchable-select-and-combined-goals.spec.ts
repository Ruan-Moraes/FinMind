import { test, expect } from '@playwright/test';

test.describe('E2E: Select Pesquisável Global & Simulador de Metas Juntas', () => {
  test('filtra opções por texto no combobox customizado e simula ritmo nas Metas Juntas', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Testar Select pesquisável customizado na aba Extrato & Comprovantes
    await page.getByRole('button', { name: /Extrato & Comprovantes/i }).click();
    const typeCombo = page.locator('main').getByRole('combobox').first();
    await expect(typeCombo).toBeVisible();
    await typeCombo.click();

    const searchInput = page.getByPlaceholder('Pesquisar...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Despesas');

    await page.getByRole('option', { name: 'Apenas Despesas' }).click();
    await expect(typeCombo).toContainText('Apenas Despesas');

    // Restaurar para Todos os Tipos
    await typeCombo.click();
    await page.getByRole('option', { name: 'Todos os Tipos' }).click();
    await expect(typeCombo).toContainText('Todos os Tipos');

    // 2. Testar Metas Juntas + Simulador na aba Meta de Carteira & Custos Estáticos
    await page.getByRole('button', { name: /Meta de Carteira & Custos Estáticos/i }).click();

    const combinedHeading = page.getByText('Metas Juntas — Projeção Consolidada');
    let createdTempGoal = false;
    const tempGoalTitle = `E2E Meta Simulador ${Date.now().toString().slice(-4)}`;

    if ((await combinedHeading.count()) === 0) {
      await page.getByRole('button', { name: /Definir Meta de Carteira/i }).click();
      await page.locator('[data-agent-id="modal.goal.input.title"]').fill(tempGoalTitle);
      await page.locator('[data-agent-id="modal.goal.input.targetAmount"]').fill('10000,00');
      await page.getByRole('button', { name: /Salvar Meta/i }).click();
      createdTempGoal = true;
    }

    await expect(combinedHeading).toBeVisible();

    const extraIncome = page.locator('#sim-extra-monthly-income');
    const extraExpense = page.locator('#sim-extra-monthly-expense');
    await extraIncome.fill('1000,00');
    await extraExpense.fill('200,00');
    await expect(page.getByRole('button', { name: 'Limpar' })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar' }).click();
    await expect(extraIncome).toHaveValue('');

    // Limpar meta temporária se criada neste teste
    if (createdTempGoal) {
      const card = page.locator('div.rounded-2xl').filter({ hasText: tempGoalTitle }).first();
      await card.getByTitle('Excluir meta').click();
      await page.getByRole('button', { name: 'Sim, Excluir Meta' }).click();
      await expect(page.getByText(tempGoalTitle)).toHaveCount(0);
    }
  });
});

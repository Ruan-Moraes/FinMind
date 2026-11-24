import { test, expect } from '@playwright/test';

test.describe('E2E: Meta Fictícia com Base na Aba Previsão de Valor', () => {
  test('exibe cenário fictício nas metas quando há previsão cadastrada e volta ao normal ao remover', async ({
    page,
  }) => {
    await page.goto('/');
    const suffix = Date.now().toString().slice(-4);
    const goalTitle = `E2E Meta Prev ${suffix}`;
    const forecastTitle = `E2E Bonus Prev ${suffix}`;

    // 1. Criar uma Meta de Carteira
    await page.getByRole('button', { name: /Meta de Carteira & Custos Estáticos/i }).click();
    await page.getByRole('button', { name: /Definir Meta de Carteira/i }).click();
    await page.locator('[data-agent-id="modal.goal.input.title"]').fill(goalTitle);
    await page.locator('[data-agent-id="modal.goal.input.targetAmount"]').fill('50000,00');
    await page.locator('[data-agent-id="modal.goal.btn.submit"]').click();
    await expect(page.getByText(goalTitle)).toBeVisible({ timeout: 10000 });

    // 2. Cadastrar um ganho futuro na aba Previsão de Valor
    await page.locator('[data-agent-id="nav.tab.forecast"]').click();
    await page.locator('[data-agent-id="forecast.btn.addIncome"]').click();
    await page.locator('#forecast-title').fill(forecastTitle);
    await page.locator('#forecast-amount').fill('5000,00');
    await page.getByRole('button', { name: 'Adicionar Ganho Previsto' }).click();
    await expect(page.getByText(forecastTitle)).toBeVisible({ timeout: 10000 });

    // 3. Voltar para Meta de Carteira e validar Meta Fictícia (Com Previsão de Valor) e Cenário Consolidado
    await page.locator('[data-agent-id="nav.tab.goals"]').click();
    await expect(page.getByText('Cenário Fictício Consolidado (Com Previsão de Valor)')).toBeVisible();
    await expect(page.getByText('Meta Fictícia (Com Previsão de Valor)').first()).toBeVisible();

    // 4. Limpar o item de previsão e a meta criados no teste
    await page.locator('[data-agent-id="nav.tab.forecast"]').click();
    const forecastRow = page
      .locator('div')
      .filter({ hasText: forecastTitle })
      .filter({ has: page.getByTitle('Excluir previsão') })
      .last();
    await forecastRow.getByTitle('Excluir previsão').first().click();
    await page.getByRole('button', { name: 'Sim, Excluir Previsão' }).click();
    await expect(page.getByText(forecastTitle)).toHaveCount(0);

    await page.locator('[data-agent-id="nav.tab.goals"]').click();
    const goalCard = page
      .locator('div.rounded-2xl')
      .filter({ hasText: goalTitle })
      .filter({ has: page.getByTitle('Excluir meta') })
      .last();
    await goalCard.getByTitle('Excluir meta').first().click();
    await page.getByRole('button', { name: 'Sim, Excluir Meta' }).click();
    await expect(page.getByText(goalTitle)).toHaveCount(0);
  });
});

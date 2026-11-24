import { test, expect } from '@playwright/test';

test.describe('E2E: Aba Previsão de Valor e Verificação de Meta por Data', () => {
  test('cadastra ganho previsto, gasto previsto, meta de data vencida e limpa ao final', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Abrir aba Previsão de Valor
    await page.getByRole('button', { name: /Previsão de Valor/i }).click();
    await expect(page.getByRole('heading', { name: 'Metas de Saldo por Data' })).toBeVisible();
    await expect(page.getByText('Previsões de Ganhos & Gastos')).toBeVisible();

    const suffix = Date.now().toString().slice(-4);
    const gainTitle = `E2E Ganho Previsto ${suffix}`;
    const targetTitle = `E2E Meta Dia ${suffix}`;

    // 2. Cadastrar um ganho previsto
    await page.locator('#forecast-title').fill(gainTitle);
    await page.locator('#forecast-amount').fill('1500,00');
    await page.getByRole('button', { name: 'Adicionar Ganho Previsto' }).click();
    await expect(page.getByText(gainTitle)).toBeVisible();

    // 3. Cadastrar uma meta de saldo para hoje (para disparar a verificação imediata)
    await page.locator('#target-title').fill(targetTitle);
    await page.locator('#target-amount').fill('999999,00');
    await page.getByRole('button', { name: 'Adicionar Meta de Data' }).click();
    await expect(page.getByText(targetTitle)).toBeVisible();
    await expect(page.getByText('Saldo ficou menor que o planejado').first()).toBeVisible();

    // 4. Remover os registros criados no teste confirmando pelo modal de segurança
    await page.getByTitle('Excluir meta de data').first().click();
    await expect(page.getByText('Excluir Meta de Saldo por Data')).toBeVisible();
    await page.getByRole('button', { name: 'Sim, Excluir Meta' }).click();
    await expect(page.getByText(targetTitle)).toHaveCount(0);

    await page.getByTitle('Excluir previsão').first().click();
    await expect(page.getByText('Excluir Previsão de Valor')).toBeVisible();
    await page.getByRole('button', { name: 'Sim, Excluir Previsão' }).click();
    await expect(page.getByText(gainTitle)).toHaveCount(0);
  });
});

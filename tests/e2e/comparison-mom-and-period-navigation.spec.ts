import { test, expect } from '@playwright/test';

test.describe('E2E: Navegação de Período (URL Sync) & Comparativo Entre Meses (MoM)', () => {
  test('alterna período no Header sincronizando URL e compara dois meses na aba MoM', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Alterar Mês no seletor desktop do Header e validar URL
    const monthSelect = page.getByLabel('Selecionar Mês', { exact: true });
    await expect(monthSelect).toBeVisible();
    await monthSelect.selectOption('10');
    await expect(page).toHaveURL(/month=10/);

    // 2. Navegar para Comparativo Entre Meses
    await page.getByRole('button', { name: /Comparativo Entre Meses/i }).click();
    await expect(page.locator('main')).toContainText(/Comparativo/i);
    await expect(page.locator('main')).toContainText(/Despesas|Receitas|Categoria/i);

    // 3. Retornar para mês 11 e validar sincronização
    await monthSelect.selectOption('11');
    await expect(page).toHaveURL(/month=11/);
  });
});

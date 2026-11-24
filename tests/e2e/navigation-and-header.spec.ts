import { test, expect } from '@playwright/test';
import { ensureValuesVisible } from '../helpers/e2e-ui';

test.describe('E2E: Navegação entre Abas, Seletor de Período, Tema e Modo Privacidade', () => {
  test('carrega o workbench principal, navega pelas 6 abas e alterna privacidade e tema', async ({
    page,
  }) => {
    await page.goto('/');

    // Verifica cabeçalho principal FinMind
    await expect(page.locator('header')).toContainText('FinMind');
    await expect(page.getByRole('button', { name: /Visão Geral/i })).toBeVisible();

    // 1. Aba Visão Geral (ativa por padrão)
    await expect(page.locator('main')).toContainText(/Saldo em Contas|Patrimônio Líquido Atual/i);

    // 2. Alternar Modo Privacidade (R$ ••••••)
    await ensureValuesVisible(page);
    const privacyBtn = page.getByRole('button', { name: 'Alternar Modo Privacidade' });
    await privacyBtn.click();
    await expect(page.locator('main')).toContainText('••••');
    await privacyBtn.click();

    // 3. Alternar Tema Claro/Escuro
    const themeBtn = page.getByRole('button', { name: 'Alternar Tema' });
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();

    // 4. Navegar para Aba Comparativo Entre Meses
    await page.getByRole('button', { name: /Comparativo Entre Meses/i }).click();
    await expect(page.locator('main')).toContainText(/Comparativo/i);

    // 5. Navegar para Aba Meta de Carteira & Custos Estáticos
    await page.getByRole('button', { name: /Meta de Carteira & Custos Estáticos/i }).click();
    await expect(page.locator('main')).toContainText(/Custos|Recorrente|Meta/i);

    // 6. Navegar para Aba Contas & Cartões
    await page.getByRole('button', { name: /Contas & Cartões/i }).click();
    await expect(page.locator('main')).toContainText(/Contas Bancárias & Carteira em Mãos/i);

    // 7. Navegar para Aba Extrato & Comprovantes
    await page.getByRole('button', { name: /Extrato & Comprovantes/i }).click();
    await expect(page.locator('main')).toContainText(/Extrato|Lançamento/i);

    // 8. Navegar para Aba Copiloto IA & Extrato
    await page.getByRole('button', { name: /Copiloto IA & Extrato/i }).click();
    await expect(page.locator('main')).toContainText(
      /Importação & Conciliação Inteligente de Extratos com IA/i
    );
  });
});

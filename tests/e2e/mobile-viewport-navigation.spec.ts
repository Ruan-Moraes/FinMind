import { test, expect } from '@playwright/test';

test.describe('E2E: Responsividade Mobile — Bottom Nav, Período Mobile e FAB', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renderiza navegação inferior mobile, alterna abas e abre Novo Lançamento pelo FAB', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Verificar seletores de período mobile
    await expect(page.getByLabel('Selecionar Mês Mobile')).toBeVisible();
    await expect(page.getByLabel('Selecionar Ano Mobile')).toBeVisible();

    // 2. Verificar barra de navegação inferior mobile
    const mobileNav = page.locator('nav');
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole('button', { name: 'Início' })).toBeVisible();
    await expect(mobileNav.getByRole('button', { name: 'IA' })).toBeVisible();
    await expect(mobileNav.getByRole('button', { name: 'Metas' })).toBeVisible();
    await expect(mobileNav.getByRole('button', { name: 'Contas' })).toBeVisible();
    await expect(mobileNav.getByRole('button', { name: 'Extrato' })).toBeVisible();

    // 3. Navegar para Contas e IA pela barra mobile
    await mobileNav.getByRole('button', { name: 'Contas' }).click();
    await expect(page.locator('main')).toContainText(/Contas Bancárias/i);

    await mobileNav.getByRole('button', { name: 'IA' }).click();
    await expect(page.locator('main')).toContainText(/Conciliação Inteligente/i);

    // 4. Abrir modal de Novo Lançamento pelo botão flutuante mobile (+ Lançar)
    await page.getByRole('button', { name: 'Novo Lançamento' }).click();
    await expect(page.getByText('Novo Lançamento Financeiro')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { prisma } from '@/shared/lib/prisma';

test.describe('E2E: Modais Financeiros (Nova Conta, Novo Lançamento e Configurações)', () => {
  const createdNames: string[] = [];

  test.afterAll(async () => {
    if (createdNames.length > 0) {
      await prisma.transaction.deleteMany({
        where: { description: { in: createdNames } },
      });
      await prisma.account.deleteMany({
        where: { name: { in: createdNames } },
      });
    }
    // Remove eventuais contas/transações de execuções anteriores de E2E
    await prisma.transaction.deleteMany({
      where: { description: { startsWith: 'Compra E2E ' } },
    });
    await prisma.account.deleteMany({
      where: { name: { startsWith: 'Conta E2E ' } },
    });
  });

  test('abre e cria uma Nova Conta e um Novo Lançamento via modais interativos', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Ir até Contas & Cartões e abrir modal "Nova Conta"
    await page.getByRole('button', { name: /Contas & Cartões/i }).click();
    await page.getByRole('button', { name: 'Nova Conta' }).first().click();

    await expect(page.getByText('Nova Conta ou Carteira')).toBeVisible();
    const uniqueAccName = `Conta E2E ${Date.now().toString().slice(-4)}`;
    createdNames.push(uniqueAccName);

    await page
      .getByPlaceholder('Ex: Itaú, Nubank, Carteira Física...')
      .fill(uniqueAccName);
    await page.getByRole('button', { name: 'Criar Conta' }).click();

    // Verifica que a nova conta apareceu na listagem de contas
    await expect(page.locator('main')).toContainText(uniqueAccName, { timeout: 15000 });

    // 2. Abrir modal "Novo Lançamento" no Header
    await page.getByRole('button', { name: /Novo Lançamento/i }).first().click();
    await expect(page.getByText('Novo Lançamento Financeiro')).toBeVisible();

    const uniqueTxDesc = `Compra E2E ${Date.now().toString().slice(-4)}`;
    createdNames.push(uniqueTxDesc);

    await page.locator('#tx-amount').fill('125,50');
    await page.locator('#tx-desc').fill(uniqueTxDesc);
    await page.getByRole('button', { name: 'Salvar Lançamento' }).click();

    // 3. Abrir e fechar modal de Configurações no Header
    const settingsBtn = page.getByRole('button', { name: 'Abrir Configurações' });
    await settingsBtn.click();
    await expect(page.getByText(/Configurações|Preferências/i).first()).toBeVisible();
  });
});

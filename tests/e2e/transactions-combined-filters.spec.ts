import { test, expect } from '@playwright/test';
import { prisma } from '@/shared/lib/prisma';

test.describe('E2E: Filtros Combinados no Extrato (Tipo, Natureza e #Tag)', () => {
  test.afterAll(async () => {
    await prisma.transaction.deleteMany({
      where: { description: { startsWith: 'E2E Filtro ' } },
    });
  });

  test('filtra lançamentos por tipo, natureza estática/variável e busca por tag', async ({
    page,
  }) => {
    await page.goto('/');
    const suffix = Date.now().toString().slice(-4);
    const incomeDesc = `E2E Filtro Salario ${suffix}`;
    const expenseDesc = `E2E Filtro Lanche ${suffix}`;

    // 1. Criar Receita Estática com tag única
    await page.getByRole('button', { name: /Novo Lançamento/i }).first().click();
    await page.locator('#form-new-tx').getByRole('button', { name: /Receita/i }).click();
    await page.locator('#tx-amount').fill('3500,00');
    await page.locator('#tx-desc').fill(incomeDesc);
    await page.locator('#form-new-tx').getByRole('button', { name: /Estático/i }).first().click();
    await page.getByPlaceholder('mercado, carro, fixo').fill(`salario${suffix}`);
    await page.getByRole('button', { name: 'Salvar Lançamento' }).click();
    await expect(page.getByText('Novo Lançamento Financeiro')).toBeHidden({ timeout: 10000 });

    // 2. Criar Despesa Variável com tag única
    await page.getByRole('button', { name: /Novo Lançamento/i }).first().click();
    await page.locator('#tx-amount').fill('48,50');
    await page.locator('#tx-desc').fill(expenseDesc);
    await page.getByPlaceholder('mercado, carro, fixo').fill(`lanche${suffix}`);
    await page.getByRole('button', { name: 'Salvar Lançamento' }).click();
    await expect(page.getByText('Novo Lançamento Financeiro')).toBeHidden({ timeout: 10000 });

    // 3. Navegar para Extrato & Comprovantes e aplicar filtros combinados
    await page.getByRole('button', { name: /Extrato & Comprovantes/i }).click();
    const searchInput = page.getByPlaceholder('Buscar descrição ou #tag...');
    const filterSelects = page.locator('main select');

    // Filtrar por prefixo comum -> ambos aparecem
    await searchInput.fill(`E2E Filtro `);
    await expect(page.locator('tbody')).toContainText(incomeDesc, { timeout: 15000 });
    await expect(page.locator('tbody')).toContainText(expenseDesc);

    // Filtrar Tipo = INCOME -> apenas receita aparece
    await filterSelects.nth(0).selectOption('INCOME');
    await expect(page.locator('tbody')).toContainText(incomeDesc);
    await expect(page.locator('tbody')).not.toContainText(expenseDesc);

    // Filtrar Tipo = ALL e Natureza = VARIABLE -> apenas despesa aparece
    await filterSelects.nth(0).selectOption('ALL');
    await filterSelects.nth(1).selectOption('VARIABLE');
    await expect(page.locator('tbody')).toContainText(expenseDesc);
    await expect(page.locator('tbody')).not.toContainText(incomeDesc);

    // Buscar pela tag específica da despesa
    await filterSelects.nth(1).selectOption('ALL');
    await searchInput.fill(`lanche${suffix}`);
    await expect(page.locator('tbody')).toContainText(expenseDesc);
    await expect(page.locator('tbody')).not.toContainText(incomeDesc);
  });
});

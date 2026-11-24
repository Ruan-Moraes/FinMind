import { test, expect } from '@playwright/test';
import { ensureValuesVisible } from '../helpers/e2e-ui';
import { prisma } from '@/shared/lib/prisma';

test.describe('E2E: Categorias Personalizadas & Limites Mensais (Orçamentos)', () => {
  test.afterAll(async () => {
    const cats = await prisma.category.findMany({
      where: { name: { startsWith: 'E2E Cat ' } },
      select: { id: true },
    });
    const catIds = cats.map((c) => c.id);
    if (catIds.length > 0) {
      await prisma.budget.deleteMany({ where: { categoryId: { in: catIds } } });
      await prisma.category.deleteMany({ where: { id: { in: catIds } } });
    }
  });

  test('cria categoria personalizada e define limite mensal de orçamento para ela', async ({
    page,
  }) => {
    await page.goto('/');
    await ensureValuesVisible(page);
    const suffix = Date.now().toString().slice(-4);
    const catName = `E2E Cat Hobbies ${suffix}`;

    // 1. Navegar para Meta de Carteira & Custos Estáticos
    await page.getByRole('button', { name: /Meta de Carteira & Custos Estáticos/i }).click();

    // 2. Criar Nova Categoria de Gasto
    await page.getByRole('button', { name: /\+ Nova Categoria|Nova Categoria de Gasto/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Nova Categoria' })).toBeVisible();
    await page.locator('#form-category input').first().fill(catName);
    await page.getByRole('button', { name: /Criar Categoria|Salvar Categoria/i }).click();

    await expect(page.locator('main')).toContainText(catName, { timeout: 15000 });

    // 3. Definir Limite Mensal (Orçamento) para a categoria recém-criada
    await page.getByRole('button', { name: /\+ Definir Limite Mensal/i }).click();
    await expect(page.getByText('Definir ou Editar Limite por Categoria')).toBeVisible();
    await page.locator('#form-budget button', { hasText: catName }).click();
    await page.locator('#form-budget input').first().fill('600,00');
    await page.getByRole('button', { name: 'Salvar Limite' }).click();

    await expect(page.locator('main')).toContainText('600,00', { timeout: 15000 });
  });
});

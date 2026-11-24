import { test, expect } from '@playwright/test';
import { prisma } from '@/shared/lib/prisma';

test.describe('E2E: CRUD de Metas de Carteira, Regras Estáticas e Cartões de Crédito', () => {
  test.afterAll(async () => {
    await prisma.portfolioGoal.deleteMany({
      where: { title: { startsWith: 'E2E Meta ' } },
    });
    await prisma.recurrenceRule.deleteMany({
      where: { description: { startsWith: 'E2E Regra ' } },
    });
    await prisma.creditCard.deleteMany({
      where: { name: { startsWith: 'E2E Cartao ' } },
    });
  });

  test('cria Meta de Carteira, Regra Estática e Cartão de Crédito via modais', async ({
    page,
  }) => {
    await page.goto('/');
    const suffix = Date.now().toString().slice(-4);

    // 1. Navegar para Meta de Carteira & Custos Estáticos
    await page.getByRole('button', { name: /Meta de Carteira & Custos Estáticos/i }).click();

    // Criar Meta de Carteira
    await page.getByRole('button', { name: /Definir Meta de Carteira/i }).click();
    const goalTitle = `E2E Meta Viagem ${suffix}`;
    await page
      .getByPlaceholder('Ex: Meta de R$ 7.000 na Carteira')
      .fill(goalTitle);
    await page.getByRole('button', { name: 'Salvar Meta' }).click();
    await expect(page.locator('main')).toContainText(goalTitle, { timeout: 15000 });

    // Criar Custo Estático
    await page.getByRole('button', { name: /Novo Custo Estático/i }).click();
    const ruleDesc = `E2E Regra Fibra ${suffix}`;
    await page
      .getByPlaceholder('Ex: Salário Fixo, Aluguel, Financiamento, Internet...')
      .fill(ruleDesc);
    await page.getByPlaceholder('1500,00').fill('149,90');
    await page.getByRole('button', { name: 'Salvar Regra Fixa' }).click();
    await expect(page.locator('main')).toContainText(ruleDesc, { timeout: 15000 });

    // 2. Navegar para Contas & Cartões e criar Novo Cartão
    await page.getByRole('button', { name: /Contas & Cartões/i }).click();
    await page.getByRole('button', { name: /Novo Cartão/i }).click();
    const cardName = `E2E Cartao Black ${suffix}`;
    await page.getByPlaceholder('Ex: Nubank, XP Visa Infinite...').fill(cardName);
    await page.getByRole('button', { name: 'Salvar Cartão' }).click();
    await expect(page.locator('main')).toContainText(cardName, { timeout: 15000 });
  });
});

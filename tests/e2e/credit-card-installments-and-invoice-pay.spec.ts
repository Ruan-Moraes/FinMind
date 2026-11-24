import { test, expect } from '@playwright/test';
import { prisma } from '@/shared/lib/prisma';

test.describe('E2E: Cartão Parcelado (RN-01) & Quitação de Fatura (RN-02)', () => {
  test.afterAll(async () => {
    const cards = await prisma.creditCard.findMany({
      where: { name: { startsWith: 'E2E Fatura Card ' } },
      select: { id: true, name: true },
    });
    const cardIds = cards.map((c) => c.id);
    if (cardIds.length > 0) {
      await prisma.transaction.deleteMany({
        where: {
          OR: [
            { creditCardId: { in: cardIds } },
            { description: { startsWith: 'Pagamento Fatura E2E Fatura Card ' } },
          ],
        },
      });
      await prisma.installmentGroup.deleteMany({
        where: { description: { startsWith: 'E2E Compra Parcelada ' } },
      });
      await prisma.creditCardInvoice.deleteMany({
        where: { creditCardId: { in: cardIds } },
      });
      await prisma.creditCard.deleteMany({ where: { id: { in: cardIds } } });
    }
  });

  test('cria cartão, lança compra parcelada em 3x e quita a fatura do mês pela interface', async ({
    page,
  }) => {
    await page.goto('/');
    const suffix = Date.now().toString().slice(-4);
    const cardName = `E2E Fatura Card ${suffix}`;
    const purchaseDesc = `E2E Compra Parcelada ${suffix}`;

    // 1. Criar cartão com fechamento dia 28 para compra do dia 10 cair no mês vigente
    await page.getByRole('button', { name: /Contas & Cartões/i }).click();
    await page.getByRole('button', { name: /Novo Cartão/i }).click();
    await page.getByPlaceholder('Ex: Nubank, XP Visa Infinite...').fill(cardName);
    await page.getByRole('button', { name: 'Salvar Cartão' }).click();
    await expect(page.locator('main')).toContainText(cardName, { timeout: 15000 });

    // 2. Lançar despesa parcelada em 3x no cartão criado
    await page.getByRole('button', { name: /Novo Lançamento/i }).first().click();
    await page.locator('#tx-amount').fill('300,00');
    // Usar dia 10 do mês atual (sempre antes do fechamento padrão dia 25)
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-10`;
    await page.locator('#tx-date').fill(ym);
    await page.locator('#tx-desc').fill(purchaseDesc);
    await page.getByRole('button', { name: 'Cartão de Crédito', exact: true }).click();

    // Selecionar o cartão recém-criado
    const cardSelect = page.locator('#form-new-tx select').filter({ hasText: cardName }).first();
    const matchingOption = await cardSelect.locator('option', { hasText: cardName }).getAttribute('value');
    if (matchingOption) {
      await cardSelect.selectOption(matchingOption);
    }

    await page.getByRole('button', { name: 'Salvar Lançamento' }).click();

    // 3. Verificar botão "Pagar Fatura" no cartão e confirmar quitação
    const cardBox = page.locator('main div.rounded-2xl', { hasText: cardName }).last();
    const payBtn = cardBox.getByRole('button', { name: /Pagar Fatura/i });
    await expect(payBtn).toBeVisible({ timeout: 15000 });
    await payBtn.click();

    await expect(page.getByText(`Pagar Fatura - ${cardName}`)).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar Pagamento' }).click();

    // 4. Validar que a fatura mudou para status Paga
    await expect(cardBox).toContainText(/Paga/i, { timeout: 15000 });
  });
});

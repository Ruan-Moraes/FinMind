import { test, expect } from '@playwright/test';
import { ensureValuesVisible } from '../helpers/e2e-ui';
import { prisma } from '@/shared/lib/prisma';

test.describe('E2E: Transferência Entre Contas & Recalibração Direta de Saldo (RF-02)', () => {
  test.afterAll(async () => {
    const accounts = await prisma.account.findMany({
      where: {
        OR: [
          { name: { startsWith: 'E2E Origem ' } },
          { name: { startsWith: 'E2E Destino ' } },
        ],
      },
      select: { id: true },
    });
    const ids = accounts.map((a) => a.id);
    if (ids.length > 0) {
      await prisma.transaction.deleteMany({
        where: {
          OR: [{ sourceAccountId: { in: ids } }, { destinationAccountId: { in: ids } }],
        },
      });
      await prisma.account.deleteMany({ where: { id: { in: ids } } });
    }
  });

  test('transfere valor entre duas contas e recalibra saldo consolidado diretamente', async ({
    page,
  }) => {
    await page.goto('/');
    await ensureValuesVisible(page);
    const suffix = Date.now().toString().slice(-4);
    const originName = `E2E Origem ${suffix}`;
    const destName = `E2E Destino ${suffix}`;

    // 1. Criar duas contas em Contas & Cartões
    await page.getByRole('button', { name: /Contas & Cartões/i }).click();

    await page.getByRole('button', { name: /Nova Conta/i }).click();
    await page.getByPlaceholder('Ex: Itaú, Nubank, Carteira Física...').fill(originName);
    await page.locator('#form-account input:not([type="color"])').last().fill('1000,00');
    await page.getByRole('button', { name: 'Criar Conta' }).click();
    await expect(page.locator('main')).toContainText(originName, { timeout: 15000 });

    await page.getByRole('button', { name: /Nova Conta/i }).click();
    await page.getByPlaceholder('Ex: Itaú, Nubank, Carteira Física...').fill(destName);
    await page.locator('#form-account input:not([type="color"])').last().fill('200,00');
    await page.getByRole('button', { name: 'Criar Conta' }).click();
    await expect(page.locator('main')).toContainText(destName, { timeout: 15000 });

    // 2. Realizar transferência de R$ 250,00 de Origem -> Destino
    await page.getByRole('button', { name: /Novo Lançamento/i }).first().click();
    await page.locator('#form-new-tx').getByRole('button', { name: /Transferência/i }).click();
    await page.locator('#tx-amount').fill('250,00');
    await page.locator('#tx-desc').fill(`E2E Transfer ${suffix}`);

    const selects = page.locator('#form-new-tx select');
    const originOpt = await selects.nth(0).locator('option', { hasText: originName }).getAttribute('value');
    const destOpt = await selects.nth(1).locator('option', { hasText: destName }).getAttribute('value');
    if (originOpt) await selects.nth(0).selectOption(originOpt);
    if (destOpt) await selects.nth(1).selectOption(destOpt);

    await page.getByRole('button', { name: 'Salvar Lançamento' }).click();

    // 3. Validar novos saldos: Origem = 750,00 e Destino = 450,00
    const originCard = page.locator('main div.rounded-2xl', { hasText: originName }).last();
    const destCard = page.locator('main div.rounded-2xl', { hasText: destName }).last();
    await expect(originCard).toContainText('750,00', { timeout: 15000 });
    await expect(destCard).toContainText('450,00', { timeout: 15000 });

    // 4. Recalibrar saldo consolidado da conta Destino para R$ 900,00
    await destCard.getByRole('button', { name: /Editar Saldo/i }).click();
    await expect(page.getByText('Editar Conta Bancária & Saldo')).toBeVisible();
    await page.locator('#form-account input:not([type="color"])').last().fill('900,00');
    await page.getByRole('button', { name: 'Salvar Alterações da Conta' }).click();
    await expect(destCard).toContainText('900,00', { timeout: 15000 });
  });
});

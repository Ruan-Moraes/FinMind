import { test, expect } from '@playwright/test';
import { prisma } from '@/shared/lib/prisma';

test.describe('E2E: Ciclo Completo (Criar → Editar → Remover) de Contas e Cartões', () => {
  test.afterAll(async () => {
    await prisma.account.deleteMany({
      where: { name: { startsWith: 'E2E Conta Ciclo ' } },
    });
    await prisma.creditCard.deleteMany({
      where: { name: { startsWith: 'E2E Cartao Ciclo ' } },
    });
  });

  test('cria, edita e exclui definitivamente conta sem histórico e cartão de crédito', async ({
    page,
  }) => {
    await page.goto('/');
    const suffix = Date.now().toString().slice(-4);
    const accOriginal = `E2E Conta Ciclo ${suffix}`;
    const accEdited = `E2E Conta Ciclo Editada ${suffix}`;
    const cardOriginal = `E2E Cartao Ciclo ${suffix}`;
    const cardEdited = `E2E Cartao Ciclo Editado ${suffix}`;

    await page.getByRole('button', { name: /Contas & Cartões/i }).click();

    // 1. Criar Conta
    await page.getByRole('button', { name: /Nova Conta/i }).click();
    await page.getByPlaceholder('Ex: Itaú, Nubank, Carteira Física...').fill(accOriginal);
    await page.getByRole('button', { name: 'Criar Conta' }).click();
    await expect(page.locator('main')).toContainText(accOriginal, { timeout: 15000 });

    // 2. Editar nome da Conta
    const accCard = page.locator('main div.rounded-2xl', { hasText: accOriginal }).last();
    await accCard.locator('button[title="Editar conta bancária e ajustar saldo"]').click();
    await page.getByPlaceholder('Ex: Itaú, Nubank, Carteira Física...').fill(accEdited);
    await page.getByRole('button', { name: 'Salvar Alterações da Conta' }).click();
    await expect(page.locator('main')).toContainText(accEdited, { timeout: 15000 });

    // 3. Remover Conta sem histórico (exclusão definitiva RN-03)
    const editedAccCard = page.locator('main div.rounded-2xl', { hasText: accEdited }).last();
    await editedAccCard.locator('button[title="Arquivar ou excluir conta"]').click();
    await page.getByRole('button', { name: /Sim, Remover Conta/i }).click();
    await expect(page.locator('main')).not.toContainText(accEdited, { timeout: 15000 });

    // 4. Criar Cartão
    await page.getByRole('button', { name: /Novo Cartão/i }).click();
    await page.getByPlaceholder('Ex: Nubank, XP Visa Infinite...').fill(cardOriginal);
    await page.getByRole('button', { name: 'Salvar Cartão' }).click();
    await expect(page.locator('main')).toContainText(cardOriginal, { timeout: 15000 });

    // 5. Editar Cartão
    const cardBox = page.locator('main div.rounded-2xl', { hasText: cardOriginal }).last();
    await cardBox.locator('button[title="Editar cartão de crédito"]').click();
    await page.getByPlaceholder('Ex: Nubank, XP Visa Infinite...').fill(cardEdited);
    await page.getByRole('button', { name: /Salvar Alterações|Salvar Cartão/i }).click();
    await expect(page.locator('main')).toContainText(cardEdited, { timeout: 15000 });

    // 6. Excluir Cartão
    const editedCardBox = page.locator('main div.rounded-2xl', { hasText: cardEdited }).last();
    await editedCardBox.locator('button[title="Excluir cartão de crédito"]').click();
    await page.getByRole('button', { name: /Sim, Excluir|Confirmar Exclusão/i }).click();
    await expect(page.locator('main')).not.toContainText(cardEdited, { timeout: 15000 });
  });
});

import { test, expect } from '@playwright/test';
import { prisma } from '@/shared/lib/prisma';

test.describe('E2E: Extrato — Busca, Filtros, Edição e Exclusão de Lançamento', () => {
  test.afterAll(async () => {
    await prisma.transaction.deleteMany({
      where: { description: { startsWith: 'E2E Extrato ' } },
    });
  });

  test('cria lançamento, filtra no Extrato, edita descrição e exclui com confirmação', async ({
    page,
  }) => {
    await page.goto('/');

    const suffix = Date.now().toString().slice(-4);
    const originalDesc = `E2E Extrato Cafe ${suffix}`;
    const editedDesc = `E2E Extrato Almoco ${suffix}`;

    // 1. Criar lançamento pelo botão no Header
    await page.getByRole('button', { name: /Novo Lançamento/i }).first().click();
    await expect(page.getByText('Novo Lançamento Financeiro')).toBeVisible();
    await page.locator('#tx-amount').fill('42,90');
    await page.locator('#tx-desc').fill(originalDesc);
    await page.getByRole('button', { name: 'Salvar Lançamento' }).click();

    // 2. Navegar para aba Extrato & Comprovantes
    await page.getByRole('button', { name: /Extrato & Comprovantes/i }).click();

    // 3. Buscar pela descrição criada
    const searchInput = page.getByPlaceholder('Buscar descrição ou #tag...');
    await searchInput.fill(originalDesc);
    await expect(page.locator('table')).toContainText(originalDesc, { timeout: 15000 });

    // 4. Editar lançamento
    const row = page.locator('tbody tr', { hasText: originalDesc }).first();
    await row.locator('button[title="Editar lançamento"]').click();
    await expect(page.getByText('Editar Lançamento Financeiro')).toBeVisible();
    await page.locator('#tx-desc').fill(editedDesc);
    await page.getByRole('button', { name: 'Salvar Alterações' }).click();

    // 5. Buscar pela descrição editada e validar atualização
    await searchInput.fill(editedDesc);
    await expect(page.locator('table')).toContainText(editedDesc, { timeout: 15000 });

    // 6. Excluir lançamento com modal de confirmação
    const editedRow = page.locator('tbody tr', { hasText: editedDesc }).first();
    await editedRow.locator('button[title="Excluir lançamento"]').click();
    await expect(page.getByText('Excluir Lançamento Financeiro')).toBeVisible();
    await page.getByRole('button', { name: 'Sim, Excluir Lançamento' }).click();

    await expect(
      page
        .locator('table')
        .getByText('Nenhum lançamento encontrado para os filtros selecionados.')
    ).toBeVisible({ timeout: 15000 });
  });
});

import { test, expect } from '@playwright/test';
import { prisma } from '@/shared/lib/prisma';

// PNG 1x1 válido em base64 para upload real no navegador
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test.describe('E2E: Anexo de Comprovante (RF-16) & Modal de Pré-visualização', () => {
  test.afterAll(async () => {
    await prisma.transaction.deleteMany({
      where: { description: { startsWith: 'E2E Comprovante ' } },
    });
  });

  test('anexa imagem PNG no lançamento e visualiza no modal de comprovante pelo Extrato', async ({
    page,
  }) => {
    await page.goto('/');
    const suffix = Date.now().toString().slice(-4);
    const txDesc = `E2E Comprovante ${suffix}`;

    // 1. Criar lançamento com arquivo PNG anexado
    await page.getByRole('button', { name: /Novo Lançamento/i }).first().click();
    await page.locator('#tx-amount').fill('89,90');
    await page.locator('#tx-desc').fill(txDesc);
    await page.locator('#form-new-tx input[type="file"]').setInputFiles({
      name: `recibo-${suffix}.png`,
      mimeType: 'image/png',
      buffer: TINY_PNG_BUFFER,
    });
    await page.getByRole('button', { name: 'Salvar Lançamento' }).click();

    // 2. Localizar lançamento no Extrato & Comprovantes
    await page.getByRole('button', { name: /Extrato & Comprovantes/i }).click();
    await page.getByPlaceholder('Buscar descrição ou #tag...').fill(txDesc);

    const row = page.locator('tbody tr', { hasText: txDesc }).first();
    await expect(row).toBeVisible({ timeout: 15000 });

    // 3. Abrir modal de visualização do comprovante
    await row.locator('button[title="Visualizar comprovante anexado"]').click();
    await expect(page.getByRole('heading', { name: 'Comprovante / Recibo Anexado' })).toBeVisible();
    await expect(page.locator(`img[alt="recibo-${suffix}.png"]`)).toBeVisible();
    await expect(page.getByRole('link', { name: /Baixar Arquivo/i })).toBeVisible();
  });
});

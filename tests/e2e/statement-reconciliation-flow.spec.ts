import { test, expect } from '@playwright/test';
import { prisma } from '@/shared/lib/prisma';

test.describe('E2E: Fluxo Completo de Conciliação de Extrato Bancário e Rollback', () => {
  test.afterAll(async () => {
    const e2eFiles = await prisma.statementImportFile.findMany({
      where: { fileName: { startsWith: 'extrato-colado-' } },
      select: { batchId: true },
    });
    const batchIds = Array.from(new Set(e2eFiles.map((f) => f.batchId)));
    if (batchIds.length > 0) {
      await prisma.statementImportFile.deleteMany({
        where: { batchId: { in: batchIds } },
      });
      await prisma.statementImportBatch.deleteMany({
        where: { id: { in: batchIds }, status: 'REVERTED' },
      });
    }
  });

  test('cola extrato na fila, executa conciliação, filtra itens, confirma lote e reverte no histórico', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Abrir aba Copiloto IA & Extrato
    await page.getByRole('button', { name: /Copiloto IA & Extrato/i }).click();
    await expect(
      page.getByText('Importação & Conciliação Inteligente de Extratos com IA')
    ).toBeVisible();

    // 2. Clicar em "Colar Extrato" e adicionar movimentações à fila
    await page.getByRole('button', { name: /Colar Extrato/i }).click();
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();

    const sampleCsv = [
      'Data;Descricao;Valor',
      '10/11/2026;PIX RECEBIDO CLIENTE E2E;+850,00',
      '12/11/2026;COMPRA SUPERMERCADO E2E;-140,00',
    ].join('\n');

    await textarea.fill(sampleCsv);
    await page.getByRole('button', { name: /Adicionar à Fila/i }).click();

    // 3. Executar Análise e Conciliação
    const analyzeBtn = page.getByRole('button', { name: /Analisar com IA & Conciliar/i });
    await expect(analyzeBtn).toBeVisible();
    await analyzeBtn.click();

    // 4. Verificar métricas e itens conciliados na tela
    await expect(page.getByText('Receitas Identificadas')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Despesas Identificadas')).toBeVisible();

    // 5. Abrir modal de confirmação e confirmar importação do lote
    const confirmOpenBtn = page.getByRole('button', {
      name: /Revisar Resumo & Confirmar/i,
    });
    await expect(confirmOpenBtn).toBeEnabled();
    await confirmOpenBtn.click();

    await expect(
      page.getByText('Confirmar Importação e Conciliação Financeira')
    ).toBeVisible();

    await page
      .getByRole('button', { name: /Confirmar e Atualizar Dados Financeiros/i })
      .click();

    await expect(page.getByText(/Importação confirmada com sucesso!/i)).toBeVisible({
      timeout: 20000,
    });

    // 6. Reverter o lote recém-confirmado no Histórico de Importações
    const revertBtn = page.getByRole('button', { name: 'Reverter' }).first();
    await expect(revertBtn).toBeVisible();
    await revertBtn.click();

    await expect(page.getByText('Reverter Lote de Importação')).toBeVisible();
    await page.getByRole('button', { name: /Confirmar Reversão/i }).click();

    await expect(
      page.getByText(/Lote de importação revertido com segurança!/i)
    ).toBeVisible({ timeout: 20000 });
  });
});

import path from 'node:path';
import { test, expect } from '@playwright/test';
import { ensureValuesVisible } from '../helpers/e2e-ui';

test.describe('E2E: Upload Simultâneo dos 3 Extratos de Teste & Detecção de Duplicidade', () => {
  test('carrega CSV Nubank, OFX Itaú e CSV Mercado Pago juntos, detecta duplicidade e exibe revisão', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await ensureValuesVisible(page);

    // 1. Abrir aba Copiloto IA & Extrato
    await page.getByRole('button', { name: /Copiloto IA & Extrato/i }).click();

    // 2. Enviar os 3 extratos reais simultaneamente no input de upload
    const dir = path.resolve(process.cwd(), 'exemplos-extratos');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles([
      path.join(dir, 'extrato-nubank-novembro-2026.csv'),
      path.join(dir, 'extrato-itau-novembro-2026.ofx'),
      path.join(dir, 'extrato-mercado-pago-novembro-2026.csv'),
    ]);

    // Validar que os 3 arquivos apareceram na fila
    await expect(page.locator('main')).toContainText('extrato-nubank-novembro-2026.csv');
    await expect(page.locator('main')).toContainText('extrato-itau-novembro-2026.ofx');
    await expect(page.locator('main')).toContainText('extrato-mercado-pago-novembro-2026.csv');

    // 3. Disparar análise e conciliação multi-arquivo
    await page.getByRole('button', { name: /Analisar com IA & Conciliar/i }).click();

    // 4. Validar resumo: 24 movimentações em 3 arquivos com 1 duplicidade detectada
    await expect(page.locator('main')).toContainText(
      /24 movimentação\(ões\) lida\(s\) em 3 arquivo\(s\)/i,
      { timeout: 45000 }
    );
    await expect(page.locator('main')).toContainText(/1 duplicada\(s\)/i);

    // 5. Filtrar pela aba Duplicados e confirmar que o Uber de R$ 45,30 foi isolado
    await page.getByRole('button', { name: /Duplicados/i }).first().click();
    await expect(page.locator('main')).toContainText(/Uber/i);
    await expect(page.locator('main')).toContainText('45,30');
  });
});

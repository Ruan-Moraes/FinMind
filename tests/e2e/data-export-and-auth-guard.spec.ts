import { test, expect } from '@playwright/test';

test.describe('E2E: Exportação CSV/JSON & Guarda de Sessão Autenticada', () => {
  test('exibe botões de exportação, baixa CSV/JSON válidos e bloqueia /api/export após logout', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Verificar botão "Exportar CSV" na aba Extrato & Comprovantes
    await page.getByRole('button', { name: /Extrato & Comprovantes/i }).click();
    await expect(page.getByRole('link', { name: /Exportar CSV/i })).toBeVisible();

    // 2. Abrir Configurações e validar links de Exportação CSV e Backup JSON
    await page.getByRole('button', { name: /Configurações/i }).first().click();
    await expect(page.getByText('Exportação & Backup de Dados')).toBeVisible();
    await expect(page.getByRole('link', { name: /Extrato CSV/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Backup Completo/i })).toBeVisible();

    // 3. Validar download real de CSV e JSON via API autenticada
    const csvResp = await page.request.get('/api/export?format=csv');
    expect(csvResp.status()).toBe(200);
    expect(csvResp.headers()['content-type']).toContain('text/csv');
    const csvBody = await csvResp.text();
    expect(csvBody).toContain('Data;Descrição;Tipo;Natureza');

    const jsonResp = await page.request.get('/api/export?format=json');
    expect(jsonResp.status()).toBe(200);
    const jsonData = await jsonResp.json();
    expect(jsonData.schemaVersion).toBe('1.0');
    expect(jsonData.summary).toBeDefined();
    expect(JSON.stringify(jsonData)).not.toContain('passwordHash');

    // 4. Encerrar Sessão -> confirmar tela de Login e bloqueio 401 no /api/export
    await page.getByRole('button', { name: /Encerrar Sessão/i }).first().click();
    await expect(page.getByRole('button', { name: /Entrar no Painel Financeiro/i })).toBeVisible({
      timeout: 15000,
    });

    const blockedResp = await page.request.get('/api/export?format=json');
    expect(blockedResp.status()).toBe(401);
  });
});

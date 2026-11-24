import { test, expect } from '@playwright/test';

test.describe('E2E: Snapshot Completo (Exportação & Pré-visualização de Importação)', () => {
  test('exporta snapshot válido via /api/snapshot, rejeita arquivo inválido e pré-visualiza restauração', async ({
    page,
    request,
  }) => {
    await page.goto('/');

    // 1. Validar endpoint GET /api/snapshot
    const snapRes = await request.get('/api/snapshot');
    expect(snapRes.status()).toBe(200);
    const snapJson = (await snapRes.json()) as {
      format: string;
      version: number;
      data: Record<string, unknown>;
    };
    expect(snapJson.format).toBe('finmind-snapshot');
    expect(snapJson.version).toBe(1);
    expect(Array.isArray(snapJson.data.accounts)).toBe(true);
    expect(Array.isArray(snapJson.data.categories)).toBe(true);
    expect(Array.isArray(snapJson.data.transactions)).toBe(true);

    // 2. Abrir Configurações e localizar cartão de Snapshot
    await page.getByRole('button', { name: 'Abrir Configurações' }).click();
    await expect(page.getByText('Snapshot Completo (Backup & Restauração)')).toBeVisible();

    const fileInput = page.locator('input[aria-label="Selecionar arquivo de snapshot"]');

    // 3. Enviar JSON inválido e confirmar mensagem de erro amigável
    await fileInput.setInputFiles({
      name: 'invalido.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'desconhecido', version: 99 }), 'utf8'),
    });
    await expect(
      page.getByText(/Arquivo inválido\. Selecione um snapshot exportado pelo FinMind/i)
    ).toBeVisible();

    // 4. Enviar o snapshot válido baixado acima e validar pré-visualização + botão de confirmação
    await fileInput.setInputFiles({
      name: 'backup-valido.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(snapJson), 'utf8'),
    });
    await expect(page.getByText('Confirmar restauração de backup-valido.json')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar e Parear Dados' })).toBeVisible();

    // Cancelar sem sobrescrever o banco atual
    await page
      .locator('div')
      .filter({ hasText: 'Confirmar restauração de backup-valido.json' })
      .getByRole('button', { name: 'Cancelar' })
      .first()
      .click();
    await expect(page.getByText('Confirmar restauração de backup-valido.json')).toHaveCount(0);
  });
});

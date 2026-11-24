import { test, expect } from '@playwright/test';

test.describe('E2E: Persistência de Configurações & Fluxo Completo de Logout/Login', () => {
  test('persiste densidade no banco após reload, rejeita senha errada e autentica com sucesso', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Alterar Densidade para COMPACT e salvar no banco
    await page.getByRole('button', { name: /Configurações/i }).first().click();
    const densitySelect = page.locator('#form-user-settings select').nth(1);
    await densitySelect.selectOption('COMPACT');
    await page.getByRole('button', { name: 'Salvar Preferências' }).click();
    await expect(page.getByText('Configurações & Preferências')).toBeHidden({ timeout: 10000 });

    // 2. Recarregar página e confirmar que COMPACT persistiu via SSR
    await page.reload();
    await page.getByRole('button', { name: /Configurações/i }).first().click();
    await expect(page.locator('#form-user-settings select').nth(1)).toHaveValue('COMPACT');

    // Restaurar para COMFORTABLE
    await page.locator('#form-user-settings select').nth(1).selectOption('COMFORTABLE');
    await page.getByRole('button', { name: 'Salvar Preferências' }).click();
    await expect(page.getByText('Configurações & Preferências')).toBeHidden({ timeout: 10000 });

    // 3. Encerrar Sessão -> testar senha inválida -> autenticar com senha válida
    await page.getByRole('button', { name: /Configurações/i }).first().click();
    await page.getByRole('button', { name: /Encerrar Sessão/i }).first().click();
    await expect(page.getByRole('button', { name: /Entrar no Painel Financeiro/i })).toBeVisible({
      timeout: 15000,
    });

    await page.locator('#login-password').fill('senha-incorreta-e2e');
    await page.getByRole('button', { name: /Entrar no Painel Financeiro/i }).click();
    await expect(page.getByText(/E-mail ou senha incorretos/i)).toBeVisible({ timeout: 10000 });

    // Login válido usando a senha configurada no ambiente
    const validPass = process.env.ADMIN_PASSWORD || 'admin123';
    await page.locator('#login-password').fill(validPass);
    await page.getByRole('button', { name: /Entrar no Painel Financeiro/i }).click();

    await expect(page.getByRole('button', { name: /Novo Lançamento/i }).first()).toBeVisible({
      timeout: 15000,
    });
  });
});

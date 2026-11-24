import { test, expect } from '@playwright/test';

test.describe('E2E: Provedores IA (Chave de API, Estado Global Sincronizado e Seletor Padronizado)', () => {
  test('remove fluxo de assinatura/SSO, usa SearchableSelect no Header/Configurações e sincroniza estado globalmente', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Confirma remoção definitiva do botão legado de SSO popup no Header
    await expect(page.getByRole('button', { name: /Entrar OpenAI|Entrar Gemini|Entrar Claude/i })).toHaveCount(0);

    // 2. Header usa o SearchableSelect padronizado (role="combobox") para seleção de modelos
    const headerModelCombobox = page.getByRole('combobox', { name: 'Selecionar Modelo de IA no Header' });
    await expect(headerModelCombobox).toBeVisible();

    // 3. Abre a Central de Provedores pelo botão de status no Header
    await page.locator('[data-agent-id="header.model.selector"] button').last().click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByText('Central de Provedores e Teste de IA')).toBeVisible();
    await expect(modal.getByRole('combobox', { name: 'Selecionar Modelo de IA no Console' })).toBeVisible();
    await expect(modal.getByText(/Pop-up/i)).toHaveCount(0);
    await modal.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 4. Navega até Copiloto IA & Extrato e valida ausência total do modo Assinatura
    await page.getByRole('button', { name: /Copiloto IA & Extrato/i }).click();
    await expect(page.getByText('Provedores de Inteligência Artificial (Chave de API)')).toBeVisible();
    await expect(page.getByText(/Plano de Assinatura/i)).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /Selecionar modelo OpenAI/i })).toBeVisible();

    // 5. Rota legada /sso-popup não existe mais (retorna 404)
    const ssoRes = await page.request.get('/sso-popup');
    expect(ssoRes.status()).toBe(404);
  });
});

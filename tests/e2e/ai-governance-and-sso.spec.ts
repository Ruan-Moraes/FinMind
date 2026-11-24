import { test, expect } from '@playwright/test';

test.describe('E2E: Seletor de Modelos IA no Header, Console Sanity Check e Pop-up SSO', () => {
  test('seleciona modelos no Header, abre o Console Sanity Check e renderiza /sso-popup para os 3 provedores', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Verificar seletor de modelos no Header
    const modelSelect = page.getByLabel('Selecionar Modelo de IA no Header');
    await expect(modelSelect).toBeVisible();

    // 2. Abrir o Console de Teste IA e Sanity Check pelo botão de status ao lado do seletor
    const inspectorBtn = page.locator(
      'button[title="Abrir Central de Conexões e Teste das IAs"]'
    );
    await inspectorBtn.click();

    await expect(
      page.getByText(/Central de Conexões|Teste de IA|Teste Interativo/i).first()
    ).toBeVisible();

    // 3. Verificar renderização da rota /sso-popup para OpenAI, Gemini e Claude
    await page.goto('/sso-popup?provider=OPENAI&modelId=gpt-4o-mini');
    await expect(page.locator('body')).toContainText(/OpenAI|API Key|Chave/i);

    await page.goto('/sso-popup?provider=GEMINI&modelId=gemini-2.0-flash');
    await expect(page.locator('body')).toContainText(/Google|Gemini|AIza/i);

    await page.goto('/sso-popup?provider=CLAUDE&modelId=claude-3-5-sonnet-latest');
    await expect(page.locator('body')).toContainText(/Anthropic|Claude/i);
  });
});

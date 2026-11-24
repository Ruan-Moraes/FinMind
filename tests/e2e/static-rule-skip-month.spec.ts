import { test, expect } from '@playwright/test';

test.describe('E2E: Pular Mês Específico em Regras Fixas Mensais', () => {
  test('pula regra fixa no mês atual, volta a contar no próximo mês e limpa ao final', async ({
    page,
  }) => {
    await page.goto('/');
    const suffix = Date.now().toString().slice(-4);
    const ruleTitle = `E2E Regra Pulada ${suffix}`;

    // 1. Criar um Custo Estático de teste
    await page.locator('[data-agent-id="nav.tab.goals"]').click();
    await page.locator('[data-agent-id="goals.btn.createExpenseRule"]').click();
    await page.locator('#form-static-rule input[placeholder*="Aluguel"]').fill(ruleTitle);
    await page.locator('#form-static-rule input[placeholder="1500,00"]').fill('420,00');
    await page.getByRole('button', { name: /Salvar Regra Fixa/i }).click();

    const row = page.locator('table tbody tr').filter({ hasText: ruleTitle }).first();
    await expect(row).toBeVisible({ timeout: 10000 });

    // 1b. Ajustar valor apenas neste mês (de 420,00 para 590,00) e validar exibição
    await row.getByLabel('Ajustar valor neste mês').click();
    await row.getByLabel('Valor ajustado para este mês').fill('590,00');
    await row.getByLabel('Salvar valor do mês').click();
    await expect(row).toContainText(/Ajustado no mês/i, { timeout: 10000 });

    // 2. Abrir menu de ações (⋯), clicar em "Pular neste mês" e confirmar feedback imediato com "Desfazer"
    await row.getByRole('button', { name: `Ações para ${ruleTitle}` }).click();
    await page.getByRole('menuitem', { name: /Pular neste mês/i }).click();
    const feedbackBanner = page.getByTestId('static-rule-skip-feedback');
    await expect(feedbackBanner).toBeVisible({ timeout: 10000 });
    await expect(feedbackBanner).toContainText(ruleTitle);
    await expect(feedbackBanner).toContainText(/foi pulado em/i);
    await expect(row).toContainText(/Não conta neste mês/i, { timeout: 10000 });

    // 2b. Clicar em "Desfazer" no feedback e validar restauração no mesmo mês
    await feedbackBanner.getByRole('button', { name: 'Desfazer' }).click();
    await expect(feedbackBanner).toContainText(/foi reativado em/i, { timeout: 10000 });
    await expect(row).not.toContainText(/Não conta neste mês/i, { timeout: 10000 });

    // 2c. Pular novamente pelo menu para confirmar que volta a contar automaticamente no próximo mês
    await row.getByRole('button', { name: `Ações para ${ruleTitle}` }).click();
    await page.getByRole('menuitem', { name: /Pular neste mês/i }).click();
    await expect(row).toContainText(/Não conta neste mês/i, { timeout: 10000 });

    // 3. Avançar para o próximo mês pelo seletor do Header e confirmar que volta a contar normalmente
    const monthSelect = page.locator('[data-agent-id="header.period.month"]');
    const currentMonthVal = Number(await monthSelect.inputValue());
    const nextMonthVal = currentMonthVal === 12 ? 1 : currentMonthVal + 1;
    await monthSelect.selectOption(String(nextMonthVal));
    await page.waitForLoadState('networkidle');
    await page.locator('[data-agent-id="nav.tab.goals"]').click();

    const nextMonthRow = page.locator('table tbody tr').filter({ hasText: ruleTitle }).first();
    await expect(nextMonthRow).toBeVisible({ timeout: 10000 });
    await expect(nextMonthRow).not.toContainText(/Não conta neste mês/i);

    // 4. Remover a regra de teste via menu contextual (⋯)
    await nextMonthRow.getByRole('button', { name: `Ações para ${ruleTitle}` }).click();
    await page.getByRole('menuitem', { name: /Excluir regra/i }).click();
    await page.getByRole('button', { name: 'Sim, Excluir Regra' }).click();
    await expect(page.getByText(ruleTitle)).toHaveCount(0);
  });
});

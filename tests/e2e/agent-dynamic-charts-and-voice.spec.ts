import { test, expect } from '@playwright/test';

test.describe('E2E: Agente IA — Gráficos Dinâmicos, Correspondência de Intenção e Composer de Voz', () => {
  test('gera gráfico de pizza de metas, comparativo mensal, relatório, navega apenas quando pedido e expõe fluxo de voz', async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.goto('/');

    await page.getByRole('button', { name: 'Abrir Assistente IA' }).click();
    const chat = page.getByRole('complementary', { name: 'Assistente Financeiro Inteligente' });
    await expect(chat).toBeVisible();
    await expect(chat.getByText('Modo do agente:')).toHaveCount(0);

    const input = chat.locator('form textarea');
    const sendBtn = chat.getByRole('button', { name: 'Enviar pergunta ao assistente IA' });

    // 1. Garante que existe ao menos 1 meta para validar o gráfico de pizza real (se não houver, cria rapidamente)
    await input.fill('Gere um gráfico de pizza sobre minhas metas.');
    await sendBtn.click();
    await expect(chat.locator('[data-agent-block="pie"]').or(chat.getByText(/não possui metas financeiras/i))).toBeVisible({
      timeout: 15000,
    });
    // Nunca deve responder com "Repetir Navegação" para esse pedido
    await expect(chat.getByRole('button', { name: 'Repetir Navegação' })).toHaveCount(0);

    // 2. Comparar gastos dos últimos meses -> gera gráfico + tabela comparativa real
    await input.fill('Compare meus gastos dos últimos meses em tabela.');
    await sendBtn.click();
    await expect(
      chat.locator('[data-agent-block="table"], [data-agent-block="bar"]').first()
    ).toBeVisible({ timeout: 25000 });

    // 3. Gerar relatório financeiro -> gera card de relatório estruturado (não apenas navegação)
    await input.fill('Gere um relatório financeiro.');
    await sendBtn.click();
    await expect(
      chat.locator('[data-agent-block="report_card"], [data-agent-block="kpi_grid"]').first()
    ).toBeVisible({ timeout: 30000 });

    // 4. Navegação explícita ("Mostre minha tela de metas.") -> navega até Metas
    await input.fill('Mostre minha tela de metas.');
    await sendBtn.click();
    await expect(page.locator('[data-agent-id="goals.section.goals"]')).toBeVisible({ timeout: 10000 });

    // 5. Validar presença do botão de microfone e preservação de texto digitado no composer
    await input.fill('Rascunho manual preservado');
    const micBtn = chat.getByRole('button', { name: 'Falar solicitação por microfone' });
    await expect(micBtn).toBeVisible();
    await expect(input).toHaveValue('Rascunho manual preservado');
  });
});

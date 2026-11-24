import { test, expect } from '@playwright/test';

test.describe('E2E: Chatbot Flutuante IA — RAG, Gráficos Dinâmicos e Histórico Persistido', () => {
  test('conversa com a IA, valida resposta com gráfico/KPIs, consulta histórico salvo e remove sessão', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Abrir chatbot flutuante no canto inferior direito
    await page.getByRole('button', { name: 'Abrir Assistente IA' }).click();
    const chatbot = page.getByRole('complementary', { name: 'Assistente Financeiro Inteligente' });
    await expect(chatbot).toBeVisible();

    const uniqueMarker = `E2E-${Date.now().toString().slice(-5)}`;
    const question = `Mostre um gráfico dos meus gastos e metas (${uniqueMarker})`;

    // 2. Enviar pergunta
    const ragInput = chatbot.locator('form input');
    await ragInput.fill(question);
    await ragInput.press('Enter');

    await expect(chatbot).toContainText(
      /Ver Fatos Históricos|Patrimônio Líquido|Não há dados financeiros/i,
      { timeout: 20000 }
    );

    // 3. Iniciar nova conversa e consultar a anterior no Histórico persistido
    await chatbot.getByRole('button', { name: 'Nova conversa' }).click();
    await expect(chatbot.getByText(/Olá! Sou seu Agente Interativo do FinMind/i)).toBeVisible();

    await chatbot.getByRole('button', { name: 'Histórico de conversas' }).click();
    await expect(chatbot.getByText(/Histórico de Conversas/i)).toBeVisible();

    const savedSessionBtn = chatbot.getByRole('button', { name: new RegExp(uniqueMarker) }).first();
    await expect(savedSessionBtn).toBeVisible({ timeout: 10000 });

    // Reabrir a conversa salva e confirmar que as mensagens voltaram
    await savedSessionBtn.click();
    await expect(chatbot.getByText(question)).toBeVisible();

    // 4. Voltar ao histórico e excluir a sessão de teste com confirmação inline
    await chatbot.getByRole('button', { name: 'Histórico de conversas' }).click();
    const row = chatbot
      .locator('div.rounded-xl')
      .filter({ hasText: uniqueMarker })
      .first();
    await row.getByTitle('Excluir conversa').click();
    await row.getByRole('button', { name: 'Confirmar' }).click();
    await expect(chatbot.getByText(uniqueMarker)).toHaveCount(0);

    // 5. Fechar chatbot e validar que aba Copiloto IA exibe Conciliação em linha única sem leitor legado
    await chatbot.getByRole('button', { name: 'Fechar assistente IA' }).click();
    await page.getByRole('button', { name: /Copiloto IA & Extrato/i }).click();
    await expect(page.getByText('1. Selecionar Extratos')).toBeVisible();
    await expect(page.getByText('3. Revisar & Confirmar')).toBeVisible();
    await expect(page.getByText('Leitor Rápido de Extrato')).toHaveCount(0);
  });
});

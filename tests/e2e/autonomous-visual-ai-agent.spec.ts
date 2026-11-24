import { test, expect } from '@playwright/test';

test.describe('E2E: Agente IA Autônomo, Visual, Captura Real e Guarda de Segurança', () => {
  test('orienta visualmente, executa alteração com confirmação e rollback, captura tela anotada e bloqueia reset', async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.goto('/');

    // 1. Abrir Agente IA Flutuante (modo automático sem seletor manual)
    await page.getByRole('button', { name: 'Abrir Assistente IA' }).click();
    const chatAside = page.getByRole('complementary', { name: 'Assistente Financeiro Inteligente' });
    await expect(chatAside).toBeVisible();
    await expect(chatAside.getByText('Modo do agente:')).toHaveCount(0);

    const chatInput = chatAside.locator('textarea');
    const sendBtn = chatAside.getByRole('button', { name: 'Enviar pergunta ao assistente IA' });

    // 2. Orientação Interativa ("Como faço para cadastrar uma nova meta financeira?")
    await chatInput.fill('Como faço para cadastrar uma nova meta financeira?');
    await sendBtn.click();
    await expect(chatAside.getByText('Orientação Interativa').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Definir Meta de Carteira' })).toBeVisible();
    await expect(page.locator('[data-agent-coachmark="true"]')).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.locator('[data-agent-coachmark="true"]')).toHaveCount(0);

    // 2b. Orientação com Scroll Interno de Modal + Coachmark Interativo ("Como configuro os feriados?")
    await chatInput.fill('Como configuro os feriados?');
    await sendBtn.click();
    await expect(page.getByRole('heading', { name: 'Configurações & Preferências' })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('[data-agent-id="modal.settings.section.holidays"]')).toBeVisible({
      timeout: 8000,
    });
    const coachmark = page.locator('[data-agent-coachmark="true"]');
    await expect(coachmark).toBeVisible({ timeout: 8000 });
    await expect(coachmark).toContainText('Gerenciar Calendário de Feriados');
    await coachmark.getByRole('button', { name: 'Anterior' }).click();
    await expect(coachmark).toContainText('Estado (UF) e Cidade');
    await coachmark.getByRole('button', { name: 'Próximo' }).click();
    await expect(coachmark).toContainText('Gerenciar Calendário de Feriados');
    await coachmark.getByRole('button', { name: 'Entendi', exact: true }).click();
    await expect(coachmark).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Configurações & Preferências' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

    // 3. Execução Autônoma com Confirmação (Antes -> Depois), Verificação Real e Desfazer (Undo)
    await chatInput.fill('Crie uma meta de R$ 2.500 para Dezembro de 2026 chamada Reserva E2E');
    await sendBtn.click();
    await expect(chatAside.getByRole('button', { name: 'Confirmar e Executar' })).toBeVisible({ timeout: 25000 });
    await chatAside.getByRole('button', { name: 'Confirmar e Executar' }).click();
    await expect(chatAside.getByText(/salva e verificada no banco/i)).toBeVisible({ timeout: 12000 });

    // Desfazer a criação da meta para manter a base limpa
    await chatAside.getByRole('button', { name: 'Desfazer' }).click();
    await expect(chatAside.getByText(/ação desfeita/i)).toBeVisible({ timeout: 10000 });

    // 4. Captura Real de Tela Anotada + Lightbox HD com Zoom e Botão Salvar Imagem
    await chatInput.fill('Tire um print anotado das metas e custos estáticos');
    await sendBtn.click();
    await expect(chatAside.getByText('Guia por Captura Real').first()).toBeVisible({ timeout: 10000 });
    const capturedImg = chatAside.locator('img[src^="data:image/"]').first();
    await expect(capturedImg).toBeVisible({ timeout: 15000 });
    await capturedImg.click();
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Salvar Imagem', exact: true })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Aumentar zoom' }).click();
    await expect(page.getByText('125%')).toBeVisible();
    await page.getByRole('button', { name: 'Fechar ampliação' }).click();

    // 5. Filtro Multi-Tela no Extrato
    await chatInput.fill('Filtre o extrato apenas por despesas');
    await sendBtn.click();
    await expect(page.locator('[data-agent-id="transactions.table"]')).toBeVisible({ timeout: 10000 });

    // 6. Guarda de Segurança: Reset Geral bloqueado para execução autônoma (apenas orienta abrindo Configurações)
    await chatInput.fill('Resetar tudo e apagar todos os dados agora');
    await sendBtn.click();
    await expect(chatAside.getByText(/operação bloqueada para execução autônoma/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('heading', { name: 'Configurações & Preferências' })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 7. Validar seleção múltipla / Selecionar tudo no histórico e limpar a sessão de teste
    await chatAside.getByRole('button', { name: 'Histórico de conversas' }).click();
    await expect(chatAside.getByLabel('Selecionar todas as conversas')).toBeVisible();
    const sessionRow = chatAside
      .locator('div.rounded-xl')
      .filter({ hasText: 'Como faço para cadastrar uma nova meta' })
      .first();
    if ((await sessionRow.count()) > 0) {
      await sessionRow.locator('input[type="checkbox"]').check();
      await chatAside.getByRole('button', { name: /Excluir selecionadas/i }).click();
      await chatAside.getByRole('button', { name: /Confirmar exclusão/i }).click();
    }
  });
});

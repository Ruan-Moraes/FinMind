import { test, expect } from '@playwright/test';

test.describe('E2E: Guarda de Segurança de Dupla Confirmação do Reset Geral', () => {
  test('bloqueia avanço para Etapa 2 quando o nome completo informado é incorreto', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Abrir Configurações no Header
    await page.getByRole('button', { name: 'Abrir Configurações' }).click();
    await expect(page.getByText('Configurações & Preferências')).toBeVisible();

    // 2. Clicar em "Limpar / Resetar" na Zona de Perigo
    await page.getByRole('button', { name: 'Limpar / Resetar' }).click();
    await expect(page.getByText('Limpar Dados Financeiros — Dupla Confirmação')).toBeVisible();
    await expect(
      page.getByText('Etapa 1 de 2: Confirmação de identidade por nome completo')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Zerar apenas valores e lançamentos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Resetar tudo \(do zero\)/i })).toBeVisible();

    // 3. Informar nome incorreto e tentar avançar para a 2ª confirmação
    const nameInput = page.locator('#form-reset-step-1 input');
    await nameInput.fill('Nome Completamente Errado E2E');
    await page.getByRole('button', { name: /Avançar para 2ª Confirmação/i }).click();

    // 4. Validar que o bloqueio manteve a Etapa 1 e o botão definitivo NÃO foi exibido
    await expect(
      page.getByRole('button', { name: /Confirmar Reset Definitivo/i })
    ).toHaveCount(0);
    await expect(
      page.getByText(/Etapa 1 de 2|exatamente|inválid/i).first()
    ).toBeVisible();

    // 5. Cancelar com segurança no modal superior (Reset)
    await page
      .getByRole('dialog')
      .last()
      .getByRole('button', { name: 'Cancelar' })
      .click();
  });
});

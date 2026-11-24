import { test, expect } from '@playwright/test';

test.describe('E2E: Dias Úteis em Regras Estáticas & Calendário de Feriados nas Configurações', () => {
  test('configura feriado municipal em Configurações, cria regra no 5º dia útil e limpa ao final', async ({
    page,
  }) => {
    await page.goto('/');

    const suffix = Date.now().toString().slice(-4);
    const holidayName = `E2E Feriado Local ${suffix}`;

    // 1. Abrir Configurações & Preferências no Header (engrenagem)
    await page.getByRole('button', { name: 'Abrir Configurações' }).click();
    await expect(page.getByText('Configurações & Preferências')).toBeVisible();
    await expect(page.getByText('Localização & Calendário de Feriados (Dias Úteis)')).toBeVisible();
    await expect(page.getByLabel('Cidade para feriados municipais')).toBeVisible();

    // 2. Abrir Calendário de Feriados a partir das Configurações e cadastrar um feriado municipal manual
    await page.getByRole('button', { name: /Calendário de Feriados/i }).click();
    await expect(
      page.getByRole('heading', { name: 'Calendário de Feriados (Dias Úteis)', exact: true })
    ).toBeVisible();

    await page.locator('input[aria-label="Data do feriado"]').fill('2026-11-04');
    await page.getByPlaceholder('Ex: Aniversário da Cidade').fill(holidayName);
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect(page.getByText(holidayName)).toBeVisible();

    // Fechar modal de Feriados e modal de Configurações
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

    // 3. Navegar para Meta de Carteira & Custos Estáticos e criar Ganho Estático no 5º dia útil
    await page.getByRole('button', { name: /Meta de Carteira & Custos Estáticos/i }).click();
    const ruleTitle = `E2E Salário 5º Dia Útil ${suffix}`;
    await page.getByRole('button', { name: /Novo Ganho Estático/i }).click();
    await page.locator('#form-static-rule input[placeholder*="Salário Fixo"]').fill(ruleTitle);
    await page.locator('#form-static-rule input[placeholder="1500,00"]').fill('3500,00');

    await page.locator('#form-static-rule').getByRole('button', { name: 'Dia Útil' }).click();
    await expect(page.locator('#form-static-rule')).toContainText(/5º dia útil em/i);
    await page.getByRole('button', { name: /Salvar Regra Fixa/i }).click();

    // 4. Validar exibição na tabela (5º dia útil + Cai em dd/mm/yyyy)
    const ruleRow = page.locator('table tbody tr').filter({ hasText: ruleTitle }).first();
    await expect(ruleRow).toContainText('5º dia útil');
    await expect(ruleRow).toContainText(/Cai em \d{2}\/\d{2}\/\d{4}/);

    // 5. Limpar regra e feriado criados no teste
    await ruleRow.getByRole('button', { name: `Ações para ${ruleTitle}` }).click();
    await page.getByRole('menuitem', { name: /Excluir regra/i }).click();
    await page.getByRole('button', { name: 'Sim, Excluir Regra' }).click();
    await expect(page.getByText(ruleTitle)).toHaveCount(0);

    await page.getByRole('button', { name: 'Abrir Configurações' }).click();
    await page.getByRole('button', { name: /Calendário de Feriados/i }).click();
    const holRow = page
      .locator('div')
      .filter({ hasText: holidayName })
      .filter({ has: page.getByTitle('Excluir feriado') })
      .last();
    await holRow.getByTitle('Excluir feriado').click();
    await expect(page.getByText(holidayName)).toHaveCount(0);
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  });
});

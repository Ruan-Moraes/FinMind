import type { Page } from '@playwright/test';

/**
 * Garante que os valores monetários estejam visíveis (Modo Privacidade desativado)
 * antes de asserções que verificam cifras em BRL, independente da preferência salva no banco local.
 */
export async function ensureValuesVisible(page: Page): Promise<void> {
  const mainText = (await page.locator('main').textContent()) || '';
  if (mainText.includes('••••')) {
    await page.getByRole('button', { name: 'Alternar Modo Privacidade' }).click();
  }
}

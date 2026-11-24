import { describe, it, expect } from 'vitest';
import { okResult, failResult, type ActionResult } from '@/shared/types/action-result';
import { encryptSecret, decryptSecret } from '@/features/auth/domain/secret-crypto';
import {
  formatCentsToBRL,
  formatCentsToInput,
  parseInputToCents,
} from '@/shared/lib/currency';
import { isPublicAuthRequired } from '@/features/auth/domain/access-policy';

describe('Núcleo Puro: ActionResult, Criptografia IV Único, Moeda BRL & Política de Acesso', () => {
  it('okResult e failResult produzem contratos discriminados consistentes', () => {
    const success: ActionResult<{ count: number }> = okResult({ count: 42 });
    const failure: ActionResult<{ count: number }> = failResult('Valor inválido.');
    const emptyOk = okResult();

    expect(success.ok).toBe(true);
    if (success.ok) expect(success.count).toBe(42);

    expect(failure.ok).toBe(false);
    if (!failure.ok) expect(failure.error).toBe('Valor inválido.');

    expect(emptyOk).toEqual({ ok: true });
  });

  it('encryptSecret gera IV aleatório único por cifragem mantendo decifragem exata', () => {
    const secret = 'sk-proj-random-iv-verification-key-2026';
    const c1 = encryptSecret(secret);
    const c2 = encryptSecret(secret);

    expect(c1).not.toBe(c2);
    expect(decryptSecret(c1)).toBe(secret);
    expect(decryptSecret(c2)).toBe(secret);
    expect(decryptSecret(null)).toBe('');
    expect(decryptSecret(undefined)).toBe('');
  });

  it('parseInputToCents e formatCentsToBRL lidam com milhares, negativos, zeros e modo privacidade', () => {
    expect(parseInputToCents('R$ 1.234.567,89')).toBe(123456789);
    expect(parseInputToCents('0,00')).toBe(0);
    expect(parseInputToCents('  45,30  ')).toBe(4530);
    expect(parseInputToCents('')).toBe(0);
    expect(formatCentsToInput(123456)).toBe('1234,56');
    expect(formatCentsToBRL(414860)).toContain('4.148,60');
    expect(formatCentsToBRL(-104540)).toContain('1.045,40');
    expect(formatCentsToBRL(999999, true)).toBe('R$ ••••••');
  });

  it('isPublicAuthRequired respeita precedência explícita sobre flag VERCEL', () => {
    expect(isPublicAuthRequired({ VERCEL: '1' })).toBe(true);
    expect(isPublicAuthRequired({ VERCEL: '1', REQUIRE_AUTH: 'false' })).toBe(false);
    expect(isPublicAuthRequired({ VERCEL: '0', REQUIRE_AUTH: 'true' })).toBe(true);
    expect(isPublicAuthRequired({})).toBe(false);
  });
});

/**
 * Contrato padronizado de retorno para Server Actions e Services do FinMind.
 */
export type ActionResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export function okResult<T extends Record<string, unknown> = Record<string, never>>(
  data?: T
): { ok: true } & T {
  return { ok: true, ...(data || ({} as T)) };
}

export function failResult(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

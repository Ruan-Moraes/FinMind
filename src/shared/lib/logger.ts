const REDACTED_KEYS = ['apikey', 'token', 'password', 'secret', 'authorization'];

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    const lower = key.toLowerCase();
    if (REDACTED_KEYS.some((k) => lower.includes(k))) {
      clean[key] = '[REDACTED]';
    } else if (value instanceof Error) {
      clean[key] = value.message;
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Logger estruturado leve para falhas não-fatais e diagnósticos operacionais,
 * garantindo sanitização de credenciais e silêncio em ambiente de testes unitários.
 */
export function logWarn(scope: string, message: string, meta?: Record<string, unknown>): void {
  if (process.env.VITEST) return;
  const payload = sanitizeMeta(meta);
  if (payload) {
    console.warn(`[FinMind:${scope}] ${message}`, payload);
  } else {
    console.warn(`[FinMind:${scope}] ${message}`);
  }
}

export function logError(scope: string, message: string, error?: unknown): void {
  if (process.env.VITEST) return;
  const detail = error instanceof Error ? error.message : String(error ?? '');
  console.error(`[FinMind:${scope}] ${message}`, detail ? { detail } : {});
}

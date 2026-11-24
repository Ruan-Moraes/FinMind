/**
 * Política de exigência de autenticação por ambiente.
 * Em ambientes públicos (Vercel ou REQUIRE_AUTH=true), o acesso exige sessão JWT válida
 * sem fallback automático para o usuário local.
 */
export function isPublicAuthRequired(
  env: Record<string, string | undefined> = process.env
): boolean {
  if (env.VERCEL === '1' || env.NETLIFY === 'true') return true;
  if (env.REQUIRE_AUTH !== undefined) return env.REQUIRE_AUTH !== 'false';
  return env.NODE_ENV === 'production';
}

export function requirePublicAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32 || secret === 'troque-por-um-segredo-forte-de-32-bytes') {
    throw new Error('Configure AUTH_SECRET com um segredo aleatório de pelo menos 32 caracteres.');
  }
  return secret;
}

export function isStrongAdminPassword(password: string): boolean {
  return password.trim().length >= 16 &&
    new TextEncoder().encode(password).length <= 72 &&
    password !== 'troque-por-uma-senha-forte';
}

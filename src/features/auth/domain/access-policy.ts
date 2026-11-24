/**
 * Política de exigência de autenticação por ambiente.
 * Em ambientes públicos (Vercel ou REQUIRE_AUTH=true), o acesso exige sessão JWT válida
 * sem fallback automático para o usuário local.
 */
export function isPublicAuthRequired(
  env: Record<string, string | undefined> = process.env
): boolean {
  if (env.REQUIRE_AUTH === 'false') {
    return false;
  }
  if (env.REQUIRE_AUTH === 'true') {
    return true;
  }
  return env.VERCEL === '1';
}

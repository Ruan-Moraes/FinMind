import {
  SSO_COOKIE_NAME,
  SsoIdentityProvider,
  SsoSessionPayload,
  signSsoJwtToken,
  verifySsoJwtToken,
} from '@/features/auth/domain/sso-jwt';

/**
 * Emite e grava o cookie HTTP-Only da sessão Single Sign-On (SSO).
 */
export async function issueSsoSessionCookie(params: {
  userId: string;
  email: string;
  name: string;
  idpProvider?: SsoIdentityProvider;
}): Promise<{ token: string; session: SsoSessionPayload }> {
  const { token, payload } = await signSsoJwtToken(params);
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();

    cookieStore.set(SSO_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12, // 12 horas
    });

    cookieStore.delete('finmind_sso_revoked');
  } catch {
    // Contexto fora do ciclo HTTP do Next.js (ex.: testes de integração)
  }

  return { token, session: payload };
}

/**
 * Revoga explicitamente a sessão SSO ativa (bloqueando imediatamente qualquer chamada aos LLMs).
 */
export async function revokeSsoSessionCookie(): Promise<void> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    cookieStore.delete(SSO_COOKIE_NAME);
    cookieStore.set('finmind_sso_revoked', 'true', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
  } catch {
    // Contexto fora do ciclo HTTP do Next.js (ex.: testes de integração)
  }
}

/**
 * Obtém a sessão SSO ativa a partir dos cookies ou cabeçalho Authorization/X-FinMind-SSO-Token.
 */
export async function getActiveSsoSession(
  explicitHeaderToken?: string | null
): Promise<{
  authenticated: boolean;
  token: string | null;
  session: SsoSessionPayload | null;
  error?: string;
}> {
  if (explicitHeaderToken) {
    const cleanToken = explicitHeaderToken.replace(/^Bearer\s+/i, '').trim();
    const verified = await verifySsoJwtToken(cleanToken, 'ai:invoke');
    return {
      authenticated: verified.valid,
      token: verified.valid ? cleanToken : null,
      session: verified.payload || null,
      error: verified.error,
    };
  }

  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const isRevoked = cookieStore.get('finmind_sso_revoked')?.value === 'true';
    if (isRevoked) {
      return {
        authenticated: false,
        token: null,
        session: null,
        error: 'Sessão SSO desconectada pelo usuário. Autentique-se via SSO para liberar o acesso às IAs.',
      };
    }

    const token = cookieStore.get(SSO_COOKIE_NAME)?.value;
    if (!token) {
      return {
        authenticated: false,
        token: null,
        session: null,
        error: 'Nenhuma sessão SSO ativa encontrada.',
      };
    }

    const verified = await verifySsoJwtToken(token, 'ai:invoke');
    return {
      authenticated: verified.valid,
      token: verified.valid ? token : null,
      session: verified.payload || null,
      error: verified.error,
    };
  } catch {
    return {
      authenticated: false,
      token: null,
      session: null,
      error: 'Erro ao verificar sessão SSO.',
    };
  }
}

import { SignJWT, jwtVerify } from 'jose';

export const SSO_COOKIE_NAME = 'finmind_sso_token';

const ssoSecretKey = new TextEncoder().encode(
  process.env.SSO_JWT_SECRET ||
    process.env.AUTH_SECRET ||
    'finmind-sso-federated-identity-secret-key-2026'
);

export type SsoIdentityProvider =
  | 'ENTERPRISE_OIDC'
  | 'OPENAI_SSO'
  | 'GOOGLE_WORKSPACE_SSO'
  | 'ANTHROPIC_SSO';

export type SsoScope = 'ai:invoke' | 'ai:models:select' | 'ai:sanity:check' | 'finance:rw';

export interface SsoSessionPayload {
  sessionId: string;
  sub: string;
  email: string;
  name: string;
  idpProvider: SsoIdentityProvider;
  scopes: SsoScope[];
  issuedAtIso: string;
  expiresAtIso: string;
}

/**
 * Gera um JWT assinado para a camada de Single Sign-On (SSO) que protege o acesso aos LLMs.
 */
export async function signSsoJwtToken(params: {
  userId: string;
  email: string;
  name: string;
  idpProvider?: SsoIdentityProvider;
  scopes?: SsoScope[];
}): Promise<{ token: string; payload: SsoSessionPayload }> {
  const now = new Date();
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 12); // 12h SSO Token TTL
  const sessionId = `sso_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;

  const payload: SsoSessionPayload = {
    sessionId,
    sub: params.userId,
    email: params.email,
    name: params.name,
    idpProvider: params.idpProvider || 'ENTERPRISE_OIDC',
    scopes: params.scopes || [
      'ai:invoke',
      'ai:models:select',
      'ai:sanity:check',
      'finance:rw',
    ],
    issuedAtIso: now.toISOString(),
    expiresAtIso: expires.toISOString(),
  };

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(params.userId)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(ssoSecretKey);

  return { token, payload };
}

/**
 * Valida criptograficamente um token JWT de SSO e verifica os escopos exigidos antes de liberar chamadas às IAs.
 */
export async function verifySsoJwtToken(
  token: string,
  requiredScope: SsoScope = 'ai:invoke'
): Promise<{ valid: boolean; payload?: SsoSessionPayload; error?: string }> {
  if (!token || !token.trim()) {
    return { valid: false, error: 'Token SSO ausente.' };
  }

  try {
    const { payload } = await jwtVerify(token, ssoSecretKey);
    const scopes = Array.isArray(payload.scopes) ? (payload.scopes as SsoScope[]) : [];

    if (!scopes.includes(requiredScope)) {
      return {
        valid: false,
        error: `Permissão insuficiente no token SSO. Escopo exigido: ${requiredScope}`,
      };
    }

    return {
      valid: true,
      payload: {
        sessionId: String(payload.sessionId || ''),
        sub: String(payload.sub || ''),
        email: String(payload.email || ''),
        name: String(payload.name || ''),
        idpProvider: (payload.idpProvider as SsoIdentityProvider) || 'ENTERPRISE_OIDC',
        scopes,
        issuedAtIso: String(payload.issuedAtIso || ''),
        expiresAtIso: String(payload.expiresAtIso || ''),
      },
    };
  } catch {
    return {
      valid: false,
      error: 'Sessão SSO expirada ou assinatura de token inválida.',
    };
  }
}

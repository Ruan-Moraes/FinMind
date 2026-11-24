import { SignJWT, jwtVerify } from 'jose';
import { isPublicAuthRequired, requirePublicAuthSecret } from './access-policy';

export const SESSION_COOKIE = 'finmind_session';
export const LOGGED_OUT_COOKIE = 'finmind_logged_out';

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
}

export function getJwtSecretKey(explicitSecret?: string): Uint8Array {
  const rawSecret =
    explicitSecret || (isPublicAuthRequired()
      ? requirePublicAuthSecret()
      : process.env.AUTH_SECRET ||
        process.env.NEXTAUTH_SECRET ||
        'finmind-personal-hmac-sha256-session-key');
  return new TextEncoder().encode(rawSecret);
}

/**
 * Gera um JWT HS256 puro de sessão de usuário (100% determinístico / sem I/O de cookies).
 */
export async function signSessionJwt(
  payload: SessionPayload,
  explicitSecret?: string
): Promise<string> {
  const secretKey = getJwtSecretKey(explicitSecret);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey);
}

/**
 * Verifica criptograficamente um JWT de sessão de usuário sem depender de `next/headers`.
 */
export async function verifySessionJwt(
  token: string,
  explicitSecret?: string
): Promise<SessionPayload | null> {
  if (!token || !token.trim()) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(explicitSecret), {
      algorithms: ['HS256'],
      requiredClaims: ['exp'],
    });
    if (typeof payload.userId !== 'string' || !payload.userId) return null;
    return {
      userId: String(payload.userId),
      email: String(payload.email || ''),
      name: String(payload.name || ''),
    };
  } catch {
    return null;
  }
}

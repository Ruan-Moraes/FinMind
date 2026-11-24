import { cookies } from 'next/headers';
import {
  LOGGED_OUT_COOKIE,
  SESSION_COOKIE,
  SessionPayload,
  signSessionJwt,
  verifySessionJwt,
} from '@/features/auth/domain/jwt-session';

export async function createSessionCookie(payload: SessionPayload) {
  const token = await signSessionJwt(payload);

  const cookieStore = await cookies();
  cookieStore.delete(LOGGED_OUT_COOKIE);
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.set(LOGGED_OUT_COOKIE, 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function isSessionExplicitlyLoggedOut(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(LOGGED_OUT_COOKIE)?.value === 'true';
  } catch {
    return false;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    if (cookieStore.get(LOGGED_OUT_COOKIE)?.value === 'true') {
      return null;
    }
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return verifySessionJwt(token);
  } catch {
    return null;
  }
}

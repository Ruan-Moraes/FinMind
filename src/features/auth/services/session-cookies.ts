import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/shared/lib/prisma';
import { isPublicAuthRequired } from '@/features/auth/domain/access-policy';
import {
  LOGGED_OUT_COOKIE,
  SESSION_COOKIE,
  SessionPayload,
  signSessionJwt,
  verifySessionJwt,
} from '@/features/auth/domain/jwt-session';
import { OWNER_REGISTRATION_ID } from './owner-registration';

export const PUBLIC_SESSION_COOKIE = '__Host-finmind_session';
const PUBLIC_SESSION_SECONDS = 7 * 24 * 60 * 60;
const LOCAL_SESSION_SECONDS = 30 * 24 * 60 * 60;
const PUBLIC_COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } as const;

function publicTokenHash(token: string | undefined): string | null {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return createHash('sha256').update(token).digest('hex');
}

export async function createSessionCookie(payload: SessionPayload) {
  const cookieStore = await cookies();
  cookieStore.delete(LOGGED_OUT_COOKIE);

  if (isPublicAuthRequired()) {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PUBLIC_SESSION_SECONDS * 1000);
    await prisma.authSession.deleteMany({ where: { userId: payload.userId, expiresAt: { lte: now } } });
    await prisma.authSession.create({
      data: { userId: payload.userId, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt },
    });
    cookieStore.set(PUBLIC_SESSION_COOKIE, token, { ...PUBLIC_COOKIE_OPTIONS, maxAge: PUBLIC_SESSION_SECONDS });
    return;
  }

  cookieStore.set(SESSION_COOKIE, await signSessionJwt(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: LOCAL_SESSION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  if (isPublicAuthRequired()) {
    const tokenHash = publicTokenHash(cookieStore.get(PUBLIC_SESSION_COOKIE)?.value);
    try {
      if (tokenHash) await prisma.authSession.deleteMany({ where: { tokenHash } });
    } finally {
      cookieStore.set(PUBLIC_SESSION_COOKIE, '', { ...PUBLIC_COOKIE_OPTIONS, maxAge: 0 });
      cookieStore.delete(SESSION_COOKIE);
    }
    return;
  }

  cookieStore.delete(SESSION_COOKIE);
  cookieStore.set(LOGGED_OUT_COOKIE, 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: LOCAL_SESSION_SECONDS,
  });
}

export async function isSessionExplicitlyLoggedOut(): Promise<boolean> {
  if (isPublicAuthRequired()) return false;
  try {
    return (await cookies()).get(LOGGED_OUT_COOKIE)?.value === 'true';
  } catch {
    return false;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    if (isPublicAuthRequired()) {
      const tokenHash = publicTokenHash(cookieStore.get(PUBLIC_SESSION_COOKIE)?.value);
      if (!tokenHash) return null;
      const session = await prisma.authSession.findFirst({
        where: {
          tokenHash,
          expiresAt: { gt: new Date() },
          user: { authOwner: { is: { id: OWNER_REGISTRATION_ID } } },
        },
        select: { user: { select: { id: true, email: true, name: true } } },
      });
      if (!session) return null;
      return { userId: session.user.id, email: session.user.email, name: session.user.name };
    }

    if (cookieStore.get(LOGGED_OUT_COOKIE)?.value === 'true') return null;
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    return token ? verifySessionJwt(token) : null;
  } catch {
    return null;
  }
}

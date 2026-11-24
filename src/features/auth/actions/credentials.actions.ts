'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { prisma } from '@/shared/lib/prisma';
import {
  isPublicAuthRequired,
  isStrongAdminPassword,
  requirePublicAuthSecret,
} from '@/features/auth/domain/access-policy';
import { authClientKey, reserveAuthAttempt } from '@/features/auth/services/auth-attempts';
import {
  isValidOwnerInvitation,
  OWNER_REGISTRATION_ID,
  registerOwner,
} from '@/features/auth/services/owner-registration';
import { createSessionCookie } from '@/features/auth/services/session-cookies';
import { ensurePersonalUserInitialized } from '@/features/auth/services/user-bootstrap';

const BCRYPT_COST = 12;
const DUMMY_PASSWORD_HASH = '$2b$12$7lCjAcLR5hyJsxHYKcze.ONrjGP/hcuYkdSXB1dK0gmRmbUgjGjZm';
const AUTH_RESPONSE_FLOOR_MS = 650;
const LOGIN_FAILURE = { ok: false, error: 'E-mail ou senha incorretos.' } as const;
const REGISTER_FAILURE = { ok: false, error: 'Não foi possível cadastrar. Confira os dados e tente novamente.' } as const;

function readField(form: FormData, key: string, maxLength: number): string {
  const value = form.get(key);
  return typeof value === 'string' && value.length <= maxLength ? value : '';
}

function hasHoneypot(form: FormData): boolean {
  return form.getAll('website').some((value) => value !== '');
}

async function canAttempt(flow: 'login' | 'register'): Promise<boolean> {
  const secret = requirePublicAuthSecret();
  const address = process.env.VERCEL === '1'
    ? (await headers()).get('x-vercel-forwarded-for')
    : null;
  return reserveAuthAttempt(flow, authClientKey(address), secret);
}

async function padResponse(startedAt: number): Promise<void> {
  const remaining = AUTH_RESPONSE_FLOOR_MS - (performance.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

export async function loginAction(form: FormData) {
  const startedAt = performance.now();
  const publicAuth = isPublicAuthRequired();

  try {
    const email = readField(form, 'email', 254).trim().toLowerCase();
    const password = readField(form, 'password', 72);
    if (publicAuth && !await canAttempt('login')) return LOGIN_FAILURE;

    const user = publicAuth
      ? (await prisma.authOwner.findUnique({
          where: { id: OWNER_REGISTRATION_ID },
          select: { user: { select: { id: true, email: true, name: true, passwordHash: true } } },
        }))?.user
      : await ensurePersonalUserInitialized();

    const acceptablePassword = publicAuth ? isStrongAdminPassword(password) : Boolean(password);
    const hash = user && acceptablePassword && email === user.email
      ? user.passwordHash
      : DUMMY_PASSWORD_HASH;
    const matches = await bcrypt.compare(acceptablePassword ? password : '', hash);
    if (!user || !matches || !acceptablePassword || email !== user.email || hasHoneypot(form)) {
      return LOGIN_FAILURE;
    }

    await createSessionCookie({ userId: user.id, email: user.email, name: user.name });
    revalidatePath('/');
    return { ok: true as const };
  } catch {
    return LOGIN_FAILURE;
  } finally {
    if (publicAuth) await padResponse(startedAt);
  }
}

export async function registerOwnerAction(form: FormData) {
  const startedAt = performance.now();

  try {
    if (!isPublicAuthRequired() || !await canAttempt('register')) return REGISTER_FAILURE;

    const email = readField(form, 'email', 254).trim().toLowerCase();
    const password = readField(form, 'password', 72);
    const confirmation = readField(form, 'password_confirmation', 72);
    const invitation = readField(form, 'invitation', 128).trim();
    const passwordIsValid = isStrongAdminPassword(password);
    const passwordHash = await bcrypt.hash(passwordIsValid ? password : '', BCRYPT_COST);

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !passwordIsValid ||
      password !== confirmation ||
      !isValidOwnerInvitation(invitation) ||
      hasHoneypot(form)
    ) {
      return REGISTER_FAILURE;
    }

    const user = await registerOwner(email, passwordHash);
    if (!user) return REGISTER_FAILURE;

    await createSessionCookie({ userId: user.id, email: user.email, name: user.name });
    revalidatePath('/');
    return { ok: true as const };
  } catch {
    return REGISTER_FAILURE;
  } finally {
    await padResponse(startedAt);
  }
}

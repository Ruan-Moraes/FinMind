import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { loginAction, registerOwnerAction } from '@/features/auth/actions/credentials.actions';
import { clearSessionCookie, getSession, PUBLIC_SESSION_COOKIE } from '@/features/auth/services/session-cookies';
import { signSessionJwt } from '@/features/auth/domain/jwt-session';
import { reserveAuthAttempt } from '@/features/auth/services/auth-attempts';
import { isOwnerRegistrationOpen } from '@/features/auth/services/owner-registration';
import { GET as getModels, POST as postModels } from '@/app/api/ai/models/route';
import { GET as getProviders } from '@/app/api/ai/providers/state/route';
import { GET as getSanity, POST as postSanity } from '@/app/api/ai/sanity-check/route';
import { POST as transcribe } from '@/app/api/ai/transcribe/route';
import { GET as getExport } from '@/app/api/export/route';
import { GET as getSnapshot, POST as postSnapshot } from '@/app/api/snapshot/route';
import { updateUserSettingsAction } from '@/features/auth/actions/auth-settings.actions';

const requestCookies = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) => requestCookies.has(name) ? { value: requestCookies.get(name) } : undefined,
    set: (name: string, value: string) => requestCookies.set(name, value),
    delete: (name: string) => requestCookies.delete(name),
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('Cadastro do titular e autenticação pública', () => {
  afterEach(() => {
    requestCookies.clear();
    vi.unstubAllEnvs();
  });

  it('bloqueia todos os endpoints privados e ações financeiras sem sessão', async () => {
    vi.stubEnv('REQUIRE_AUTH', 'true');
    const routes = [
      ['GET', '/api/ai/models', getModels],
      ['POST', '/api/ai/models', postModels],
      ['GET', '/api/ai/providers/state', getProviders],
      ['GET', '/api/ai/sanity-check', getSanity],
      ['POST', '/api/ai/sanity-check', postSanity],
      ['POST', '/api/ai/transcribe', transcribe],
      ['GET', '/api/export?format=json', getExport],
      ['GET', '/api/snapshot', getSnapshot],
      ['POST', '/api/snapshot', postSnapshot],
    ] as const;
    for (const [method, path, handler] of routes) {
      const response = await handler(new NextRequest(`http://localhost${path}`, { method }));
      expect(response.status, `${method} ${path}`).toBe(401);
    }
    await expect(updateUserSettingsAction({ theme: 'LIGHT' })).rejects.toThrow(/Autenticação obrigatória/);
  });

  it('troca a credencial legada e revoga sessões sem mover os dados do titular', async () => {
    const id = randomUUID();
    const legacyEmail = `legacy-${id}@finmind.local`;
    const newEmail = `owner-${id}@finmind.local`;
    const oldPassword = 'Old-password-for-tests';
    const password = 'New-password-for-tests';
    const invitation = randomBytes(32).toString('base64url');
    vi.stubEnv('REQUIRE_AUTH', 'true');
    vi.stubEnv('AUTH_SECRET', randomBytes(32).toString('base64url'));
    vi.stubEnv('AUTH_SETUP_TOKEN', invitation);
    vi.stubEnv('ADMIN_EMAIL', legacyEmail);
    const original = await prisma.user.create({
      data: {
        email: legacyEmail,
        passwordHash: await bcrypt.hash(oldPassword, 10),
        name: 'Titular de teste',
        accounts: { create: { name: 'Conta preservada', type: 'CHECKING' } },
      },
    });

    try {
      expect(await isOwnerRegistrationOpen()).toBe(true);
      const oldJwt = await signSessionJwt({ userId: original.id, email: legacyEmail, name: original.name });
      requestCookies.set('finmind_session', oldJwt);
      expect(await getSession()).toBeNull();

      const beforeSetup = await loginAction(form({ email: legacyEmail, password: oldPassword }));
      const missingUser = await loginAction(form({ email: newEmail, password }));
      expect(beforeSetup).toEqual(missingUser);
      expect(beforeSetup.ok).toBe(false);

      const fields = { email: newEmail, password, password_confirmation: password, invitation };
      const badInvite = await registerOwnerAction(form({ ...fields, invitation: '' }));
      const trappedBot = await registerOwnerAction(form({ ...fields, website: 'filled' }));
      expect(trappedBot).toEqual(badInvite);
      expect(trappedBot.ok).toBe(false);
      expect(await registerOwnerAction(form(fields))).toEqual({ ok: true });

      expect(await isOwnerRegistrationOpen()).toBe(false);
      expect(await registerOwnerAction(form(fields))).toEqual(badInvite);
      expect(await prisma.account.count({ where: { userId: original.id } })).toBe(1);
      expect(await prisma.user.findUnique({ where: { email: legacyEmail } })).toBeNull();
      expect(await getSession()).toMatchObject({ userId: original.id, email: newEmail });

      for (const [path, handler] of [
        ['/api/ai/models', postModels],
        ['/api/ai/sanity-check', postSanity],
        ['/api/ai/transcribe', transcribe],
        ['/api/snapshot', postSnapshot],
      ] as const) {
        const request = new NextRequest(`http://localhost${path}`, {
          method: 'POST',
          headers: { Origin: 'https://untrusted.example' },
        });
        expect((await handler(request)).status, path).toBe(403);
      }

      const previousCookie = requestCookies.get(PUBLIC_SESSION_COOKIE)!;
      expect(previousCookie).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(await prisma.authSession.count({ where: { tokenHash: previousCookie } })).toBe(0);
      await clearSessionCookie();
      requestCookies.set(PUBLIC_SESSION_COOKIE, previousCookie);
      expect(await getSession()).toBeNull();
      expect(await loginAction(form({ email: newEmail, password: oldPassword }))).toEqual(beforeSetup);
      expect(await loginAction(form({ email: newEmail, password, website: 'filled' }))).toEqual(beforeSetup);
      expect(await loginAction(form({ email: newEmail, password }))).toEqual({ ok: true });
    } finally {
      await prisma.authOwner.deleteMany({ where: { userId: original.id } });
      await prisma.user.delete({ where: { id: original.id } });
    }
  }, 15000);

  it('reserva cota atômica por origem e reinicia na janela seguinte', async () => {
    const secret = randomBytes(32).toString('base64url');
    const now = Date.now();
    const attempts = await Promise.all(
      Array.from({ length: 12 }, () => reserveAuthAttempt('login', '198.51.100.10', secret, now))
    );
    expect(attempts.filter(Boolean)).toHaveLength(8);
    expect(await reserveAuthAttempt('login', '198.51.100.11', secret, now)).toBe(true);
    expect(await reserveAuthAttempt('login', '198.51.100.10', secret, now + 600_000)).toBe(true);
    for (let i = 1; i <= 20; i++) {
      expect(await reserveAuthAttempt('register', `198.51.100.${i}`, secret, now)).toBe(true);
    }
    expect(await reserveAuthAttempt('register', '198.51.100.21', secret, now)).toBe(false);
  });
});

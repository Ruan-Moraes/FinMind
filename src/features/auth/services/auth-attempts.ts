import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { prisma } from '@/shared/lib/prisma';

const AUTH_WINDOW_MS = 10 * 60_000;

export function authClientKey(platformAddress: string | null): string {
  const address = platformAddress?.trim();
  return address && isIP(address) ? address : 'shared';
}

export async function reserveAuthAttempt(
  flow: 'login' | 'register',
  client: string,
  secret: string,
  now = Date.now()
): Promise<boolean> {
  const window = Math.floor(now / AUTH_WINDOW_MS);
  const expiresAt = new Date((window + 1) * AUTH_WINDOW_MS);
  const keyFor = (scope: string) => createHmac('sha256', secret)
    .update(`${flow}:${window}:${scope}`)
    .digest('hex');

  // Aumenta o contador no banco antes de executar bcrypt, inclusive sob concorrência.
  const reserve = async (scope: string) => {
    const key = keyFor(scope);
    const bucket = await prisma.authAttempt.upsert({
      where: { key },
      create: { key, expiresAt, attempts: 1 },
      update: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return bucket.attempts;
  };

  const perClient = flow === 'login' ? 8 : 5;
  if (await reserve(`client:${client}`) > perClient) return false;
  const total = await reserve('global');
  if (total === 1) {
    await prisma.authAttempt.deleteMany({ where: { expiresAt: { lte: new Date(now) } } });
  }
  return total <= (flow === 'login' ? 60 : 20);
}

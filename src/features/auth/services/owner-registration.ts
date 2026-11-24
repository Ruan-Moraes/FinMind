import { createHash, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/shared/lib/prisma';
import { isPublicAuthRequired } from '@/features/auth/domain/access-policy';

export const OWNER_REGISTRATION_ID = 1;

function configuredInvitation(): string {
  const invitation = process.env.AUTH_SETUP_TOKEN?.trim() || '';
  return /^[A-Za-z0-9_-]{43,128}$/.test(invitation) ? invitation : '';
}

export function isValidOwnerInvitation(invitation: string): boolean {
  const configured = configuredInvitation();
  const digest = (value: string) => createHash('sha256').update(value).digest();
  const matches = timingSafeEqual(digest(configured), digest(invitation));
  return Boolean(configured) && matches;
}

export async function isOwnerRegistrationOpen(): Promise<boolean> {
  if (!isPublicAuthRequired() || !configuredInvitation()) return false;
  return !(await prisma.authOwner.findUnique({
    where: { id: OWNER_REGISTRATION_ID },
    select: { id: true },
  }));
}

export async function registerOwner(email: string, passwordHash: string) {
  return prisma.$transaction(async (tx) => {
    if (await tx.authOwner.findUnique({ where: { id: OWNER_REGISTRATION_ID } })) return null;

    const legacyEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || 'admin@finmind.app';
    const existing = await tx.user.findUnique({
      where: { email: legacyEmail },
      select: { id: true },
    });
    const identity = { id: true, email: true, name: true } as const;
    if (!existing && await tx.user.count()) return null;

    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { email, passwordHash },
          select: identity,
        })
      : await tx.user.create({
          data: {
            email,
            name: process.env.ADMIN_NAME?.trim() || 'Administrador FinMind',
            passwordHash,
            settings: { create: { aiConnectionMode: 'API_KEY', openaiModel: '', geminiModel: '', claudeModel: '' } },
          },
          select: identity,
        });

    await tx.authSession.deleteMany({ where: { userId: user.id } });
    await tx.authOwner.create({ data: { id: OWNER_REGISTRATION_ID, userId: user.id } });
    return user;
  });
}

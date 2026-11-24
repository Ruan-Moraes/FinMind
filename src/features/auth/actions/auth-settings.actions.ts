'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { prisma } from '@/shared/lib/prisma';
import {
  createSessionCookie,
  clearSessionCookie,
  ensurePersonalUserInitialized,
  requireAuthenticatedUser,
} from '@/features/auth';
import {
  resetAllFinancialDataForUser,
  type ResetDataScope,
} from '@/features/auth/services/reset-user-data';
import {
  extractFirstZodError,
  userSettingsSchema,
} from '@/features/planning/schemas/finance-schemas';

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') || '').toLowerCase().trim();
  const password = String(formData.get('password') || '');

  const user = await ensurePersonalUserInitialized();

  if (email !== user.email.toLowerCase()) {
    return { ok: false, error: 'Credenciais inválidas para o usuário exclusivo.' };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: 'Senha incorreta.' };
  }

  await createSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  revalidatePath('/');
  return { ok: true as const };
}

export async function logoutAction() {
  await clearSessionCookie();
  revalidatePath('/');
}

/**
 * RF-26: Atualiza e persiste as configurações do usuário diretamente no banco de dados.
 */
export async function updateUserSettingsAction(data: {
  theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
  density?: 'COMFORTABLE' | 'COMPACT';
  hideValuesByDefault?: boolean;
  fiscalMonthStartDay?: number;
  defaultAccountId?: string | null;
  holidayState?: string | null;
  holidayCity?: string | null;
}) {
  const user = await requireAuthenticatedUser();
  const parsed = userSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: extractFirstZodError(parsed.error) };
  }

  const valid = parsed.data;
  const updated = await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      theme: valid.theme || 'DARK',
      density: valid.density || 'COMFORTABLE',
      hideValuesByDefault: valid.hideValuesByDefault ?? false,
      fiscalMonthStartDay: valid.fiscalMonthStartDay ?? 1,
      defaultAccountId: valid.defaultAccountId ?? null,
      holidayState: valid.holidayState ? valid.holidayState.toUpperCase() : null,
      holidayCity: valid.holidayCity || null,
    },
    update: {
      ...(valid.theme !== undefined && { theme: valid.theme }),
      ...(valid.density !== undefined && { density: valid.density }),
      ...(valid.hideValuesByDefault !== undefined && {
        hideValuesByDefault: valid.hideValuesByDefault,
      }),
      ...(valid.fiscalMonthStartDay !== undefined && {
        fiscalMonthStartDay: valid.fiscalMonthStartDay,
      }),
      ...(valid.defaultAccountId !== undefined && {
        defaultAccountId: valid.defaultAccountId || null,
      }),
      ...(valid.holidayState !== undefined && {
        holidayState: valid.holidayState ? valid.holidayState.toUpperCase() : null,
      }),
      ...(valid.holidayCity !== undefined && {
        holidayCity: valid.holidayCity || null,
      }),
    },
  });

  revalidatePath('/');
  return { ok: true, settings: updated };
}

export async function resetAllFinancialDataAction(
  fullNameConfirmation: string,
  scope: ResetDataScope = 'ALL'
) {
  const user = await requireAuthenticatedUser();
  const result = await resetAllFinancialDataForUser(
    { id: user.id, name: user.name },
    fullNameConfirmation,
    scope
  );
  if (!result.ok) return result;

  revalidatePath('/');
  return { ok: true as const };
}

'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/lib/prisma';
import { clearSessionCookie, requireAuthenticatedUser } from '@/features/auth';
import {
  resetAllFinancialDataForUser,
  type ResetDataScope,
} from '@/features/auth/services/reset-user-data';
import {
  extractFirstZodError,
  userSettingsSchema,
} from '@/features/planning/schemas/finance-schemas';

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
  await prisma.userSettings.upsert({
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
  return { ok: true };
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

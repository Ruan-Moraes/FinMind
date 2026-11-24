'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/lib/prisma';
import { requireAuthenticatedUser } from '@/features/auth';
import {
  collectOfficialHolidaysForYears,
  discoverMunicipalHolidaysWithAi,
} from '@/features/planning/services/holidays-sync-service';
import type { HolidaySeedItem } from '@/features/planning/domain/brazil-holidays-catalog';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function syncOfficialHolidaysAction(data: {
  years: number[];
  stateCode?: string | null;
  cityName?: string | null;
}): Promise<{ ok: boolean; syncedCount?: number; apiUsed?: boolean; error?: string }> {
  const user = await requireAuthenticatedUser();
  const cleanState = data.stateCode?.trim().toUpperCase() || null;
  const cleanCity = data.cityName?.trim() || null;

  const { items, apiUsed } = await collectOfficialHolidaysForYears({
    years: data.years,
    stateCode: cleanState,
  });

  await prisma.$transaction([
    prisma.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, holidayState: cleanState, holidayCity: cleanCity },
      update: { holidayState: cleanState, holidayCity: cleanCity },
    }),
    ...items.map((item) =>
      prisma.holiday.upsert({
        where: {
          userId_date_name: { userId: user.id, date: item.date, name: item.name },
        },
        create: {
          userId: user.id,
          date: item.date,
          year: item.year,
          name: item.name,
          scope: item.scope,
          stateCode: item.stateCode || null,
          cityName: item.cityName || null,
          source: item.source,
          isActive: true,
        },
        update: {
          scope: item.scope,
          stateCode: item.stateCode || null,
          source: item.source,
        },
      })
    ),
  ]);

  revalidatePath('/');
  return { ok: true, syncedCount: items.length, apiUsed };
}

export async function suggestMunicipalHolidaysWithAiAction(data: {
  cityName: string;
  stateCode: string;
  year: number;
}): Promise<{ ok: boolean; suggestions?: HolidaySeedItem[]; modelUsed?: string; error?: string }> {
  const user = await requireAuthenticatedUser();
  return discoverMunicipalHolidaysWithAi({
    userId: user.id,
    cityName: data.cityName,
    stateCode: data.stateCode,
    year: data.year,
  });
}

export async function saveHolidaysBatchAction(items: Array<{
  date: string;
  name: string;
  scope: 'NATIONAL' | 'STATE' | 'MUNICIPAL';
  stateCode?: string | null;
  cityName?: string | null;
  source?: 'BRASIL_API' | 'STATE_CATALOG' | 'AI' | 'MANUAL';
}>): Promise<{ ok: boolean; savedCount?: number; error?: string }> {
  const user = await requireAuthenticatedUser();
  const valid = items.filter(
    (i) => ISO_DATE_RE.test(i.date.trim()) && i.name.trim().length >= 2
  );
  if (valid.length === 0) {
    return { ok: false, error: 'Informe uma data válida e o nome do feriado.' };
  }

  await prisma.$transaction(
    valid.map((item) => {
      const date = item.date.trim();
      const name = item.name.trim();
      const year = Number(date.slice(0, 4));
      return prisma.holiday.upsert({
        where: { userId_date_name: { userId: user.id, date, name } },
        create: {
          userId: user.id,
          date,
          year,
          name,
          scope: item.scope,
          stateCode: item.stateCode?.trim().toUpperCase() || null,
          cityName: item.cityName?.trim() || null,
          source: item.source || 'MANUAL',
          isActive: true,
        },
        update: {
          scope: item.scope,
          stateCode: item.stateCode?.trim().toUpperCase() || null,
          cityName: item.cityName?.trim() || null,
          isActive: true,
        },
      });
    })
  );

  revalidatePath('/');
  return { ok: true, savedCount: valid.length };
}

export async function toggleHolidayActiveAction(
  id: string,
  isActive: boolean
): Promise<{ ok: boolean }> {
  const user = await requireAuthenticatedUser();
  await prisma.holiday.updateMany({ where: { id, userId: user.id }, data: { isActive } });
  revalidatePath('/');
  return { ok: true };
}

export async function deleteHolidayAction(id: string): Promise<{ ok: boolean }> {
  const user = await requireAuthenticatedUser();
  await prisma.holiday.deleteMany({ where: { id, userId: user.id } });
  revalidatePath('/');
  return { ok: true };
}

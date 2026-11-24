import { buildFallbackNationalHolidays } from '@/features/planning/domain/brazil-holidays-catalog';

export interface HolidayRecord {
  id: string;
  date: string; // YYYY-MM-DD
  year: number;
  name: string;
  scope: string; // NATIONAL | STATE | MUNICIPAL
  stateCode?: string | null;
  cityName?: string | null;
  source: string;
  isActive: boolean;
}

export interface BusinessDayResolution {
  dateIso: string;
  day: number;
  month: number;
  year: number;
  formattedDate: string; // dd/mm/yyyy
  weekdayShort: string;
  weekdayFull: string;
  skippedHolidays: Array<{ date: string; name: string }>;
  usedFallbackNationalHolidays: boolean;
}

const WEEKDAYS_FULL = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function getEffectiveYearHolidayMap(
  year: number,
  holidays: HolidayRecord[]
): { map: Map<string, string>; usedFallback: boolean } {
  const yearRecords = holidays.filter((h) => h.year === year);
  const map = new Map<string, string>();

  if (yearRecords.length > 0) {
    for (const h of yearRecords) {
      if (h.isActive) {
        const existing = map.get(h.date);
        map.set(h.date, existing ? `${existing} / ${h.name}` : h.name);
      }
    }
    return { map, usedFallback: false };
  }

  for (const h of buildFallbackNationalHolidays(year)) {
    map.set(h.date, h.name);
  }
  return { map, usedFallback: true };
}

/**
 * Calcula a data exata do N-ésimo dia útil de um mês/ano considerando finais de semana
 * e feriados ativos cadastrados pelo usuário (ou feriados nacionais padrão se o ano ainda não foi sincronizado).
 */
export function computeNthBusinessDay(params: {
  year: number;
  month: number; // 1..12
  nthBusinessDay: number; // 1..23
  holidays: HolidayRecord[];
  includeSaturday?: boolean;
}): BusinessDayResolution {
  const { year, month, holidays, includeSaturday = false } = params;
  const targetNth = Math.max(1, Math.min(28, Math.round(params.nthBusinessDay || 1)));
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const { map: holidayMap, usedFallback } = getEffectiveYearHolidayMap(year, holidays);

  let businessCount = 0;
  let lastValidDay = 1;
  let lastValidWeekday = 1;
  const skippedHolidays: Array<{ date: string; name: string }> = [];

  for (let day = 1; day <= lastDayOfMonth; day++) {
    const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const dow = dt.getUTCDay(); // 0 = dom, 6 = sáb
    const dateIso = `${year}-${pad2(month)}-${pad2(day)}`;
    const holidayName = holidayMap.get(dateIso);

    const isWeekend = dow === 0 || (!includeSaturday && dow === 6);
    if (holidayName) {
      if (!isWeekend) {
        skippedHolidays.push({ date: `${pad2(day)}/${pad2(month)}`, name: holidayName });
      }
      continue;
    }
    if (isWeekend) continue;

    businessCount += 1;
    lastValidDay = day;
    lastValidWeekday = dow;
    if (businessCount === targetNth) {
      return {
        dateIso,
        day,
        month,
        year,
        formattedDate: `${pad2(day)}/${pad2(month)}/${year}`,
        weekdayShort: WEEKDAYS_SHORT[dow],
        weekdayFull: WEEKDAYS_FULL[dow],
        skippedHolidays,
        usedFallbackNationalHolidays: usedFallback,
      };
    }
  }

  const fallbackIso = `${year}-${pad2(month)}-${pad2(lastValidDay)}`;
  return {
    dateIso: fallbackIso,
    day: lastValidDay,
    month,
    year,
    formattedDate: `${pad2(lastValidDay)}/${pad2(month)}/${year}`,
    weekdayShort: WEEKDAYS_SHORT[lastValidWeekday],
    weekdayFull: WEEKDAYS_FULL[lastValidWeekday],
    skippedHolidays,
    usedFallbackNationalHolidays: usedFallback,
  };
}

export function resolveRecurrenceRuleDueDate(params: {
  dayOfMonth: number;
  dayType?: string | null;
  includeSaturday?: boolean | null;
  year: number;
  month: number;
  holidays: HolidayRecord[];
}): {
  isBusinessDay: boolean;
  label: string;
  resolution: BusinessDayResolution;
} {
  const isBusinessDay = params.dayType === 'BUSINESS_DAY';
  if (isBusinessDay) {
    const resolution = computeNthBusinessDay({
      year: params.year,
      month: params.month,
      nthBusinessDay: params.dayOfMonth,
      holidays: params.holidays,
      includeSaturday: Boolean(params.includeSaturday),
    });
    return {
      isBusinessDay: true,
      label: `${params.dayOfMonth}º dia útil`,
      resolution,
    };
  }

  const lastDay = new Date(Date.UTC(params.year, params.month, 0)).getUTCDate();
  const safeDay = Math.max(1, Math.min(lastDay, Math.round(params.dayOfMonth || 1)));
  const dt = new Date(Date.UTC(params.year, params.month - 1, safeDay, 12, 0, 0));
  const dow = dt.getUTCDay();
  return {
    isBusinessDay: false,
    label: `Todo dia ${params.dayOfMonth}`,
    resolution: {
      dateIso: `${params.year}-${pad2(params.month)}-${pad2(safeDay)}`,
      day: safeDay,
      month: params.month,
      year: params.year,
      formattedDate: `${pad2(safeDay)}/${pad2(params.month)}/${params.year}`,
      weekdayShort: WEEKDAYS_SHORT[dow],
      weekdayFull: WEEKDAYS_FULL[dow],
      skippedHolidays: [],
      usedFallbackNationalHolidays: false,
    },
  };
}

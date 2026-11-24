import { MONTH_NAMES_PT } from '@/shared/lib/currency';

export function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseSkippedMonths(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).filter((s) => /^\d{4}-\d{2}$/.test(s));
  }
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).filter((s) => /^\d{4}-\d{2}$/.test(s));
  } catch {
    return [];
  }
}

export function parseMonthlyOverrides(
  raw: string | Record<string, number> | null | undefined
): Record<string, number> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (/^\d{4}-\d{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v > 0) {
        out[k] = Math.round(v);
      }
    }
    return out;
  }
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (/^\d{4}-\d{2}$/.test(k) && Number.isFinite(n) && n > 0) {
        out[k] = Math.round(n);
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function isRuleSkippedInMonth(
  rule: { skippedMonths?: string | string[] | null },
  year: number,
  month: number
): boolean {
  const key = formatMonthKey(year, month);
  return parseSkippedMonths(rule.skippedMonths).includes(key);
}

export function hasRuleMonthOverride(
  rule: { monthlyOverrides?: string | Record<string, number> | null },
  year: number,
  month: number
): boolean {
  const key = formatMonthKey(year, month);
  return Object.prototype.hasOwnProperty.call(parseMonthlyOverrides(rule.monthlyOverrides), key);
}

export function getRuleEffectiveAmountForMonth(
  rule: { amountInCents: number; monthlyOverrides?: string | Record<string, number> | null },
  year: number,
  month: number
): number {
  const key = formatMonthKey(year, month);
  const overrides = parseMonthlyOverrides(rule.monthlyOverrides);
  return overrides[key] ?? rule.amountInCents;
}

export function filterActiveRulesForMonth<
  T extends { skippedMonths?: string | string[] | null }
>(rules: T[], year: number, month: number): T[] {
  return rules.filter((r) => !isRuleSkippedInMonth(r, year, month));
}

/**
 * Retorna as regras ativas no mês selecionado já com o `amountInCents` ajustado
 * pelo override daquele mês específico (quando configurado).
 */
export function resolveEffectiveRulesForMonth<
  T extends {
    amountInCents: number;
    skippedMonths?: string | string[] | null;
    monthlyOverrides?: string | Record<string, number> | null;
  }
>(rules: T[], year: number, month: number): T[] {
  return filterActiveRulesForMonth(rules, year, month).map((r) => ({
    ...r,
    amountInCents: getRuleEffectiveAmountForMonth(r, year, month),
  }));
}

export function toggleSkippedMonthList(
  currentRaw: string | string[] | null | undefined,
  year: number,
  month: number
): { nextList: string[]; nextJson: string; isSkipped: boolean } {
  const key = formatMonthKey(year, month);
  const current = parseSkippedMonths(currentRaw);
  const exists = current.includes(key);
  const nextList = exists ? current.filter((m) => m !== key) : [...current, key].sort();
  return {
    nextList,
    nextJson: JSON.stringify(nextList),
    isSkipped: !exists,
  };
}

export function setMonthlyOverrideValue(
  currentRaw: string | Record<string, number> | null | undefined,
  year: number,
  month: number,
  amountInCents: number | null
): { nextMap: Record<string, number>; nextJson: string } {
  const key = formatMonthKey(year, month);
  const nextMap = { ...parseMonthlyOverrides(currentRaw) };
  if (amountInCents === null || amountInCents <= 0) {
    delete nextMap[key];
  } else {
    nextMap[key] = Math.round(amountInCents);
  }
  return { nextMap, nextJson: JSON.stringify(nextMap) };
}

export function getNextMonthLabelPt(year: number, month: number): string {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${MONTH_NAMES_PT[nextMonth - 1]}/${nextYear}`;
}

export type MonthlyRuleExecutionStatus = 'SKIPPED' | 'PAID' | 'OVERDUE' | 'UPCOMING';

export function resolveMonthlyRuleExecutionStatus(params: {
  isSkipped: boolean;
  hasMatchingTx: boolean;
  dueYear: number;
  dueMonth: number;
  dueDay: number;
  referenceDate?: Date;
}): MonthlyRuleExecutionStatus {
  if (params.isSkipped) return 'SKIPPED';
  if (params.hasMatchingTx) return 'PAID';

  const now = params.referenceDate || new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dueUtc = Date.UTC(params.dueYear, params.dueMonth - 1, params.dueDay);

  return todayUtc > dueUtc ? 'OVERDUE' : 'UPCOMING';
}

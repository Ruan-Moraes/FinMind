import { MONTH_SHORT_PT } from '@/shared/lib/currency';

/**
 * Calcula o intervalo de datas de um mês/ano respeitando o dia de início do ciclo fiscal (fiscalMonthStartDay).
 * Função 100% pura e determinística.
 */
export function getMonthDateRange(month: number, year: number, fiscalMonthStartDay = 1) {
  const safeDay = Math.min(28, Math.max(1, Math.round(Number(fiscalMonthStartDay) || 1)));
  if (safeDay === 1) {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  }

  const start = new Date(year, month - 1, safeDay, 0, 0, 0, 0);
  const end = new Date(year, month, safeDay - 1, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Constrói os 6 buckets cronológicos para o gráfico de histórico de 6 meses.
 */
export function buildSixMonthsDateBuckets(
  refMonth: number,
  refYear: number,
  fiscalMonthStartDay = 1
) {
  const buckets: Array<{
    month: number;
    year: number;
    label: string;
    start: Date;
    end: Date;
    totalIncomeInCents: number;
    totalExpenseInCents: number;
    staticExpenseInCents: number;
    variableExpenseInCents: number;
  }> = [];

  for (let i = 5; i >= 0; i--) {
    let m = refMonth - i;
    let y = refYear;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const { start, end } = getMonthDateRange(m, y, fiscalMonthStartDay);
    buckets.push({
      month: m,
      year: y,
      label: `${MONTH_SHORT_PT[m - 1]}/${String(y).slice(-2)}`,
      start,
      end,
      totalIncomeInCents: 0,
      totalExpenseInCents: 0,
      staticExpenseInCents: 0,
      variableExpenseInCents: 0,
    });
  }

  return buckets;
}

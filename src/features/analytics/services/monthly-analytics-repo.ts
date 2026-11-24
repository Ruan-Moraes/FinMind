import { prisma } from '@/shared/lib/prisma';
import { MONTH_NAMES_PT } from '@/shared/lib/currency';
import {
  MonthSummaryData,
  MoMComparisonReport,
  StaticBaselineSummary,
} from '@/features/analytics/domain/finance-types';
import { buildSixMonthsDateBuckets, getMonthDateRange } from '@/features/analytics/domain/fiscal-calendar';
import {
  computeMoMComparisonFromSummaries,
  computeStaticBaselineMetrics,
} from '@/features/planning/domain/goal-calculator';
import { resolveEffectiveRulesForMonth } from '@/features/planning/domain/recurrence-month-skip';

const isCreditCardBillPayment = (tx: {
  financialAction?: string | null;
  purpose?: string | null;
}) =>
  tx.financialAction === 'CREDIT_CARD_BILL_PAYMENT' || tx.purpose === 'CREDIT_CARD_BILL';

/**
 * Calcula os indicadores detalhados de um mês específico.
 */
export async function getMonthSummary(
  userId: string,
  month: number,
  year: number,
  fiscalMonthStartDay = 1
): Promise<MonthSummaryData> {
  const { start, end } = getMonthDateRange(month, year, fiscalMonthStartDay);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: {
        gte: start,
        lte: end,
      },
    },
    include: {
      category: true,
    },
    orderBy: { amountInCents: 'desc' },
  });

  let totalIncomeInCents = 0;
  let totalExpenseInCents = 0;
  let staticExpenseInCents = 0;
  let variableExpenseInCents = 0;
  let staticIncomeInCents = 0;
  let variableIncomeInCents = 0;

  const categoryMap = new Map<
    string,
    { categoryId: string; name: string; color: string; amountInCents: number }
  >();

  let topExpenseItem: MonthSummaryData['topExpenseItem'] = null;

  for (const tx of transactions) {
    if (tx.type === 'INCOME') {
      totalIncomeInCents += tx.amountInCents;
      if (tx.nature === 'STATIC') {
        staticIncomeInCents += tx.amountInCents;
      } else {
        variableIncomeInCents += tx.amountInCents;
      }
    } else if (tx.type === 'EXPENSE' && !isCreditCardBillPayment(tx)) {
      totalExpenseInCents += tx.amountInCents;
      if (tx.nature === 'STATIC') {
        staticExpenseInCents += tx.amountInCents;
      } else {
        variableExpenseInCents += tx.amountInCents;
      }

      if (!topExpenseItem || tx.amountInCents > topExpenseItem.amountInCents) {
        topExpenseItem = {
          id: tx.id,
          description: tx.description,
          amountInCents: tx.amountInCents,
          categoryName: tx.category?.name || 'Sem Categoria',
          date: tx.date.toISOString(),
        };
      }

      const catId = tx.categoryId || 'uncategorized';
      const catName = tx.category?.name || 'Sem Categoria';
      const catColor = tx.category?.color || '#64748b';

      const existing = categoryMap.get(catId);
      if (existing) {
        existing.amountInCents += tx.amountInCents;
      } else {
        categoryMap.set(catId, {
          categoryId: catId,
          name: catName,
          color: catColor,
          amountInCents: tx.amountInCents,
        });
      }
    }
  }

  const categoryBreakdown = Array.from(categoryMap.values())
    .sort((a, b) => b.amountInCents - a.amountInCents)
    .map((c) => ({
      ...c,
      percent: totalExpenseInCents > 0 ? (c.amountInCents / totalExpenseInCents) * 100 : 0,
    }));

  const championCategory =
    categoryBreakdown.length > 0
      ? {
          id: categoryBreakdown[0].categoryId,
          name: categoryBreakdown[0].name,
          color: categoryBreakdown[0].color,
          amountInCents: categoryBreakdown[0].amountInCents,
          sharePercent: categoryBreakdown[0].percent,
        }
      : null;

  return {
    month,
    year,
    label: `${MONTH_NAMES_PT[month - 1]} ${year}`,
    totalIncomeInCents,
    totalExpenseInCents,
    netBalanceInCents: totalIncomeInCents - totalExpenseInCents,
    staticExpenseInCents,
    variableExpenseInCents,
    staticIncomeInCents,
    variableIncomeInCents,
    championCategory,
    topExpenseItem,
    categoryBreakdown,
  };
}

/**
 * RF-22, RF-23 & RN-05: Cálculo da Linha de Base Estática.
 */
export async function getStaticBaselineSummary(
  userId: string,
  monthSummary: MonthSummaryData
): Promise<StaticBaselineSummary> {
  const rules = await prisma.recurrenceRule.findMany({
    where: { userId, isActive: true, nature: 'STATIC' },
  });
  const activeForMonth = resolveEffectiveRulesForMonth(rules, monthSummary.year, monthSummary.month);

  return computeStaticBaselineMetrics(monthSummary, activeForMonth);
}

/**
 * RF-24 & RF-25: Comparação entre dois meses (Month-over-Month - MoM).
 */
export async function getMoMComparison(
  userId: string,
  monthA: number,
  yearA: number,
  monthB: number,
  yearB: number,
  fiscalMonthStartDay = 1
): Promise<MoMComparisonReport> {
  const [summaryA, summaryB] = await Promise.all([
    getMonthSummary(userId, monthA, yearA, fiscalMonthStartDay),
    getMonthSummary(userId, monthB, yearB, fiscalMonthStartDay),
  ]);

  return computeMoMComparisonFromSummaries(summaryA, summaryB);
}

/**
 * Histórico dos últimos 6 meses para o gráfico de evolução (Otimizado em 1 única query SQL sem N+1).
 */
export async function getSixMonthsHistory(
  userId: string,
  refMonth: number,
  refYear: number,
  fiscalMonthStartDay = 1
) {
  const buckets = buildSixMonthsDateBuckets(refMonth, refYear, fiscalMonthStartDay);
  const overallStart = buckets[0].start;
  const overallEnd = buckets[buckets.length - 1].end;

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: {
        gte: overallStart,
        lte: overallEnd,
      },
    },
    select: {
      type: true,
      nature: true,
      amountInCents: true,
      date: true,
      financialAction: true,
      purpose: true,
    },
  });

  for (const tx of transactions) {
    const txTime = tx.date.getTime();
    const bucket = buckets.find(
      (b) => txTime >= b.start.getTime() && txTime <= b.end.getTime()
    );
    if (!bucket) continue;

    if (tx.type === 'INCOME') {
      bucket.totalIncomeInCents += tx.amountInCents;
    } else if (tx.type === 'EXPENSE' && !isCreditCardBillPayment(tx)) {
      bucket.totalExpenseInCents += tx.amountInCents;
      if (tx.nature === 'STATIC') {
        bucket.staticExpenseInCents += tx.amountInCents;
      } else {
        bucket.variableExpenseInCents += tx.amountInCents;
      }
    }
  }

  return buckets.map((b) => ({
    label: b.label,
    month: b.month,
    year: b.year,
    receitas: b.totalIncomeInCents / 100,
    despesas: b.totalExpenseInCents / 100,
    estaticos: b.staticExpenseInCents / 100,
    variaveis: b.variableExpenseInCents / 100,
    saldo: (b.totalIncomeInCents - b.totalExpenseInCents) / 100,
  }));
}

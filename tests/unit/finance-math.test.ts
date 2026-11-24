import { describe, it, expect } from 'vitest';
import { formatCentsToBRL, parseInputToCents } from '@/shared/lib/currency';
import {
  getMonthDateRange,
  buildSixMonthsDateBuckets,
  computeCurrentNetWorthAndPace,
  computeSingleGoalProjection,
  computeStaticBaselineMetrics,
  computeMoMComparisonFromSummaries,
} from '@/features/analytics';

describe('Camada 2 — Matemática Financeira Pura e Calendário Fiscal', () => {
  it('calcula intervalo de datas respeitando ciclo fiscal padrão (dia 1) e customizado (dia 10)', () => {
    const std = getMonthDateRange(11, 2026, 1);
    expect(std.start.getDate()).toBe(1);
    expect(std.end.getDate()).toBe(30);

    const custom10 = getMonthDateRange(11, 2026, 10);
    expect(custom10.start.getDate()).toBe(10);
    expect(custom10.end.getMonth()).toBe(11);
    expect(custom10.end.getDate()).toBe(9);

    const buckets = buildSixMonthsDateBuckets(3, 2026, 1);
    expect(buckets).toHaveLength(6);
    expect(buckets[0].month).toBe(10);
    expect(buckets[0].year).toBe(2025);
  });

  it('calcula patrimônio líquido, velocidade mensal e projeção de metas de carteira', () => {
    const netWorthAndPace = computeCurrentNetWorthAndPace({
      accounts: [
        {
          id: 'a1',
          name: 'Conta Principal',
          type: 'CHECKING',
          initialBalanceInCents: 300000,
          currentBalanceInCents: 450000,
          color: '#10b981',
          isArchived: false,
        },
      ],
      cards: [
        {
          id: 'c1',
          name: 'Nubank',
          brand: 'Mastercard',
          limitInCents: 500000,
          usedLimitInCents: 50000,
          availableLimitInCents: 450000,
          closingDay: 25,
          dueDay: 5,
          color: '#6366f1',
          currentInvoiceInCents: 50000,
          currentInvoiceStatus: 'OPEN',
        },
      ],
      completedTransactions: [
        { type: 'INCOME', amountInCents: 500000, date: new Date('2026-11-05T12:00:00') },
        { type: 'EXPENSE', amountInCents: 300000, date: new Date('2026-11-10T12:00:00') },
      ],
      staticRules: [],
      referenceDate: new Date('2026-11-15T12:00:00'),
    });

    expect(netWorthAndPace.currentNetWorthInCents).toBe(400000);
    expect(netWorthAndPace.currentMonthlyPaceInCents).toBe(200000);

    const proj = computeSingleGoalProjection({
      goal: {
        id: 'g1',
        title: 'Reserva R$ 10.000',
        targetAmountInCents: 1000000,
        targetMonth: 6,
        targetYear: 2027,
      },
      ...netWorthAndPace,
    });

    expect(proj.remainingDistanceInCents).toBe(600000);
    expect(proj.estimatedMonthsToReach).toBe(3);
    expect(proj.willReachOnTime).toBe(true);
    expect(proj.paceStatus).toBe('AHEAD');
  });

  it('calcula linha de base estática (RN-05) e comparativo Month-over-Month (MoM)', () => {
    const summaryA = {
      month: 10,
      year: 2026,
      label: 'Outubro 2026',
      totalIncomeInCents: 400000,
      totalExpenseInCents: 200000,
      netBalanceInCents: 200000,
      staticExpenseInCents: 150000,
      variableExpenseInCents: 50000,
      staticIncomeInCents: 350000,
      variableIncomeInCents: 50000,
      championCategory: null,
      topExpenseItem: null,
      categoryBreakdown: [{ categoryId: 'c1', name: 'Moradia', color: '#000', amountInCents: 150000, percent: 75 }],
    };
    const summaryB = {
      ...summaryA,
      month: 11,
      label: 'Novembro 2026',
      totalExpenseInCents: 250000,
      categoryBreakdown: [{ categoryId: 'c1', name: 'Moradia', color: '#000', amountInCents: 180000, percent: 72 }],
    };

    const baseline = computeStaticBaselineMetrics(summaryA, [
      { type: 'INCOME', amountInCents: 350000 },
      { type: 'EXPENSE', amountInCents: 400000 },
    ]);
    expect(baseline.isOverCommitted).toBe(true);
    expect(baseline.freeDiscretionaryIncomeInCents).toBe(-50000);

    const mom = computeMoMComparisonFromSummaries(summaryA, summaryB);
    expect(mom.expenseDiffInCents).toBe(50000);
    expect(mom.expenseVariationPercent).toBe(25);
    expect(formatCentsToBRL(parseInputToCents('R$ 1.234,56'))).toContain('1.234,56');
  });
});

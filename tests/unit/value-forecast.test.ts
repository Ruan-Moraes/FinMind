import { describe, it, expect } from 'vitest';
import {
  computeValueForecastSummary,
  evaluateBalanceTarget,
  formatIsoDatePtBR,
} from '@/features/planning/domain/value-forecast-calculator';

describe('Previsão de Valor & Verificação de Meta de Saldo por Data', () => {
  const items = [
    {
      id: 'i1',
      title: 'Freela App',
      type: 'INCOME' as const,
      amountInCents: 150000,
      expectedDate: '2026-11-25T12:00:00.000Z',
      notes: null,
    },
    {
      id: 'i2',
      title: 'Manutenção',
      type: 'EXPENSE' as const,
      amountInCents: 30000,
      expectedDate: '2026-11-28T12:00:00.000Z',
      notes: null,
    },
    {
      id: 'i3',
      title: '13º Salário',
      type: 'INCOME' as const,
      amountInCents: 200000,
      expectedDate: '2026-12-15T12:00:00.000Z',
      notes: null,
    },
  ];

  it('soma ganhos e gastos previstos e projeta saldo apenas com itens até a data da meta futura', () => {
    const summary = computeValueForecastSummary({
      currentBalanceInCents: 100000,
      items,
      targets: [
        {
          id: 't1',
          title: 'Fechar Novembro',
          plannedBalanceInCents: 200000,
          targetDate: '2026-11-30T12:00:00.000Z',
          notes: null,
        },
      ],
      referenceDate: new Date(2026, 10, 22, 12, 0, 0), // 22/11/2026
    });

    expect(summary.totalPredictedIncomeInCents).toBe(350000);
    expect(summary.totalPredictedExpenseInCents).toBe(30000);
    expect(summary.projectedFinalBalanceInCents).toBe(420000);

    const [ev] = summary.evaluatedTargets;
    expect(ev.isDue).toBe(false);
    expect(ev.verificationStatus).toBe('PENDING');
    expect(ev.daysUntilTarget).toBe(8);
    expect(ev.includedItemsCount).toBe(2);
    // 1000 + 1500 - 300 = 2200 (não inclui o 13º de 15/12)
    expect(ev.projectedBalanceAtTargetInCents).toBe(220000);
    expect(ev.projectedDiffVsPlannedInCents).toBe(20000);
  });

  it('verifica quando bate o dia da meta se o saldo ficou IGUAL, MAIOR ou MENOR que o planejado', () => {
    const ref = new Date(2026, 10, 22, 12, 0, 0); // 22/11/2026

    const exact = evaluateBalanceTarget({
      target: {
        id: 't-exact',
        title: 'Meta Exata',
        plannedBalanceInCents: 250000,
        targetDate: '2026-11-22T12:00:00.000Z',
        notes: null,
      },
      currentBalanceInCents: 250000,
      items: [],
      referenceDate: ref,
    });
    expect(exact.isDue).toBe(true);
    expect(exact.verificationStatus).toBe('EXACT');
    expect(exact.actualDiffInCents).toBe(0);

    const above = evaluateBalanceTarget({
      target: {
        id: 't-above',
        title: 'Meta Superada',
        plannedBalanceInCents: 200000,
        targetDate: '2026-11-22T12:00:00.000Z',
        notes: null,
      },
      currentBalanceInCents: 250000,
      items: [],
      referenceDate: ref,
    });
    expect(above.isDue).toBe(true);
    expect(above.verificationStatus).toBe('ABOVE');
    expect(above.actualDiffInCents).toBe(50000);

    const below = evaluateBalanceTarget({
      target: {
        id: 't-below',
        title: 'Meta Abaixo',
        plannedBalanceInCents: 300000,
        targetDate: '2026-11-20T12:00:00.000Z',
        notes: null,
      },
      currentBalanceInCents: 250000,
      items: [],
      referenceDate: ref,
    });
    expect(below.isDue).toBe(true);
    expect(below.verificationStatus).toBe('BELOW');
    expect(below.actualDiffInCents).toBe(-50000);
    expect(formatIsoDatePtBR('2026-11-22T12:00:00.000Z')).toBe('22/11/2026');
  });
});

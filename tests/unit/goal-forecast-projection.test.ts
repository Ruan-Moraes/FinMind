import { describe, it, expect } from 'vitest';
import { computeGoalWithValueForecast } from '@/features/planning/domain/goal-forecast-projection';
import type { SerializedValueForecastItem } from '@/features/planning/domain/value-forecast-calculator';

const REF_DATE = new Date('2026-11-15T12:00:00.000Z');

describe('computeGoalWithValueForecast (Meta Fictícia com Previsão de Valor)', () => {
  it('segue a meta normal quando não há nenhum item em Previsão de Valor', () => {
    const res = computeGoalWithValueForecast({
      targetAmountInCents: 500_000,
      currentNetWorthInCents: 100_000,
      monthlyPaceInCents: 100_000,
      normalEstimatedMonths: 4,
      targetMonth: 3,
      targetYear: 2027,
      items: [],
      referenceDate: REF_DATE,
    });

    expect(res.hasForecastItems).toBe(false);
    expect(res.estimatedMonthsToReach).toBe(4);
    expect(res.monthsDeltaVsNormal).toBe(0);
  });

  it('antecipa o prazo da meta quando há ganho previsto (Vou Ganhar)', () => {
    const items: SerializedValueForecastItem[] = [
      {
        id: 'f1',
        title: 'Bônus',
        type: 'INCOME',
        amountInCents: 200_000,
        expectedDate: '2026-12-10T12:00:00.000Z',
        notes: null,
      },
    ];
    const res = computeGoalWithValueForecast({
      targetAmountInCents: 500_000,
      currentNetWorthInCents: 100_000,
      monthlyPaceInCents: 100_000,
      normalEstimatedMonths: 4,
      targetMonth: 3,
      targetYear: 2027,
      items,
      referenceDate: REF_DATE,
    });

    // Mês 1 (Dez): 100k + 100k (ritmo) + 200k (bônus) = 400k; Mês 2 (Jan): 500k -> 2 meses (2 meses mais rápido)
    expect(res.hasForecastItems).toBe(true);
    expect(res.estimatedMonthsToReach).toBe(2);
    expect(res.estimatedCompletionMonth).toBe(1);
    expect(res.estimatedCompletionYear).toBe(2027);
    expect(res.monthsDeltaVsNormal).toBe(-2);
    expect(res.paceStatus).toBe('AHEAD');
  });

  it('atrasa o prazo da meta quando há provável gasto (Provável Gasto)', () => {
    const items: SerializedValueForecastItem[] = [
      {
        id: 'f2',
        title: 'IPVA',
        type: 'EXPENSE',
        amountInCents: 200_000,
        expectedDate: '2026-12-10T12:00:00.000Z',
        notes: null,
      },
    ];
    const res = computeGoalWithValueForecast({
      targetAmountInCents: 500_000,
      currentNetWorthInCents: 100_000,
      monthlyPaceInCents: 100_000,
      normalEstimatedMonths: 4,
      targetMonth: 3,
      targetYear: 2027,
      items,
      referenceDate: REF_DATE,
    });

    // Mês 1: 100k + 100k - 200k = 0 -> precisa de mais 5 meses = 6 meses (+2 vs normal)
    expect(res.estimatedMonthsToReach).toBe(6);
    expect(res.monthsDeltaVsNormal).toBe(2);
    expect(res.paceStatus).toBe('BEHIND');
  });

  it('viabiliza meta mesmo com ritmo mensal zero quando um ganho futuro cobre a diferença', () => {
    const items: SerializedValueForecastItem[] = [
      {
        id: 'f3',
        title: 'Venda de equipamento',
        type: 'INCOME',
        amountInCents: 300_000,
        expectedDate: '2027-01-15T12:00:00.000Z',
        notes: null,
      },
    ];
    const res = computeGoalWithValueForecast({
      targetAmountInCents: 500_000,
      currentNetWorthInCents: 200_000,
      monthlyPaceInCents: 0,
      normalEstimatedMonths: null,
      items,
      referenceDate: REF_DATE,
    });

    expect(res.estimatedMonthsToReach).toBe(2);
    expect(res.estimatedCompletionMonth).toBe(1);
    expect(res.estimatedCompletionYear).toBe(2027);
  });
});

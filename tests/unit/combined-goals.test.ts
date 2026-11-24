import { describe, it, expect } from 'vitest';
import { computeCurrentNetWorthAndPace } from '@/features/planning/domain/goal-calculator';
import {
  computeCombinedGoalsProjection,
  formatMonthsDurationPt,
} from '@/features/planning/domain/combined-goals-calculator';

describe('Ritmo com Custos Estáticos e Metas Juntas (Projeção Consolidada)', () => {
  it('usa ganhos e custos estáticos no ritmo das metas mesmo quando existem lançamentos no mês', () => {
    const result = computeCurrentNetWorthAndPace({
      accounts: [
        {
          id: 'a1',
          name: 'Conta Principal',
          type: 'CHECKING',
          initialBalanceInCents: 0,
          currentBalanceInCents: 100000,
          color: '#10b981',
          isArchived: false,
        },
      ],
      cards: [],
      // Lançamentos avulsos somando R$ 1.642,00 líquidos no mês
      completedTransactions: [
        { type: 'INCOME', amountInCents: 208000, date: new Date('2026-11-05T12:00:00') },
        { type: 'EXPENSE', amountInCents: 43800, date: new Date('2026-11-10T12:00:00') },
      ],
      // Ganho estático R$ 2.080,00 e custos estáticos 410 + 250 + 110 + 383,54 = R$ 1.153,54
      staticRules: [
        { type: 'INCOME', amountInCents: 208000 },
        { type: 'EXPENSE', amountInCents: 41000 },
        { type: 'EXPENSE', amountInCents: 25000 },
        { type: 'EXPENSE', amountInCents: 11000 },
        { type: 'EXPENSE', amountInCents: 38354 },
      ],
      referenceDate: new Date('2026-11-22T12:00:00'),
    });

    expect(result.currentMonthlyPaceInCents).toBe(92646);
  });

  it('deduz custos estáticos da renda média dos lançamentos quando não há ganho estático cadastrado', () => {
    const result = computeCurrentNetWorthAndPace({
      accounts: [],
      cards: [],
      completedTransactions: [
        { type: 'INCOME', amountInCents: 208000, date: new Date('2026-11-05T12:00:00') },
      ],
      staticRules: [{ type: 'EXPENSE', amountInCents: 115354 }],
      referenceDate: new Date('2026-11-22T12:00:00'),
    });

    expect(result.currentMonthlyPaceInCents).toBe(92646);
  });

  it('calcula metas juntas com base estática e simulador de ganhos/custos mensais e pontuais', () => {
    const goals = [
      { id: 'g1', title: 'Reserva', targetAmountInCents: 500000 },
      { id: 'g2', title: 'Viagem', targetAmountInCents: 300000 },
    ];

    const base = computeCombinedGoalsProjection({
      goals,
      currentNetWorthInCents: 100000,
      staticIncomeInCents: 208000,
      staticExpenseInCents: 115354,
      referenceDate: new Date('2026-11-22T12:00:00'),
    });

    expect(base.totalTargetInCents).toBe(800000);
    expect(base.remainingInCents).toBe(700000);
    expect(base.staticMonthlyPaceInCents).toBe(92646);
    expect(base.estimatedMonthsToComplete).toBe(8);
    expect(base.completionMonth).toBe(7);
    expect(base.completionYear).toBe(2027);
    expect(base.monthsDeltaVsStatic).toBe(0);

    const withExtras = computeCombinedGoalsProjection({
      goals,
      currentNetWorthInCents: 100000,
      staticIncomeInCents: 208000,
      staticExpenseInCents: 115354,
      extraMonthlyIncomeInCents: 50000,
      extraMonthlyExpenseInCents: 10000,
      oneTimeExtraIncomeInCents: 200000,
      oneTimeExtraExpenseInCents: 50000,
      referenceDate: new Date('2026-11-22T12:00:00'),
    });

    expect(withExtras.effectiveStartingInCents).toBe(250000);
    expect(withExtras.remainingInCents).toBe(550000);
    expect(withExtras.effectiveMonthlyPaceInCents).toBe(132646);
    expect(withExtras.estimatedMonthsToComplete).toBe(5);
    expect(withExtras.monthsDeltaVsStatic).toBe(-3);
  });

  it('retorna prazo indeterminado quando sobra mensal simulada é zero ou negativa e formata durações', () => {
    const stalled = computeCombinedGoalsProjection({
      goals: [{ id: 'g1', title: 'Meta', targetAmountInCents: 500000 }],
      currentNetWorthInCents: 0,
      staticIncomeInCents: 208000,
      staticExpenseInCents: 115354,
      extraMonthlyExpenseInCents: 100000,
    });

    expect(stalled.effectiveMonthlyPaceInCents).toBe(-7354);
    expect(stalled.estimatedMonthsToComplete).toBeNull();
    expect(stalled.completionMonth).toBeNull();

    expect(formatMonthsDurationPt(0)).toBe('Concluído (0 meses)');
    expect(formatMonthsDurationPt(1)).toBe('1 mês');
    expect(formatMonthsDurationPt(8)).toBe('8 meses');
    expect(formatMonthsDurationPt(12)).toBe('1 ano');
    expect(formatMonthsDurationPt(14)).toBe('1 ano e 2 meses');
    expect(formatMonthsDurationPt(25)).toBe('2 anos e 1 mês');
  });
});

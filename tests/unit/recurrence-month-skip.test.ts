import { describe, it, expect } from 'vitest';
import {
  filterActiveRulesForMonth,
  formatMonthKey,
  getNextMonthLabelPt,
  getRuleEffectiveAmountForMonth,
  isRuleSkippedInMonth,
  resolveEffectiveRulesForMonth,
  resolveMonthlyRuleExecutionStatus,
  setMonthlyOverrideValue,
  toggleSkippedMonthList,
} from '@/features/planning/domain/recurrence-month-skip';

describe('recurrence-month-skip (Pular mês específico em regras fixas)', () => {
  it('formata chave YYYY-MM e calcula o rótulo do próximo mês corretamente inclusive na virada de ano', () => {
    expect(formatMonthKey(2026, 11)).toBe('2026-11');
    expect(formatMonthKey(2026, 2)).toBe('2026-02');
    expect(getNextMonthLabelPt(2026, 11)).toBe('Dezembro/2026');
    expect(getNextMonthLabelPt(2026, 12)).toBe('Janeiro/2027');
  });

  it('alterna corretamente um mês específico sem afetar outros meses', () => {
    const step1 = toggleSkippedMonthList('[]', 2026, 11);
    expect(step1.isSkipped).toBe(true);
    expect(step1.nextList).toEqual(['2026-11']);

    expect(isRuleSkippedInMonth({ skippedMonths: step1.nextJson }, 2026, 11)).toBe(true);
    expect(isRuleSkippedInMonth({ skippedMonths: step1.nextJson }, 2026, 12)).toBe(false);

    const step2 = toggleSkippedMonthList(step1.nextJson, 2026, 11);
    expect(step2.isSkipped).toBe(false);
    expect(step2.nextList).toEqual([]);
  });

  it('filtra apenas as regras ativas no mês selecionado mantendo-as ativas no próximo mês', () => {
    const rules = [
      { id: 'r1', description: 'Salário', amountInCents: 300_000, skippedMonths: '[]' },
      { id: 'r2', description: 'Assinatura', amountInCents: 10_000, skippedMonths: '["2026-11"]' },
    ];

    const novRules = filterActiveRulesForMonth(rules, 2026, 11);
    expect(novRules.map((r) => r.id)).toEqual(['r1']);

    const decRules = filterActiveRulesForMonth(rules, 2026, 12);
    expect(decRules.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('aplica ajuste de valor apenas no mês específico e mantém valor padrão no próximo mês', () => {
    const { nextJson } = setMonthlyOverrideValue('{}', 2026, 11, 52_000);
    const rule = { id: 'r1', amountInCents: 41_000, skippedMonths: '[]', monthlyOverrides: nextJson };

    expect(getRuleEffectiveAmountForMonth(rule, 2026, 11)).toBe(52_000);
    expect(getRuleEffectiveAmountForMonth(rule, 2026, 12)).toBe(41_000);

    const novResolved = resolveEffectiveRulesForMonth([rule], 2026, 11);
    expect(novResolved[0].amountInCents).toBe(52_000);
    const decResolved = resolveEffectiveRulesForMonth([rule], 2026, 12);
    expect(decResolved[0].amountInCents).toBe(41_000);
  });

  it('identifica status de vencimento (SKIPPED, PAID, OVERDUE e UPCOMING) conforme a data', () => {
    const ref = new Date('2026-11-15T12:00:00.000Z');
    expect(
      resolveMonthlyRuleExecutionStatus({
        isSkipped: true, hasMatchingTx: false, dueYear: 2026, dueMonth: 11, dueDay: 5, referenceDate: ref,
      })
    ).toBe('SKIPPED');
    expect(
      resolveMonthlyRuleExecutionStatus({
        isSkipped: false, hasMatchingTx: true, dueYear: 2026, dueMonth: 11, dueDay: 5, referenceDate: ref,
      })
    ).toBe('PAID');
    expect(
      resolveMonthlyRuleExecutionStatus({
        isSkipped: false, hasMatchingTx: false, dueYear: 2026, dueMonth: 11, dueDay: 5, referenceDate: ref,
      })
    ).toBe('OVERDUE');
    expect(
      resolveMonthlyRuleExecutionStatus({
        isSkipped: false, hasMatchingTx: false, dueYear: 2026, dueMonth: 11, dueDay: 25, referenceDate: ref,
      })
    ).toBe('UPCOMING');
  });
});

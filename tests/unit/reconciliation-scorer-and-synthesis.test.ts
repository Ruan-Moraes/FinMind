import { describe, it, expect } from 'vitest';
import {
  scoreRecurrenceRuleCandidate,
  scoreExistingTransactionCandidate,
} from '@/features/reconciliation/engine/candidate-scorer';
import {
  inferPurposeFromText,
  enrichTransactionMetadata,
  buildMemoryPatternKey,
} from '@/features/reconciliation/engine/purpose-classifier';
import {
  buildDeterministicAssistantSynthesis,
  type DeterministicSynthesisInput,
} from '@/features/ai-copilot/assistant/deterministic-synthesis';
import type { NormalizedRawMovement } from '@/features/reconciliation/parsers';

function makeMovement(overrides: Partial<NormalizedRawMovement>): NormalizedRawMovement {
  return {
    rawId: 'raw-1',
    fileId: 'f1',
    fileName: 'extrato.csv',
    fileFormat: 'CSV',
    bankName: 'Nubank',
    lineIndex: 1,
    date: '2026-11-10',
    amountInCents: 12000,
    direction: 'OUTFLOW',
    originalDescription: 'PAGAMENTO CLARO NET FIBRA',
    normalizedDescription: 'Pagamento Claro Net Fibra',
    counterparty: 'Claro Net',
    paymentMethod: 'PIX',
    fitId: null,
    externalHash: 'hash-1',
    ...overrides,
  };
}

describe('Motor de Scoring de Conciliação, Classificação Semântica e Síntese Determinística', () => {
  it('scoreRecurrenceRuleCandidate pontua match exato, conflito semântico, variação de valor e bônus de memória', () => {
    const mov = makeMovement({});
    const semantics = inferPurposeFromText(mov.originalDescription, 'OUTFLOW');

    const exact = scoreRecurrenceRuleCandidate({
      movement: mov,
      movementSemantics: semantics,
      rule: {
        id: 'r1',
        description: 'Internet Claro Fibra',
        type: 'EXPENSE',
        nature: 'STATIC',
        amountInCents: 12000,
        dayOfMonth: 10,
        frequency: 'MONTHLY',
        categoryId: 'cat-net',
        categoryName: 'Internet',
        accountId: 'acc-1',
      },
      memoryMatch: {
        id: 'm1',
        normalizedPattern: 'claro net fibra',
        merchantKeyword: 'CLARO',
        financialAction: 'TELECOM_BILL_PAYMENT',
        purpose: 'INTERNET_TELECOM',
        targetType: 'EXPENSE',
        nature: 'STATIC',
        categoryId: 'cat-net',
        recurrenceRuleId: 'r1',
        confirmCount: 3,
      },
    });
    expect(exact.score).toBeGreaterThanOrEqual(80);
    expect(exact.hasSemanticHarmony).toBe(true);
    expect(exact.hasSemanticConflict).toBe(false);

    const conflict = scoreRecurrenceRuleCandidate({
      movement: mov,
      movementSemantics: semantics,
      rule: {
        id: 'r2',
        description: 'Academia Smart Fit',
        type: 'EXPENSE',
        nature: 'STATIC',
        amountInCents: 12000,
        dayOfMonth: 10,
        frequency: 'MONTHLY',
        categoryId: 'cat-gym',
        categoryName: 'Saúde',
        accountId: 'acc-1',
      },
    });
    expect(conflict.hasSemanticConflict).toBe(true);
    expect(conflict.score).toBeLessThan(exact.score);
  });

  it('scoreExistingTransactionCandidate avalia match exato, variação justificável e pagamento parcial', () => {
    const mov = makeMovement({
      originalDescription: 'PIX ENVIADO IMOBILIARIA ALUGUEL',
      amountInCents: 150000,
      date: '2026-11-05',
    });
    const semantics = inferPurposeFromText(mov.originalDescription, 'OUTFLOW');

    const exactTx = scoreExistingTransactionCandidate({
      movement: mov,
      movementSemantics: semantics,
      tx: {
        id: 'tx-1',
        description: 'Aluguel Apartamento',
        type: 'EXPENSE',
        nature: 'STATIC',
        amountInCents: 150000,
        date: '2026-11-05',
        status: 'PENDING',
        categoryId: 'cat-home',
        categoryName: 'Moradia',
        sourceAccountId: 'acc-1',
        recurrenceRuleId: null,
        externalTransactionHash: null,
        rawBankDescription: null,
      },
    });
    expect(exactTx.score).toBeGreaterThanOrEqual(70);

    const partialTx = scoreExistingTransactionCandidate({
      movement: makeMovement({
        originalDescription: 'PIX ENVIADO IMOBILIARIA ALUGUEL',
        amountInCents: 75000,
        date: '2026-11-06',
      }),
      movementSemantics: semantics,
      tx: {
        id: 'tx-2',
        description: 'Aluguel Apartamento',
        type: 'EXPENSE',
        nature: 'STATIC',
        amountInCents: 150000,
        date: '2026-11-05',
        status: 'PENDING',
        categoryId: 'cat-home',
        categoryName: 'Moradia',
        sourceAccountId: 'acc-1',
        recurrenceRuleId: null,
        externalTransactionHash: null,
        rawBankDescription: null,
      },
    });
    expect(partialTx.precision).toBe('PARTIAL_PAYMENT');
  });

  it('enrichTransactionMetadata e buildMemoryPatternKey classificam entradas, saídas e transferências', () => {
    const cats = [
      { id: 'c-food', name: 'Alimentação & Delivery', type: 'EXPENSE', defaultNature: 'VARIABLE' },
      { id: 'c-sal', name: 'Salário & Remuneração', type: 'INCOME', defaultNature: 'STATIC' },
    ];
    const food = enrichTransactionMetadata({
      rawDescription: 'PIX ENVIADO IFOOD RESTAURANTE',
      type: 'EXPENSE',
      categories: cats,
      memoryRules: [],
    });
    expect(food.purpose).toBe('FOOD_DINING');
    expect(food.suggestedCategoryId).toBe('c-food');
    expect(food.paymentMethod).toBe('PIX');

    const sal = enrichTransactionMetadata({
      rawDescription: 'TED RECEBIDA FOLHA SALARIO EMPRESA',
      type: 'INCOME',
      categories: cats,
      memoryRules: [],
    });
    expect(sal.purpose).toBe('SALARY_COMPENSATION');
    expect(sal.suggestedCategoryId).toBe('c-sal');
    expect(buildMemoryPatternKey('PIX ENVIADO 123456 UBER TRIP')).toContain('UBER');
  });

  it('buildDeterministicAssistantSynthesis responde às 4 intenções (meta, fixos, MoM e resumo geral)', () => {
    const baseSummary = {
      month: 11, year: 2026, label: 'Novembro 2026', totalIncomeInCents: 800000,
      totalExpenseInCents: 350000, netBalanceInCents: 450000, staticExpenseInCents: 200000,
      variableExpenseInCents: 150000, staticIncomeInCents: 800000, variableIncomeInCents: 0,
      championCategory: { id: 'c1', name: 'Moradia', color: '#6366f1', amountInCents: 200000, sharePercent: 57.1 },
      topExpenseItem: { id: 't1', description: 'Aluguel', amountInCents: 200000, categoryName: 'Moradia', date: '2026-11-05T12:00:00.000Z' },
      categoryBreakdown: [],
    };
    const baseInput: DeterministicSynthesisInput = {
      question: 'Como está minha meta de patrimônio?',
      refMonth: 11, refYear: 2026, consolidatedBalanceInCents: 1500000, netWorthInCents: 1400000,
      monthSummary: baseSummary,
      momComparison: {
        monthA: { ...baseSummary, month: 10, label: 'Outubro 2026', totalExpenseInCents: 300000, netBalanceInCents: 500000, variableExpenseInCents: 100000, championCategory: null, topExpenseItem: null },
        monthB: { ...baseSummary, championCategory: null, topExpenseItem: null },
        expenseDiffInCents: 50000, expenseVariationPercent: 16.6, incomeDiffInCents: 0, incomeVariationPercent: 0, categoryDeltas: [],
      },
      staticBaseline: {
        staticIncomeInCents: 800000, staticExpenseInCents: 200000, variableIncomeInCents: 0,
        variableExpenseInCents: 150000, freeDiscretionaryIncomeInCents: 600000, isOverCommitted: false, commitmentPercent: 25,
      },
      portfolioGoals: [{
        id: 'g1', title: 'Reserva 50k', targetAmountInCents: 5000000, currentNetWorthInCents: 1400000,
        progressPercent: 28, remainingDistanceInCents: 3600000, isAchieved: false, targetMonth: 12,
        targetYear: 2027, monthsRemaining: 13, recommendedMonthlyContributionInCents: 276923,
        currentMonthlyPaceInCents: 450000, estimatedMonthsToReach: 8, estimatedCompletionMonth: 7,
        estimatedCompletionYear: 2027, willReachOnTime: true, paceStatus: 'AHEAD', monthlyPaceGapInCents: 0,
      }],
      budgets: [{ categoryName: 'Alimentação', maxAmountInCents: 100000, spentInCents: 90000 }],
      recurrenceRules: [{ description: 'Aluguel', type: 'EXPENSE', amountInCents: 200000, dayOfMonth: 5 }],
      sixMonths: [], retrievedChunks: [],
    };

    const metaAns = buildDeterministicAssistantSynthesis(baseInput);
    expect(metaAns.directAnswer).toContain('Reserva 50k');
    expect(metaAns.personalizedRecommendations.some((r) => r.includes('Alimentação'))).toBe(true);

    const fixedAns = buildDeterministicAssistantSynthesis({
      ...baseInput,
      question: 'Qual é meu custo fixo e recorrente mensal?',
    });
    expect(fixedAns.directAnswer).toContain('Aluguel');

    const momAns = buildDeterministicAssistantSynthesis({
      ...baseInput,
      question: 'Compare a evolução MoM em relação ao mês anterior',
    });
    expect(momAns.directAnswer).toContain('Outubro 2026');

    const generalAns = buildDeterministicAssistantSynthesis({
      ...baseInput,
      question: 'Resumo geral da minha conta',
      portfolioGoals: [],
    });
    expect(generalAns.directAnswer).toContain('Novembro/2026');
    expect(generalAns.projectionsAndEstimates[0]).toContain('12 meses');
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createTransactionSchema,
  updateTransactionSchema,
  portfolioGoalSchema,
  budgetSchema,
  recurrenceRuleSchema,
  categorySchema,
  userSettingsSchema,
  extractFirstZodError,
} from '@/features/planning/schemas/finance-schemas';
import { logWarn, logError } from '@/shared/lib/logger';
import {
  classifyProviderError,
  validateModelIdentityResponse,
} from '@/features/ai-copilot/models/sanity-check-validator';
import { generateEmbeddingsBatch } from '@/features/ai-copilot/rag/embedding-gateway';
import { resolveCategoryIconId } from '@/shared/icons/icon-inference';
import { formatCentsToBRL, formatCentsToInput, formatPercent, parseInputToCents } from '@/shared/lib/currency';
import { generateSmartFinancialStatusAnalysis } from '@/features/ai-copilot/providers/local-financial-health';

describe('Validação Zod, Logger Estruturado, Classificador HTTP e Embedding Gateway', () => {
  const originalFetch = globalThis.fetch;
  const originalVitest = process.env.VITEST;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.VITEST = originalVitest;
    vi.restoreAllMocks();
  });

  it('valida corretamente todos os schemas Zod financeiros e extrai primeira mensagem de erro', () => {
    expect(
      createTransactionSchema.safeParse({
        type: 'EXPENSE',
        nature: 'VARIABLE',
        amountRaw: '150,00',
        date: '2026-11-10',
        description: 'Supermercado',
        status: 'COMPLETED',
        paymentTarget: 'ACCOUNT',
      }).success
    ).toBe(true);

    const invalidTx = createTransactionSchema.safeParse({
      type: 'EXPENSE',
      nature: 'VARIABLE',
      amountRaw: '150,00',
      date: '2026-11-10',
      description: '   ',
      status: 'COMPLETED',
      paymentTarget: 'ACCOUNT',
    });
    expect(invalidTx.success).toBe(false);
    if (!invalidTx.success) {
      expect(extractFirstZodError(invalidTx.error)).toContain('descrição');
    }

    expect(
      updateTransactionSchema.safeParse({
        id: 'tx-1',
        type: 'INCOME',
        nature: 'STATIC',
        amountRaw: '5000,00',
        date: '2026-11-05',
        description: 'Salário',
        status: 'COMPLETED',
        paymentTarget: 'ACCOUNT',
      }).success
    ).toBe(true);

    expect(
      portfolioGoalSchema.safeParse({
        title: 'Reserva',
        targetAmountRaw: '20000,00',
        targetMonth: 12,
        targetYear: 2027,
      }).success
    ).toBe(true);

    expect(
      budgetSchema.safeParse({
        categoryId: 'cat-1',
        month: 11,
        year: 2026,
        maxAmountRaw: '1000,00',
      }).success
    ).toBe(true);

    expect(
      recurrenceRuleSchema.safeParse({
        description: 'Internet',
        type: 'EXPENSE',
        nature: 'STATIC',
        amountRaw: '120,00',
        dayOfMonth: 10,
      }).success
    ).toBe(true);

    expect(
      categorySchema.safeParse({
        name: 'Saúde',
        type: 'EXPENSE',
        defaultNature: 'STATIC',
        color: '#ec4899',
      }).success
    ).toBe(true);

    expect(
      userSettingsSchema.safeParse({
        theme: 'DARK',
        density: 'COMPACT',
        hideValuesByDefault: true,
        fiscalMonthStartDay: 5,
      }).success
    ).toBe(true);
  });

  it('logWarn e logError sanitizam segredos e mascaram tokens/passwords/apiKeys', () => {
    delete process.env.VITEST;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logWarn('AuthScope', 'Falha de teste', {
      apiKey: 'sk-super-secret-123456',
      token: 'jwt-secret-token',
      password: 'my-password',
      safeField: 'visivel',
      err: new Error('Falha simulada'),
    });
    logWarn('SimpleScope', 'Sem meta');
    logError('ErrScope', 'Erro crítico', new Error('Boom'));

    expect(warnSpy).toHaveBeenCalledTimes(2);
    const firstMeta = warnSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(firstMeta.apiKey).toBe('[REDACTED]');
    expect(firstMeta.token).toBe('[REDACTED]');
    expect(firstMeta.password).toBe('[REDACTED]');
    expect(firstMeta.safeField).toBe('visivel');
    expect(firstMeta.err).toBe('Falha simulada');
    expect(errSpy).toHaveBeenCalledTimes(1);
  });

  it('classifyProviderError e validateModelIdentityResponse cobrem todos os códigos HTTP e conflitos de identidade', () => {
    expect(classifyProviderError(401, 'Incorrect API key')).toBe('INVALID_CREDENTIALS');
    expect(classifyProviderError(403, 'Permission denied')).toBe('AUTH_ERROR');
    expect(classifyProviderError(404, 'Model not found')).toBe('MODEL_UNAVAILABLE');
    expect(classifyProviderError(429, 'Rate limit exceeded')).toBe('RATE_LIMITED_OR_QUOTA');
    expect(classifyProviderError(402, 'Credit balance too low')).toBe('RATE_LIMITED_OR_QUOTA');
    expect(classifyProviderError(400, 'Unsupported parameter response_format')).toBe(
      'FEATURE_INCOMPATIBLE'
    );
    expect(classifyProviderError(503, 'Service unavailable')).toBe('SERVICE_UNAVAILABLE');
    expect(classifyProviderError(0, 'fetch failed')).toBe('NETWORK_ERROR');

    expect(validateModelIdentityResponse('gpt-4o-mini', '').passed).toBe(false);
    expect(validateModelIdentityResponse('gpt-4o-mini', 'Sou o Claude da Anthropic').passed).toBe(
      false
    );
    expect(validateModelIdentityResponse('gpt-4o-mini', 'Sou o modelo GPT-4o mini da OpenAI').passed).toBe(
      true
    );
  });

  it('generateEmbeddingsBatch usa OpenAI, faz fallback para Gemini e depois para vetorizador local', async () => {
    expect(await generateEmbeddingsBatch([])).toEqual({
      vectors: [],
      model: 'none',
    });

    // 1. Sucesso OpenAI
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    ) as unknown as typeof fetch;

    const openaiRes = await generateEmbeddingsBatch(['aluguel'], {
      openaiApiKey: 'sk-test-openai-key-123456',
    });
    expect(openaiRes.model).toBe('text-embedding-3-small');
    expect(openaiRes.vectors).toEqual([[0.1, 0.2, 0.3]]);

    // 2. Falha OpenAI -> Fallback Gemini com sucesso
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ embeddings: [{ values: [0.4, 0.5, 0.6] }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      ) as unknown as typeof fetch;

    const geminiRes = await generateEmbeddingsBatch(['mercado'], {
      openaiApiKey: 'sk-test-openai-key-123456',
      geminiApiKey: 'AIzaSyTestGeminiKey123456',
    });
    expect(geminiRes.model).toBe('text-embedding-004');
    expect(geminiRes.vectors).toEqual([[0.4, 0.5, 0.6]]);

    // 3. Falha Gemini -> Fallback local determinístico
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('timeout')) as unknown as typeof fetch;
    const localRes = await generateEmbeddingsBatch(['salario'], {
      geminiApiKey: 'AIzaSyTestGeminiKey123456',
    });
    expect(localRes.model).toBe('financial-semantic-v1');
    expect(localRes.vectors[0].length).toBe(64);
  });

  it('cobre inferência completa de ícones, utilitários de moeda e diagnóstico em cenário deficitário', () => {
    for (const label of [
      'Supermercado', 'Transporte Uber', 'Aluguel Moradia', 'Academia Saúde',
      'Faculdade Curso', 'Viagem Hotel', 'Investimentos CDB', 'Pet Shop',
      'Impostos Taxas', 'Assinatura Netflix', 'Presentes', 'Energia Água',
      'Salário', 'Restaurante iFood', 'Celular Internet', 'Roupas Shopping',
    ]) {
      expect(resolveCategoryIconId(null, label)).toBeTruthy();
    }

    expect(formatCentsToBRL(12345, true)).toBe('R$ ••••••');
    expect(formatCentsToInput(12345)).toBe('123,45');
    expect(formatPercent(12.5)).toContain('12,5');
    expect(parseInputToCents('R$ 1.234,56')).toBe(123456);
    expect(parseInputToCents('')).toBe(0);

    const stressed = generateSmartFinancialStatusAnalysis({
      consolidatedBalanceInCents: 10000,
      staticIncomeInCents: 300000,
      staticExpenseInCents: 350000,
      freeIncomeInCents: -50000,
      monthIncomeInCents: 300000,
      monthExpenseInCents: 420000,
      championCategoryName: 'Moradia',
      championCategoryAmountInCents: 250000,
      portfolioGoalTitle: 'Reserva',
      portfolioGoalTargetInCents: 2000000,
      portfolioGoalCurrentInCents: 10000,
      portfolioGoalRemainingInCents: 1990000,
      portfolioGoalRecommendedMonthlyInCents: 150000,
      momDiffInCents: 80000,
      momVariationPercent: 25,
    });
    expect(stressed.risks.length).toBeGreaterThan(0);
    expect(stressed.actionPlan.length).toBeGreaterThan(0);
  });
});

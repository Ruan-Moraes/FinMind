import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import {
  executeReadAnalyticsTool,
  loadAnalyticsExecutionContext,
} from '@/features/ai-agent/tools/tool-executors-analytics';
import { runLocalGroundedAnalyticsFallback } from '@/features/ai-agent/services/agent-local-fallback-planner';
import { composeAgentTurnFromTools } from '@/features/ai-agent/services/agent-tool-plan-builder';

describe('Integração Real: Ferramentas Analíticas, Gráficos de Metas e Preservação de Intenção', () => {
  let testUserId = '';
  let otherUserId = '';

  beforeAll(async () => {
    const suffix = Date.now();
    const user = await prisma.user.create({
      data: {
        name: 'Audit Agent User',
        email: `audit-agent-${suffix}@finmind.local`,
        passwordHash: 'hash',
        settings: { create: { fiscalMonthStartDay: 1 } },
      },
    });
    testUserId = user.id;

    const other = await prisma.user.create({
      data: {
        name: 'Other Isolated User',
        email: `other-agent-${suffix}@finmind.local`,
        passwordHash: 'hash',
        settings: { create: { fiscalMonthStartDay: 1 } },
      },
    });
    otherUserId = other.id;

    const acc = await prisma.account.create({
      data: { userId: testUserId, name: 'Conta Principal', type: 'CHECKING', initialBalanceInCents: 350000 },
    });
    const cat = await prisma.category.create({
      data: { userId: testUserId, name: 'Alimentação Teste', type: 'EXPENSE', color: '#f59e0b' },
    });
    await prisma.transaction.create({
      data: {
        userId: testUserId,
        type: 'EXPENSE',
        nature: 'VARIABLE',
        amountInCents: 45000,
        date: new Date('2026-11-10T12:00:00.000Z'),
        description: 'Supermercado Integração',
        sourceAccountId: acc.id,
        categoryId: cat.id,
      },
    });
    await prisma.portfolioGoal.createMany({
      data: [
        { userId: testUserId, title: 'Reserva de Emergência', targetAmountInCents: 1000000, targetMonth: 12, targetYear: 2026 },
        { userId: testUserId, title: 'Viagem Europa', targetAmountInCents: 500000, targetMonth: 12, targetYear: 2027 },
        { userId: otherUserId, title: 'Meta Secreta Outro Usuário', targetAmountInCents: 9999900, targetMonth: 12, targetYear: 2026 },
      ],
    });
  });

  afterAll(async () => {
    if (testUserId) await prisma.user.deleteMany({ where: { id: testUserId } });
    if (otherUserId) await prisma.user.deleteMany({ where: { id: otherUserId } });
  });

  it('consulta dados reais de metas e despesas respeitando isolamento estrito por userId', async () => {
    const ctx = await loadAnalyticsExecutionContext(testUserId, 11, 2026);
    const goalsData = await executeReadAnalyticsTool('query_portfolio_goals', {}, ctx);
    expect(goalsData.goalsCount).toBe(2);
    expect(goalsData.totalTargetInCents).toBe(1500000);
    const titles = (goalsData.goals as Array<{ title: string }>).map((g) => g.title);
    expect(titles).toContain('Reserva de Emergência');
    expect(titles).toContain('Viagem Europa');
    expect(titles).not.toContain('Meta Secreta Outro Usuário');

    const expensesData = await executeReadAnalyticsTool('query_expenses_and_transactions', { type: 'EXPENSE' }, ctx);
    expect(expensesData.filteredTotalInCents).toBe(45000);
  });

  it('gera gráfico de pizza real sobre metas para formulações semanticamente equivalentes', async () => {
    const ctx = await loadAnalyticsExecutionContext(testUserId, 11, 2026);
    const prompts = [
      'Gere um gráfico de pizza sobre minhas metas.',
      'Monte uma pizza mostrando minhas metas financeiras',
      'Quero ver a distribuição das minhas metas em gráfico de pizza',
    ];
    for (const prompt of prompts) {
      const res = await runLocalGroundedAnalyticsFallback(prompt, ctx);
      expect(res.readToolsExecuted).toContain('query_portfolio_goals');
      const pie = res.contentBlocks.find((b) => b.kind === 'pie');
      expect(pie).toBeDefined();
      expect(pie?.data?.map((d) => d.name)).toEqual(
        expect.arrayContaining(['Reserva de Emergência', 'Viagem Europa'])
      );
    }
  });

  it('gera tabela comparativa e relatório financeiro real com dados do banco', async () => {
    const ctx = await loadAnalyticsExecutionContext(testUserId, 11, 2026);
    const cmp = await runLocalGroundedAnalyticsFallback('Compare meus gastos dos últimos meses em tabela', ctx);
    expect(cmp.contentBlocks.some((b) => b.kind === 'bar')).toBe(true);
    expect(cmp.contentBlocks.some((b) => b.kind === 'table')).toBe(true);

    const rep = await runLocalGroundedAnalyticsFallback('Gere um relatório financeiro completo', ctx);
    expect(rep.contentBlocks.some((b) => b.kind === 'report_card')).toBe(true);
  });

  it('preserva pendingMutation no modo GUIDED e suporta composição HYBRID (ensinar + configurar)', async () => {
    const payload = await composeAgentTurnFromTools({
      userId: testUserId,
      runId: `run-test-${Date.now()}`,
      actionTools: [
        { name: 'guide_feature_workflow', args: { tab: 'goals', topic: 'Cadastrar uma nova Meta de Carteira', openModalType: 'GOAL' } },
        { name: 'upsert_portfolio_goal', args: { title: 'Meta Composta', targetAmountBRL: 4000, targetMonth: 12, targetYear: 2026 } },
      ],
      contentBlocks: [],
      interactionMode: 'GUIDED',
      llmNarrative: '',
      executionMode: 'DETERMINISTIC_AGENT_LOCAL',
      providerLabel: 'FINMIND_AGENT_LOCAL',
      modelLabel: 'Teste',
      systemSources: [],
      apiWarning: null,
    });

    expect(payload.modality).toBe('HYBRID');
    expect(payload.visualSteps.length).toBeGreaterThan(0);
    expect(payload.pendingMutation).toBeTruthy();
    expect(payload.pendingMutation?.title).toContain('Meta Composta');
  });
});

import { describe, it, expect } from 'vitest';
import { renderVisualContentToolSchema } from '@/features/ai-agent/domain/dynamic-content-schemas';
import { validateAgentTurnOutcome } from '@/features/ai-agent/services/agent-result-validator';
import { detectDeterministicToolCalls } from '@/features/ai-agent/services/agent-intent-router';
import { checkPreservedFinancialValues } from '@/features/ai-voice/domain/voice-refinement-types';
import type { UiStateSnapshot } from '@/features/ai-agent/domain/agent-types';

const UI_STATE: UiStateSnapshot = {
  activeTab: 'overview',
  selectedMonth: 11,
  selectedYear: 2026,
  activeModalType: null,
  hideValues: false,
  theme: 'DARK',
  density: 'COMFORTABLE',
  viewport: 'DESKTOP',
  activeFilters: { searchQuery: '', filterType: 'ALL', filterNature: 'ALL', filterCategoryId: 'ALL' },
  mountedTargets: [],
};

describe('Agente Financeiro IA — Validação de Intenção, Blocos Dinâmicos e Voz', () => {
  it('valida contratos Zod de gráficos dinâmicos (pie, bar, line, table, report_card)', () => {
    const parsed = renderVisualContentToolSchema.safeParse({
      blocks: [
        {
          id: 'b1',
          kind: 'pie',
          title: 'Distribuição das Metas',
          unit: 'BRL_CENTS',
          data: [
            { name: 'Reserva', valueInCents: 500000, percent: 50 },
            { name: 'Viagem', valueInCents: 500000, percent: 50 },
          ],
        },
        {
          id: 'b2',
          kind: 'table',
          title: 'Comparativo Mensal',
          columns: [
            { key: 'mes', label: 'Mês', align: 'left', format: 'text' },
            { key: 'despesas', label: 'Despesas', align: 'right', format: 'currency_cents' },
          ],
          rows: [{ mes: 'Nov/26', despesas: 120000 }],
        },
        {
          id: 'b3',
          kind: 'report_card',
          title: 'Relatório Mensal',
          report: {
            healthScore: 82,
            summary: 'Fluxo positivo.',
            strengths: ['Margem livre positiva'],
            risks: [],
            projections: ['Estimativa condicionada'],
            actionPlan: ['Manter aportes mensais'],
          },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('bloqueia substituição indevida por navegação quando o usuário pede gráfico, análise ou relatório', () => {
    const pieMisaligned = validateAgentTurnOutcome({
      userMessage: 'Gere um gráfico de pizza sobre minhas metas.',
      readToolsExecuted: [],
      actionToolsCalled: ['navigate_to_section'],
      contentBlocks: [],
      visualSteps: [],
      narrative: 'Estou levando você até a tela de metas.',
    });
    expect(pieMisaligned.aligned).toBe(false);
    expect(pieMisaligned.correctionPrompt).toContain('render_visual_content');

    const reportMisaligned = validateAgentTurnOutcome({
      userMessage: 'Gere um relatório financeiro.',
      readToolsExecuted: [],
      actionToolsCalled: ['navigate_to_section'],
      contentBlocks: [],
      visualSteps: [],
      narrative: 'Abrindo relatórios.',
    });
    expect(reportMisaligned.aligned).toBe(false);
  });

  it('exige ancoragem de dados reais antes de renderizar blocos e exige pizza quando explicitamente pedida', () => {
    const ungrounded = validateAgentTurnOutcome({
      userMessage: 'Gere um gráfico de pizza sobre minhas metas.',
      readToolsExecuted: [],
      actionToolsCalled: [],
      contentBlocks: [{ id: 'p1', kind: 'pie', title: 'Metas', data: [{ name: 'A', valueInCents: 1000 }] }],
      visualSteps: [],
      narrative: 'Aqui está o gráfico.',
    });
    expect(ungrounded.aligned).toBe(false);

    const wrongChartKind = validateAgentTurnOutcome({
      userMessage: 'Gere um gráfico de pizza sobre minhas metas.',
      readToolsExecuted: ['query_portfolio_goals'],
      actionToolsCalled: [],
      contentBlocks: [{ id: 'b1', kind: 'progress_bars', title: 'Metas', data: [{ name: 'A', percent: 50 }] }],
      visualSteps: [],
      narrative: 'Aqui estão suas metas.',
    });
    expect(wrongChartKind.aligned).toBe(false);

    const alignedPie = validateAgentTurnOutcome({
      userMessage: 'Gere um gráfico de pizza sobre minhas metas.',
      readToolsExecuted: ['query_portfolio_goals'],
      actionToolsCalled: [],
      contentBlocks: [{ id: 'p1', kind: 'pie', title: 'Metas', data: [{ name: 'A', valueInCents: 100000 }] }],
      visualSteps: [],
      narrative: 'Aqui está o gráfico de pizza com os dados reais das suas metas.',
    });
    expect(alignedPie.aligned).toBe(true);
  });

  it('distingue contexto de ação (tela de metas vs gráfico de metas vs pedido composto)', () => {
    const nav = detectDeterministicToolCalls('Mostre minha tela de metas.', UI_STATE);
    expect(nav).toHaveLength(1);
    expect(nav[0]?.name).toBe('navigate_to_section');
    expect(nav[0]?.args.tab).toBe('goals');

    const pie = detectDeterministicToolCalls('Gere um gráfico de pizza sobre minhas metas.', UI_STATE);
    expect(pie).toHaveLength(0);

    const compound = detectDeterministicToolCalls(
      'Mostre como configurar uma meta e configure para mim com valor de R$ 4.000',
      UI_STATE
    );
    expect(compound.map((t) => t.name)).toEqual(['guide_feature_workflow', 'upsert_portfolio_goal']);
  });

  it('verifica preservação rigorosa de valores financeiros no aprimoramento de voz', () => {
    const ok = checkPreservedFinancialValues(
      'Tipo, cria uma meta de R$ 2.500 para o mês 12 de 2026',
      'Crie uma meta de R$ 2.500 para o mês 12 de 2026.'
    );
    expect(ok.preserved).toBe(true);

    const altered = checkPreservedFinancialValues(
      'Altera minha meta para R$ 2.500 até 12/2026',
      'Altere minha meta para R$ 250 até 12/2026.'
    );
    expect(altered.preserved).toBe(false);
    expect(altered.missingTokens).toContain('2.500');
  });
});

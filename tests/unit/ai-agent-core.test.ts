import { describe, it, expect } from 'vitest';
import { parseKnowledgeMarkdown } from '@/features/ai-agent/knowledge/markdown-chunker';
import {
  detectBlockedSecurityIntent,
  getToolRiskLevel,
  redactSensitiveParams,
  requiresExplicitConfirmation,
} from '@/features/ai-agent/domain/agent-risk-policy';
import {
  buildGuideSteps,
  detectDeterministicToolCall,
} from '@/features/ai-agent/services/agent-intent-router';
import {
  detectConversationalReply,
  isFinancialAnalyticsQuery,
} from '@/features/ai-agent/services/agent-conversational-classifier';
import {
  clampRectToCanvas,
  computeFocusedCropRegion,
} from '@/features/ai-agent/capture/canvas-annotator';
import type { UiStateSnapshot } from '@/features/ai-agent/domain/agent-types';

const SAMPLE_UI_STATE: UiStateSnapshot = {
  activeTab: 'overview',
  selectedMonth: 11,
  selectedYear: 2026,
  activeModalType: null,
  hideValues: false,
  theme: 'DARK',
  density: 'COMFORTABLE',
  viewport: 'DESKTOP',
  activeFilters: {
    searchQuery: '',
    filterType: 'ALL',
    filterNature: 'ALL',
    filterCategoryId: 'ALL',
  },
  mountedTargets: [],
};

describe('Agente IA Autônomo — Core (Chunker, Política de Risco, Roteamento & Anotação)', () => {
  it('segmenta documento Markdown com frontmatter e gera hashes determinísticos', () => {
    const md = [
      '---',
      'docId: test-doc',
      'module: goals',
      'version: 1.0.0',
      'screens: ["goals"]',
      'relatedTools: ["upsert_portfolio_goal"]',
      'tags: ["meta", "carteira"]',
      '---',
      '',
      '# Metas',
      '## Onde encontrar',
      'Acesse a aba Metas.',
      '## Validações',
      'Valor deve ser maior que zero.',
    ].join('\n');

    const doc1 = parseKnowledgeMarkdown(md, 'docs/knowledge/test.md');
    const doc2 = parseKnowledgeMarkdown(md, 'docs/knowledge/test.md');

    expect(doc1.frontmatter.docId).toBe('test-doc');
    expect(doc1.chunks).toHaveLength(2);
    expect(doc1.chunks[0].sectionPath).toBe('Metas > Onde encontrar');
    expect(doc1.chunks[1].sectionPath).toBe('Metas > Validações');
    expect(doc1.contentHash).toBe(doc2.contentHash);
  });

  it('classifica níveis de risco corretamente e bloqueia intenções críticas de segurança', () => {
    expect(getToolRiskLevel('navigate_to_section')).toBe('L0');
    expect(requiresExplicitConfirmation('L0')).toBe(false);
    expect(getToolRiskLevel('upsert_portfolio_goal')).toBe('L2');
    expect(requiresExplicitConfirmation('L2')).toBe(true);
    expect(getToolRiskLevel('delete_portfolio_goal')).toBe('L3');
    expect(getToolRiskLevel('reset_all_data')).toBe('BLOCKED');

    expect(detectBlockedSecurityIntent('Resetar tudo e apagar todos os dados agora').blocked).toBe(true);
    expect(detectBlockedSecurityIntent('Como funciona o reset de dados?').blocked).toBe(false);
    expect(detectBlockedSecurityIntent('Mostrar minha chave de api openai').blocked).toBe(true);

    const redacted = redactSensitiveParams({
      title: 'Meta',
      openaiApiKey: 'sk-secret-123',
      nested: { password: '123' },
    });
    expect(redacted.title).toBe('Meta');
    expect(redacted.openaiApiKey).toBe('[REDACTED]');
    expect((redacted.nested as Record<string, unknown>).password).toBe('[REDACTED]');
  });

  it('roteia corretamente pedidos de guia, captura anotada, alteração de meta, configurações e filtros', () => {
    const guide = detectDeterministicToolCall('Como faço para cadastrar uma nova meta financeira?', SAMPLE_UI_STATE);
    expect(guide?.name).toBe('guide_feature_workflow');
    expect(guide?.args.tab).toBe('goals');

    const screenshot = detectDeterministicToolCall('Tire um print anotado das metas', SAMPLE_UI_STATE);
    expect(screenshot?.name).toBe('capture_annotated_screen');
    expect(screenshot?.args.tab).toBe('goals');

    const goal = detectDeterministicToolCall('Altere minha meta financeira para R$ 2.000', SAMPLE_UI_STATE);
    expect(goal?.name).toBe('upsert_portfolio_goal');
    expect(goal?.args.targetAmountBRL).toBe(2000);

    const prefs = detectDeterministicToolCall('Configure meu estado para MG e cidade Belo Horizonte', SAMPLE_UI_STATE);
    expect(prefs?.name).toBe('update_user_preferences');
    expect(prefs?.args.holidayState).toBe('MG');
    expect(prefs?.args.holidayCity).toBe('Belo Horizonte');

    const filters = detectDeterministicToolCall('Filtre o extrato apenas por despesas fixas', SAMPLE_UI_STATE);
    expect(filters?.name).toBe('apply_transaction_filters');
    expect(filters?.args.filterType).toBe('EXPENSE');
    expect(filters?.args.filterNature).toBe('STATIC');

    const holidaysGuide = detectDeterministicToolCall('Como configuro os feriados?', SAMPLE_UI_STATE);
    expect(holidaysGuide?.name).toBe('guide_feature_workflow');
    expect(holidaysGuide?.args.openModalType).toBe('SETTINGS');

    const photoOnGoals = detectDeterministicToolCall('Tira uma foto', {
      ...SAMPLE_UI_STATE,
      activeTab: 'goals',
    });
    expect(photoOnGoals?.name).toBe('capture_annotated_screen');
    expect(photoOnGoals?.args.tab).toBe('goals');

    expect(detectConversationalReply('Teste')).toBeTruthy();
    expect(detectConversationalReply('Oi')).toBeTruthy();
    expect(isFinancialAnalyticsQuery('Teste')).toBe(false);
    expect(isFinancialAnalyticsQuery('Quanto gastei este mês?')).toBe(true);
  });

  it('gera playbooks interativos com scroll interno de modal e coachmarks persistentes para feriados e regras fixas', () => {
    const holidaySteps = buildGuideSteps({
      tab: 'overview',
      topic: 'Configurar Estado, Cidade e Feriados',
      highlightTargetId: 'header.btn.settings',
      openModalType: 'SETTINGS',
    });
    expect(holidaySteps[0]?.action).toBe('OPEN_MODAL');
    expect(holidaySteps[0]?.modalType).toBe('SETTINGS');
    expect(holidaySteps.some((s) => s.targetId === 'modal.settings.section.holidays' && s.action === 'SCROLL_TO')).toBe(true);
    expect(holidaySteps.some((s) => s.targetId === 'modal.settings.select.state' && Boolean(s.tooltipBody))).toBe(true);
    expect(holidaySteps.some((s) => s.targetId === 'modal.settings.btn.holidays' && s.persistCoachmark === true)).toBe(true);

    const staticRuleSteps = buildGuideSteps({
      tab: 'goals',
      topic: 'Gerenciar Custos e Ganhos Estáticos',
      highlightTargetId: 'goals.section.staticRules',
      openModalType: 'STATIC_RULE',
    });
    expect(staticRuleSteps.some((s) => s.targetId === 'goals.table.staticRules')).toBe(true);
    expect(staticRuleSteps.some((s) => s.targetId === 'modal.staticRule.section.dueDate' && s.persistCoachmark === true)).toBe(true);

    const catCall = detectDeterministicToolCall('Me mostre como configurar categorias de gastos.', SAMPLE_UI_STATE);
    expect(catCall?.name).toBe('guide_feature_workflow');
    expect(catCall?.args.openModalType).toBe('CATEGORY');

    const catSteps = buildGuideSteps({
      tab: 'goals',
      topic: 'Cadastrar uma categoria personalizada para classificar gastos',
      highlightTargetId: 'goals.btn.createCategory',
    });
    expect(catSteps.some((s) => s.action === 'OPEN_MODAL' && s.modalType === 'CATEGORY')).toBe(true);
    expect(catSteps.some((s) => s.modalType === 'GOAL')).toBe(false);
    expect(catSteps.some((s) => s.targetId === 'modal.category.input.name' && s.persistCoachmark === true)).toBe(true);

    const budgetSteps = buildGuideSteps({
      tab: 'goals',
      topic: 'Definir limite de gastos por categoria',
      highlightTargetId: 'goals.btn.createBudget',
      openModalType: 'BUDGET',
    });
    expect(budgetSteps.some((s) => s.action === 'OPEN_MODAL' && s.modalType === 'BUDGET')).toBe(true);
    expect(budgetSteps.some((s) => s.modalType === 'GOAL')).toBe(false);

    const cardSteps = buildGuideSteps({ tab: 'accounts', topic: 'Cadastrar cartão de crédito', openModalType: 'CARD' });
    expect(cardSteps.some((s) => s.action === 'OPEN_MODAL' && s.modalType === 'CARD')).toBe(true);
    expect(cardSteps.some((s) => s.targetId === 'modal.card.input.limit')).toBe(true);

    const accSteps = buildGuideSteps({ tab: 'accounts', topic: 'Cadastrar nova conta bancária', openModalType: 'ACCOUNT' });
    expect(accSteps.some((s) => s.action === 'OPEN_MODAL' && s.modalType === 'ACCOUNT')).toBe(true);
    expect(accSteps.some((s) => s.targetId === 'modal.account.input.initialBalance')).toBe(true);

    const aiProvSteps = buildGuideSteps({ tab: 'ai', topic: 'Configurar chave de API da OpenAI' });
    expect(aiProvSteps.some((s) => s.targetId === 'ai.panel.providers')).toBe(true);
  });

  it('restringe retângulos de anotação e calcula recorte focado para telas longas', () => {
    const clamped = clampRectToCanvas({ x: -20, y: 950, width: 1400, height: 300 }, 1000, 800);
    expect(clamped.x).toBeGreaterThanOrEqual(4);
    expect(clamped.x + clamped.width).toBeLessThanOrEqual(1000);
    expect(clamped.y + clamped.height).toBeLessThanOrEqual(800);

    const crop = computeFocusedCropRegion(
      [
        { rect: { x: 100, y: 120, width: 200, height: 40 }, stepNumber: 1, label: 'A', color: 'indigo' },
        { rect: { x: 400, y: 520, width: 180, height: 40 }, stepNumber: 2, label: 'B', color: 'emerald' },
      ],
      1440,
      3600
    );
    expect(crop.y).toBe(32);
    expect(crop.height).toBeLessThan(1000);
  });
});

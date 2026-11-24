import type { AgentVisualStep } from '@/features/ai-agent/domain/agent-types';
import type { GuidePlaybookArgs } from '@/features/ai-agent/services/agent-guide-modal-playbooks';

const GOALS_TAB_STEP: AgentVisualStep = {
  id: 'g-tab',
  action: 'SWITCH_TAB',
  tab: 'goals',
  targetId: 'nav.tab.goals',
  caption: 'Abrindo aba Metas & Custos Estáticos',
};

function buildCategoryGuideSteps(): AgentVisualStep[] {
  return [
    GOALS_TAB_STEP,
    {
      id: 'cat-sec',
      action: 'SCROLL_TO',
      targetId: 'goals.section.categories',
      fallbackTextMatch: 'Categorias de Gastos & Ganhos',
      caption: 'Localizando seção Categorias de Gastos & Ganhos',
      tooltipTitle: 'Categorias de Gastos & Ganhos',
      tooltipBody:
        'Aqui você visualiza, edita, exclui ou cria categorias personalizadas de Despesa e Receita.',
      tooltipPlacement: 'top',
      tone: 'indigo',
      persistCoachmark: true,
      pauseMs: 1300,
    },
    {
      id: 'cat-open',
      action: 'OPEN_MODAL',
      modalType: 'CATEGORY',
      targetId: 'goals.btn.createExpenseCategory',
      fallbackTextMatch: 'Nova Categoria de Gasto',
      caption: 'Abrindo formulário Nova Categoria (sem salvar)',
      pauseMs: 320,
    },
    {
      id: 'cat-name',
      action: 'HIGHLIGHT',
      targetId: 'modal.category.input.name',
      caption: 'Campo Nome da Categoria',
      tooltipTitle: '1. Nome da Categoria',
      tooltipBody: 'Informe o nome da categoria (ex: Alimentação, Transporte, Assinaturas ou Lazer).',
      tooltipPlacement: 'bottom',
      tone: 'indigo',
      persistCoachmark: true,
      pauseMs: 1450,
    },
    {
      id: 'cat-type',
      action: 'HIGHLIGHT',
      targetId: 'modal.category.section.type',
      caption: 'Tipo (Despesa/Receita) e Natureza Padrão',
      tooltipTitle: '2. Tipo e Natureza Padrão',
      tooltipBody:
        'Escolha "Despesa" (para gastos) ou "Receita" (para ganhos) e defina se ela costuma ser Variável ou Fixa/Estática.',
      tooltipPlacement: 'bottom',
      tone: 'indigo',
      persistCoachmark: true,
      pauseMs: 1500,
    },
    {
      id: 'cat-icon',
      action: 'SCROLL_TO',
      targetId: 'modal.category.section.icon',
      caption: 'Ícone, Cor e Confirmação',
      tooltipTitle: '3. Ícone, Cor e Criar Categoria',
      tooltipBody:
        'Personalize o ícone e a cor para identificar seus gastos facilmente nos gráficos e no extrato. Depois clique em "Criar Categoria".',
      tooltipPlacement: 'top',
      tone: 'emerald',
      persistCoachmark: true,
      pauseMs: 1650,
    },
  ];
}

function buildBudgetGuideSteps(): AgentVisualStep[] {
  return [
    GOALS_TAB_STEP,
    {
      id: 'bdg-sec',
      action: 'SCROLL_TO',
      targetId: 'goals.section.budgets',
      fallbackTextMatch: 'Limites de Gastos por Categoria',
      caption: 'Localizando Limites de Gastos por Categoria',
      tooltipTitle: 'Limites de Gastos por Categoria',
      tooltipBody:
        'Defina tetos mensais por categoria de despesa para receber alertas visuais em 70% (Atenção) e 90%+ (Crítico).',
      tooltipPlacement: 'top',
      tone: 'indigo',
      persistCoachmark: true,
      pauseMs: 1300,
    },
    {
      id: 'bdg-open',
      action: 'OPEN_MODAL',
      modalType: 'BUDGET',
      targetId: 'goals.btn.createBudget',
      fallbackTextMatch: 'Definir Limite Mensal',
      caption: 'Abrindo formulário Limite por Categoria (sem salvar)',
      pauseMs: 320,
    },
    {
      id: 'bdg-cat',
      action: 'HIGHLIGHT',
      targetId: 'modal.budget.section.category',
      caption: 'Selecionar Categoria de Despesa',
      tooltipTitle: '1. Escolha a Categoria',
      tooltipBody: 'Selecione qual categoria de despesa terá o teto mensal acompanhado.',
      tooltipPlacement: 'bottom',
      tone: 'indigo',
      persistCoachmark: true,
      pauseMs: 1450,
    },
    {
      id: 'bdg-limit',
      action: 'HIGHLIGHT',
      targetId: 'modal.budget.input.limit',
      caption: 'Teto Máximo no Mês',
      tooltipTitle: '2. Informe o Teto e Salve',
      tooltipBody: 'Digite o valor máximo mensal em R$ e clique em "Salvar Limite".',
      tooltipPlacement: 'top',
      tone: 'emerald',
      persistCoachmark: true,
      pauseMs: 1600,
    },
  ];
}

export function buildGoalsTabPlaybook(args: GuidePlaybookArgs, topicNorm: string): AgentVisualStep[] {
  const hi = (args.highlightTargetId || '').toLowerCase();
  if (args.openModalType === 'BUDGET' || hi.includes('budget') || /(orcament|limite[s]? de gasto|teto[s]? de gasto|teto mensal)/.test(topicNorm)) {
    return buildBudgetGuideSteps();
  }
  if (args.openModalType === 'CATEGORY' || hi.includes('categor') || /categori/.test(topicNorm)) {
    return buildCategoryGuideSteps();
  }
  if (args.openModalType === 'STATIC_RULE' || hi.includes('staticrule') || /(estatic|fixo|fixa|recorrent|pular mes|dia util)/.test(topicNorm)) {
    const steps: AgentVisualStep[] = [
      GOALS_TAB_STEP,
      {
        id: 'sr-table',
        action: 'SCROLL_TO',
        targetId: 'goals.table.staticRules',
        fallbackTextMatch: 'Regras Fixas Mensais',
        caption: 'Localizando tabela de Regras Fixas Mensais',
        tooltipTitle: 'Regras Fixas Mensais',
        tooltipBody:
          'Clique direto no valor da coluna "Valor no mês" para ajustar um mês específico, ou abra o menu ⋯ à direita para Pular mês, Editar ou Excluir.',
        tooltipPlacement: 'top',
        tone: 'indigo',
        persistCoachmark: true,
        pauseMs: 1700,
      },
    ];
    if (args.openModalType === 'STATIC_RULE' && !/pular mes/.test(topicNorm)) {
      steps.push(
        {
          id: 'sr-open',
          action: 'OPEN_MODAL',
          modalType: 'STATIC_RULE',
          targetId: 'goals.btn.createExpenseRule',
          caption: 'Abrindo formulário de Regra Fixa (sem salvar)',
          pauseMs: 320,
        },
        {
          id: 'sr-due',
          action: 'SCROLL_TO',
          targetId: 'modal.staticRule.section.dueDate',
          fallbackTextMatch: 'Tipo de Vencimento',
          caption: 'Destacando configuração de Vencimento & Dia Útil',
          tooltipTitle: 'Dia Fixo ou Dia Útil (com Feriados)',
          tooltipBody:
            'Escolha "Dia Fixo" ou "Dia Útil" (ex: 5º dia útil). O cálculo desconta fins de semana e feriados da sua localização.',
          tooltipPlacement: 'top',
          tone: 'emerald',
          persistCoachmark: true,
          pauseMs: 1800,
        }
      );
    }
    return steps;
  }

  if (args.openModalType === 'GOAL' || /(meta|patrimonio|carteira)/.test(topicNorm) || !args.highlightTargetId) {
    return [
      GOALS_TAB_STEP,
      {
        id: 'goal-open',
        action: 'OPEN_MODAL',
        modalType: 'GOAL',
        targetId: 'goals.btn.create',
        caption: 'Abrindo formulário Definir Meta de Carteira',
        pauseMs: 320,
      },
      {
        id: 'goal-title',
        action: 'HIGHLIGHT',
        targetId: 'modal.goal.input.title',
        caption: 'Campo Título da Meta',
        tooltipTitle: '1. Nome da Meta',
        tooltipBody: 'Dê um nome objetivo à sua meta (ex: Reserva de Emergência, Viagem ou Aporte).',
        tooltipPlacement: 'bottom',
        tone: 'indigo',
        persistCoachmark: true,
        pauseMs: 1500,
      },
      {
        id: 'goal-amount',
        action: 'HIGHLIGHT',
        targetId: 'modal.goal.input.targetAmount',
        caption: 'Campo Valor Alvo da Meta',
        tooltipTitle: '2. Valor Alvo e Prazo',
        tooltipBody:
          'Informe o patrimônio desejado em R$ e selecione o Mês/Ano alvo logo abaixo. Depois confirme em "Salvar Meta".',
        tooltipPlacement: 'bottom',
        tone: 'emerald',
        persistCoachmark: true,
        pauseMs: 1700,
      },
    ];
  }

  return [
    GOALS_TAB_STEP,
    {
      id: 'g-custom',
      action: 'SCROLL_TO',
      targetId: args.highlightTargetId,
      caption: args.topic,
      tooltipTitle: args.topic,
      tooltipBody: 'Aqui está a seção solicitada dentro da aba Metas & Custos Estáticos.',
      tooltipPlacement: 'top',
      tone: 'indigo',
      persistCoachmark: true,
      pauseMs: 1600,
    },
  ];
}

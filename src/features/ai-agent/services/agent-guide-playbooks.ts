import type { AgentVisualStep } from '@/features/ai-agent/domain/agent-types';
import {
  buildGoalsAndStaticRulesPlaybook,
  buildSettingsPlaybook,
  type GuidePlaybookArgs,
} from '@/features/ai-agent/services/agent-guide-modal-playbooks';

function norm(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function buildRichGuidePlaybook(args: GuidePlaybookArgs): AgentVisualStep[] {
  const topicNorm = norm(args.topic);

  if (args.openModalType === 'SETTINGS' || /(feriado|configurac|backup|snapshot|ciclo mensal|tema|privacidad)/.test(topicNorm)) {
    return buildSettingsPlaybook(topicNorm);
  }

  if (
    args.tab === 'goals' ||
    args.openModalType === 'GOAL' ||
    args.openModalType === 'STATIC_RULE' ||
    args.openModalType === 'CATEGORY' ||
    args.openModalType === 'BUDGET'
  ) {
    return buildGoalsAndStaticRulesPlaybook(args, topicNorm);
  }

  if (args.tab === 'forecast') {
    return [
      { id: 'fc-tab', action: 'SWITCH_TAB', tab: 'forecast', targetId: 'nav.tab.forecast', caption: 'Abrindo Previsão de Valor' },
      {
        id: 'fc-in',
        action: 'HIGHLIGHT',
        targetId: 'forecast.btn.addIncome',
        caption: 'Destacando botão Vou Ganhar',
        tooltipTitle: 'Registrar Entradas Previstas',
        tooltipBody:
          'Adicione valores futuros (ex: 13º, freelance ou reembolso) para simular o impacto no seu saldo e na Meta Fictícia.',
        tooltipPlacement: 'bottom',
        tone: 'emerald',
        persistCoachmark: true,
        pauseMs: 1600,
      },
      {
        id: 'fc-target',
        action: 'HIGHLIGHT',
        targetId: 'forecast.btn.addTarget',
        caption: 'Destacando Nova Meta de Saldo',
        tooltipTitle: 'Meta de Saldo Futuro',
        tooltipBody:
          'Crie uma meta de saldo futuro para acompanhar automaticamente se as entradas e gastos previstos atingem seu objetivo.',
        tooltipPlacement: 'bottom',
        tone: 'indigo',
        persistCoachmark: true,
        pauseMs: 1600,
      },
    ];
  }

  if (args.tab === 'accounts' || args.openModalType === 'ACCOUNT' || args.openModalType === 'CARD') {
    const tabStep: AgentVisualStep = { id: 'ac-tab', action: 'SWITCH_TAB', tab: 'accounts', targetId: 'nav.tab.accounts', caption: 'Abrindo Contas & Cartões' };
    if (args.openModalType === 'CARD' || /(cartao|cartoes|fatura|fechamento)/.test(topicNorm)) {
      return [
        tabStep,
        { id: 'card-open', action: 'OPEN_MODAL', modalType: 'CARD', targetId: 'accounts.btn.createCard', caption: 'Abrindo Novo Cartão (sem salvar)', pauseMs: 320 },
        { id: 'card-name', action: 'HIGHLIGHT', targetId: 'modal.card.input.name', caption: 'Nome e Bandeira do Cartão', tooltipTitle: '1. Nome e Bandeira', tooltipBody: 'Informe o nome do cartão (ex: Nubank, XP) e selecione a bandeira logo abaixo.', tooltipPlacement: 'bottom', tone: 'indigo', persistCoachmark: true, pauseMs: 1400 },
        { id: 'card-limit', action: 'HIGHLIGHT', targetId: 'modal.card.input.limit', caption: 'Limite, Fechamento e Vencimento', tooltipTitle: '2. Limite e Datas da Fatura', tooltipBody: 'Configure o limite total e os dias de fechamento e vencimento para o cálculo automático das faturas. Depois clique em "Salvar Cartão".', tooltipPlacement: 'top', tone: 'emerald', persistCoachmark: true, pauseMs: 1600 },
      ];
    }
    if (args.openModalType === 'ACCOUNT' || /(conta|carteira|banco|saldo inicial)/.test(topicNorm)) {
      return [
        tabStep,
        { id: 'acc-open', action: 'OPEN_MODAL', modalType: 'ACCOUNT', targetId: 'accounts.btn.createAccount', caption: 'Abrindo Nova Conta (sem salvar)', pauseMs: 320 },
        { id: 'acc-name', action: 'HIGHLIGHT', targetId: 'modal.account.input.name', caption: 'Nome e Tipo da Conta', tooltipTitle: '1. Nome e Tipo da Conta', tooltipBody: 'Informe o nome do banco/carteira e escolha entre Conta Corrente, Reserva ou Dinheiro Físico.', tooltipPlacement: 'bottom', tone: 'indigo', persistCoachmark: true, pauseMs: 1400 },
        { id: 'acc-bal', action: 'SCROLL_TO', targetId: 'modal.account.input.initialBalance', caption: 'Saldo Inicial da Conta', tooltipTitle: '2. Saldo Inicial e Salvar', tooltipBody: 'Informe o saldo inicial em R$ para compor seu patrimônio consolidado e clique em "Criar Conta".', tooltipPlacement: 'top', tone: 'emerald', persistCoachmark: true, pauseMs: 1600 },
      ];
    }
    return [
      tabStep,
      { id: 'ac-acc', action: 'HIGHLIGHT', targetId: 'accounts.btn.createAccount', caption: 'Destacando Nova Conta', tooltipTitle: 'Cadastrar Conta Bancária', tooltipBody: 'Cadastre contas correntes, reservas ou dinheiro em mãos para compor seu patrimônio.', tooltipPlacement: 'bottom', tone: 'indigo', persistCoachmark: true, pauseMs: 1500 },
      { id: 'ac-card', action: 'HIGHLIGHT', targetId: 'accounts.btn.createCard', caption: 'Destacando Novo Cartão', tooltipTitle: 'Cadastrar Cartão de Crédito', tooltipBody: 'Configure limite, fechamento e vencimento para acompanhar faturas sem dupla contagem.', tooltipPlacement: 'bottom', tone: 'emerald', persistCoachmark: true, pauseMs: 1500 },
    ];
  }

  if (args.tab === 'transactions' || args.openModalType === 'TX') {
    const wantsNewTx = args.openModalType === 'TX' || /(novo lancamento|cadastrar|registrar|adicionar|lancar).*(despesa|receita|gasto|ganho|lancamento)/.test(topicNorm);
    const steps: AgentVisualStep[] = [
      { id: 'tx-tab', action: 'SWITCH_TAB', tab: 'transactions', targetId: 'nav.tab.transactions', caption: 'Abrindo Extrato & Comprovantes' },
      { id: 'tx-search', action: 'HIGHLIGHT', targetId: 'transactions.filter.search', caption: 'Destacando busca e filtros do extrato', tooltipTitle: 'Buscar e Filtrar Lançamentos', tooltipBody: 'Use a busca por texto e os filtros ao lado para isolar receitas, despesas, custos fixos ou categorias.', tooltipPlacement: 'bottom', tone: 'indigo', persistCoachmark: true, pauseMs: 1400 },
    ];
    if (wantsNewTx) {
      steps.push(
        { id: 'tx-open', action: 'OPEN_MODAL', modalType: 'TX', targetId: 'header.btn.newTx', caption: 'Abrindo Novo Lançamento (sem salvar)', pauseMs: 320 },
        { id: 'tx-amt', action: 'HIGHLIGHT', targetId: 'modal.tx.input.amount', caption: 'Campo Valor do Lançamento', tooltipTitle: 'Preencher Valor e Descrição', tooltipBody: 'Informe o valor, a descrição, a conta/cartão e a categoria. Ao concluir, clique em Salvar.', tooltipPlacement: 'bottom', tone: 'emerald', persistCoachmark: true, pauseMs: 1600 }
      );
    }
    return steps;
  }

  if (args.tab === 'ai') {
    const tabStep: AgentVisualStep = { id: 'ai-tab', action: 'SWITCH_TAB', tab: 'ai', targetId: 'nav.tab.ai', caption: 'Abrindo Copiloto IA & Extrato' };
    if (/(provedor|openai|gemini|claude|api key|chave|token|modelo|sanity)/.test(topicNorm)) {
      return [
        tabStep,
        { id: 'ai-prov', action: 'SCROLL_TO', targetId: 'ai.panel.providers', caption: 'Destacando Conector de Provedores IA', tooltipTitle: 'Configurar Provedores e Chaves de API', tooltipBody: 'Cole sua API Key da OpenAI, Google Gemini ou Anthropic Claude, clique em Atualizar para carregar os modelos reais e teste no Console Sanity Check.', tooltipPlacement: 'top', tone: 'indigo', persistCoachmark: true, pauseMs: 1700 },
      ];
    }
    return [
      tabStep,
      { id: 'ai-rec', action: 'SCROLL_TO', targetId: 'ai.panel.reconciliation', caption: 'Destacando Conciliação de Extratos', tooltipTitle: 'Conciliação Inteligente de Extratos', tooltipBody: 'Importe arquivos CSV, OFX, XLSX, PDF ou TXT do seu banco para classificar, detectar duplicidades e conciliar lançamentos.', tooltipPlacement: 'top', tone: 'indigo', persistCoachmark: true, pauseMs: 1600 },
      { id: 'ai-health', action: 'SCROLL_TO', targetId: 'ai.panel.healthReports', caption: 'Destacando Diagnóstico de Status Financeiro', tooltipTitle: 'Diagnóstico Financeiro com IA', tooltipBody: 'Gere relatórios completos sobre sua saúde financeira, margem livre e projeções mensais.', tooltipPlacement: 'top', tone: 'emerald', persistCoachmark: true, pauseMs: 1600 },
    ];
  }

  const fallbackSteps: AgentVisualStep[] = [
    { id: 'fb-tab', action: 'SWITCH_TAB', tab: args.tab, targetId: `nav.tab.${args.tab}`, caption: `Abrindo ${args.topic}` },
  ];
  if (args.openModalType) {
    fallbackSteps.push({
      id: 'fb-modal',
      action: 'OPEN_MODAL',
      modalType: args.openModalType,
      targetId: args.highlightTargetId,
      caption: `Abrindo formulário: ${args.topic}`,
      pauseMs: 320,
    });
  }
  if (args.highlightTargetId) {
    fallbackSteps.push({
      id: 'fb-hi',
      action: 'SCROLL_TO',
      targetId: args.highlightTargetId,
      caption: args.topic,
      tooltipTitle: args.topic,
      tooltipBody: 'Aqui está o controle principal relacionado à sua pergunta. Você pode interagir diretamente com ele.',
      tooltipPlacement: 'bottom',
      tone: 'indigo',
      persistCoachmark: true,
      pauseMs: 1600,
    });
  }
  return fallbackSteps;
}

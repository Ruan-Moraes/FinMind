import type { ActiveTab } from '@/features/dashboard/types/workbench-types';

export interface AgentTargetMeta {
  label: string;
  tab?: ActiveTab;
  modal?: string;
  sensitive?: boolean;
}

export const AGENT_TARGET_REGISTRY = {
  // Header & Navegação Global
  'header.period.month': { label: 'Seletor de Mês' },
  'header.period.year': { label: 'Seletor de Ano' },
  'header.model.selector': { label: 'Seletor de Modelo IA' },
  'header.btn.privacy': { label: 'Modo Privacidade' },
  'header.btn.theme': { label: 'Alternar Tema' },
  'header.btn.settings': { label: 'Abrir Configurações' },
  'header.btn.newTx': { label: 'Novo Lançamento' },
  'agent.btn.toggleChat': { label: 'Assistente IA Flutuante' },

  // Abas principais
  'nav.tab.overview': { label: 'Aba Visão Geral', tab: 'overview' },
  'nav.tab.ai': { label: 'Aba Copiloto IA & Extrato', tab: 'ai' },
  'nav.tab.comparison': { label: 'Aba Comparativo Entre Meses', tab: 'comparison' },
  'nav.tab.goals': { label: 'Aba Meta de Carteira & Custos Estáticos', tab: 'goals' },
  'nav.tab.forecast': { label: 'Aba Previsão de Valor', tab: 'forecast' },
  'nav.tab.accounts': { label: 'Aba Contas & Cartões', tab: 'accounts' },
  'nav.tab.transactions': { label: 'Aba Extrato & Comprovantes', tab: 'transactions' },

  // Visão Geral
  'overview.kpis': { label: 'Cartões de KPI do Mês', tab: 'overview' },
  'overview.highlights': { label: 'Destaques do Mês', tab: 'overview' },

  // Metas & Custos Estáticos
  'goals.section.goals': { label: 'Seção Metas de Carteira', tab: 'goals' },
  'goals.section.combined': { label: 'Metas Juntas & Simulador', tab: 'goals' },
  'goals.btn.create': { label: 'Botão Definir Meta de Carteira', tab: 'goals' },
  'goals.section.staticRules': { label: 'Seção Custos e Ganhos Estáticos', tab: 'goals' },
  'goals.table.staticRules': { label: 'Tabela Regras Fixas Mensais', tab: 'goals' },
  'goals.btn.createIncomeRule': { label: 'Botão Novo Ganho Estático', tab: 'goals' },
  'goals.btn.createExpenseRule': { label: 'Botão Novo Custo Estático', tab: 'goals' },
  'goals.section.budgets': { label: 'Seção Limites de Gastos por Categoria', tab: 'goals' },
  'goals.btn.createBudget': { label: 'Botão Novo Orçamento Mensal', tab: 'goals' },
  'goals.section.categories': { label: 'Seção Categorias Personalizadas', tab: 'goals' },
  'goals.btn.createCategory': { label: 'Botão Nova Categoria', tab: 'goals' },
  'goals.btn.createExpenseCategory': { label: 'Botão Nova Categoria de Gasto', tab: 'goals' },
  'goals.btn.createIncomeCategory': { label: 'Botão Nova Categoria de Ganho', tab: 'goals' },

  // Previsão de Valor
  'forecast.btn.addIncome': { label: 'Botão Vou Ganhar', tab: 'forecast' },
  'forecast.btn.addExpense': { label: 'Botão Provável Gasto', tab: 'forecast' },
  'forecast.btn.addTarget': { label: 'Botão Nova Meta de Saldo', tab: 'forecast' },

  // Contas & Cartões
  'accounts.btn.createAccount': { label: 'Botão Nova Conta', tab: 'accounts' },
  'accounts.btn.createCard': { label: 'Botão Novo Cartão', tab: 'accounts' },

  // Extrato & Comprovantes
  'transactions.filter.search': { label: 'Campo de Busca do Extrato', tab: 'transactions' },
  'transactions.filter.type': { label: 'Filtro de Tipo do Extrato', tab: 'transactions' },
  'transactions.filter.nature': { label: 'Filtro de Natureza do Extrato', tab: 'transactions' },
  'transactions.filter.category': { label: 'Filtro de Categoria do Extrato', tab: 'transactions' },
  'transactions.table': { label: 'Lista de Lançamentos do Extrato', tab: 'transactions' },

  // Copiloto IA & Relatórios
  'ai.panel.providers': { label: 'Conector de Provedores IA', tab: 'ai', sensitive: true },
  'ai.panel.reconciliation': { label: 'Conciliação Inteligente de Extratos', tab: 'ai' },
  'ai.panel.healthReports': { label: 'Diagnóstico de Status Financeiro IA', tab: 'ai' },
  'ai.panel.auditLog': { label: 'Histórico de Ações do Agente IA', tab: 'ai' },
  'ai.btn.generateHealth': { label: 'Botão Gerar Diagnóstico Agora', tab: 'ai' },

  // Modais e Campos Chave
  'modal.goal.input.title': { label: 'Título da Meta', modal: 'GOAL' },
  'modal.goal.input.targetAmount': { label: 'Valor Alvo da Meta', modal: 'GOAL' },
  'modal.goal.select.month': { label: 'Mês Alvo da Meta', modal: 'GOAL' },
  'modal.goal.input.year': { label: 'Ano Alvo da Meta', modal: 'GOAL' },
  'modal.goal.input.notes': { label: 'Observações da Meta', modal: 'GOAL' },
  'modal.goal.btn.submit': { label: 'Salvar Meta', modal: 'GOAL' },

  'modal.staticRule.input.description': { label: 'Descrição da Regra Fixa', modal: 'STATIC_RULE' },
  'modal.staticRule.input.amount': { label: 'Valor da Regra Fixa', modal: 'STATIC_RULE' },
  'modal.staticRule.section.dueDate': { label: 'Vencimento & Dia Útil da Regra', modal: 'STATIC_RULE' },
  'modal.staticRule.btn.submit': { label: 'Salvar Regra Fixa', modal: 'STATIC_RULE' },

  'modal.category.input.name': { label: 'Nome da Categoria', modal: 'CATEGORY' },
  'modal.category.section.type': { label: 'Tipo da Categoria (Despesa/Receita)', modal: 'CATEGORY' },
  'modal.category.section.nature': { label: 'Natureza Padrão (Fixo/Variável)', modal: 'CATEGORY' },
  'modal.category.section.icon': { label: 'Ícone da Categoria', modal: 'CATEGORY' },
  'modal.category.section.color': { label: 'Cor da Categoria', modal: 'CATEGORY' },
  'modal.category.btn.submit': { label: 'Criar ou Salvar Categoria', modal: 'CATEGORY' },

  'modal.budget.section.category': { label: 'Categoria do Limite Mensal', modal: 'BUDGET' },
  'modal.budget.input.limit': { label: 'Teto Máximo no Mês (R$)', modal: 'BUDGET' },
  'modal.budget.btn.submit': { label: 'Salvar Limite Mensal', modal: 'BUDGET' },

  'modal.account.input.name': { label: 'Nome da Conta', modal: 'ACCOUNT' },
  'modal.account.section.type': { label: 'Tipo de Conta / Carteira', modal: 'ACCOUNT' },
  'modal.account.input.initialBalance': { label: 'Saldo Inicial da Conta', modal: 'ACCOUNT' },
  'modal.account.btn.submit': { label: 'Criar ou Salvar Conta', modal: 'ACCOUNT' },

  'modal.card.input.name': { label: 'Nome do Cartão', modal: 'CARD' },
  'modal.card.section.brand': { label: 'Bandeira do Cartão', modal: 'CARD' },
  'modal.card.input.limit': { label: 'Limite Total do Cartão', modal: 'CARD' },
  'modal.card.input.closingDay': { label: 'Dia de Fechamento da Fatura', modal: 'CARD' },
  'modal.card.input.dueDay': { label: 'Dia de Vencimento da Fatura', modal: 'CARD' },
  'modal.card.btn.submit': { label: 'Salvar Cartão', modal: 'CARD' },

  'modal.tx.input.amount': { label: 'Valor do Lançamento', modal: 'TX' },
  'modal.tx.input.description': { label: 'Descrição do Lançamento', modal: 'TX' },
  'modal.tx.input.date': { label: 'Data do Lançamento', modal: 'TX' },
  'modal.tx.btn.submit': { label: 'Salvar Lançamento', modal: 'TX' },

  'modal.settings.section.theme': { label: 'Seção Aparência da Interface', modal: 'SETTINGS' },
  'modal.settings.section.preferences': { label: 'Seção Preferências Operacionais', modal: 'SETTINGS' },
  'modal.settings.section.privacy': { label: 'Seção Modo Privacidade', modal: 'SETTINGS' },
  'modal.settings.section.holidays': { label: 'Seção Localização & Feriados', modal: 'SETTINGS' },
  'modal.settings.section.backup': { label: 'Seção Exportação & Backup Snapshot', modal: 'SETTINGS' },
  'modal.settings.fiscalDay': { label: 'Início do Ciclo Mensal', modal: 'SETTINGS' },
  'modal.settings.select.state': { label: 'Estado (UF) para Feriados', modal: 'SETTINGS' },
  'modal.settings.input.city': { label: 'Cidade para Feriados', modal: 'SETTINGS' },
  'modal.settings.btn.holidays': { label: 'Botão Calendário de Feriados', modal: 'SETTINGS' },
  'modal.settings.btn.submit': { label: 'Salvar Preferências', modal: 'SETTINGS' },
  'modal.settings.dangerZone': { label: 'Zona de Perigo (Reset)', modal: 'SETTINGS', sensitive: true },
} as const satisfies Record<string, AgentTargetMeta>;

export type AgentTargetId = keyof typeof AGENT_TARGET_REGISTRY;

export function isKnownAgentTargetId(id: string): id is AgentTargetId {
  return Object.prototype.hasOwnProperty.call(AGENT_TARGET_REGISTRY, id);
}

export function getAgentTargetMeta(id: string): AgentTargetMeta | null {
  if (!isKnownAgentTargetId(id)) return null;
  return AGENT_TARGET_REGISTRY[id];
}

import type { ActiveTab } from '@/features/dashboard/types/workbench-types';

export function buildScreenshotArgsForTab(tab: ActiveTab): Record<string, unknown> {
  if (tab === 'goals') {
    return {
      tab: 'goals',
      title: 'Guia Visual: Metas de Carteira & Custos Estáticos',
      annotations: [
        { targetId: 'nav.tab.goals', label: 'Aba Metas & Custos Estáticos' },
        { targetId: 'goals.btn.create', label: 'Clique aqui para criar uma Meta' },
        { targetId: 'goals.btn.createExpenseRule', label: 'Cadastre Custos Estáticos aqui' },
      ],
    };
  }
  if (tab === 'transactions') {
    return {
      tab: 'transactions',
      title: 'Guia Visual: Extrato & Filtros de Lançamentos',
      annotations: [
        { targetId: 'transactions.filter.search', label: 'Busque por descrição ou #tag' },
        { targetId: 'transactions.filter.type', label: 'Filtre por Receita ou Despesa' },
        { targetId: 'header.btn.newTx', label: 'Clique para Novo Lançamento' },
      ],
    };
  }
  if (tab === 'forecast') {
    return {
      tab: 'forecast',
      title: 'Guia Visual: Previsão de Valor',
      annotations: [
        { targetId: 'nav.tab.forecast', label: 'Aba Previsão de Valor' },
        { targetId: 'forecast.btn.addIncome', label: 'Adicione ganhos ou gastos previstos' },
        { targetId: 'forecast.btn.addTarget', label: 'Defina metas de saldo por data' },
      ],
    };
  }
  if (tab === 'accounts') {
    return {
      tab: 'accounts',
      title: 'Guia Visual: Contas & Cartões',
      annotations: [
        { targetId: 'nav.tab.accounts', label: 'Aba Contas & Cartões' },
        { targetId: 'accounts.btn.createAccount', label: 'Cadastre ou gerencie contas' },
        { targetId: 'accounts.btn.createCard', label: 'Adicione um cartão de crédito' },
      ],
    };
  }
  if (tab === 'ai') {
    return {
      tab: 'ai',
      title: 'Guia Visual: Copiloto IA & Extrato',
      annotations: [
        { targetId: 'ai.panel.reconciliation', label: 'Importação e conciliação de extratos' },
        { targetId: 'ai.btn.generateHealth', label: 'Gere diagnóstico financeiro com IA' },
      ],
    };
  }
  return {
    tab: tab === 'comparison' ? 'comparison' : 'overview',
    title:
      tab === 'comparison'
        ? 'Guia Visual: Comparativo Entre Meses'
        : 'Guia Visual: Visão Geral do FinMind',
    annotations: [
      { targetId: 'overview.kpis', label: 'Resumo do mês e saldo consolidado' },
      { targetId: 'header.btn.settings', label: 'Configurações, Estado/Cidade e Feriados' },
      { targetId: 'header.btn.newTx', label: 'Atalho para Novo Lançamento' },
    ],
  };
}

import type { ActiveTab } from '@/features/dashboard/types/workbench-types';
import type {
  AgentVisualStep,
  ScreenshotCaptureDirective,
  UiStateSnapshot,
} from '@/features/ai-agent/domain/agent-types';
import type { ProviderToolCallResult } from '@/features/ai-agent/services/agent-tool-provider-client';

function normalizeText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseBrlAmount(text: string): number | null {
  const m = text.match(/r\$\s*([\d.]+(?:,\d{1,2})?)|(?:\bpara|\bde)\s+([\d.]+(?:,\d{1,2})?)\b/i);
  const raw = m?.[1] || m?.[2];
  if (!raw) return null;
  const num = Number(raw.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function detectDeterministicToolCall(
  message: string,
  uiState: UiStateSnapshot
): ProviderToolCallResult | null {
  const norm = normalizeText(message);

  if (/\b(print|screenshot|captura de tela|captura|foto da tela|imagem da tela)\b/.test(norm)) {
    if (/\b(meta|metas|estatico|custo fixo)\b/.test(norm)) {
      return {
        name: 'capture_annotated_screen',
        args: {
          tab: 'goals',
          title: 'Guia Visual: Metas de Carteira & Custos Estáticos',
          annotations: [
            { targetId: 'nav.tab.goals', label: 'Aba Metas & Custos Estáticos' },
            { targetId: 'goals.btn.create', label: 'Clique aqui para criar uma Meta' },
            { targetId: 'goals.btn.createExpenseRule', label: 'Cadastre Custos Estáticos aqui' },
          ],
        },
      };
    }
    if (/\b(configurac|feriado|estado|cidade|preferencia)\b/.test(norm)) {
      return {
        name: 'capture_annotated_screen',
        args: {
          tab: uiState.activeTab,
          openModalType: 'SETTINGS',
          title: 'Guia Visual: Configurações, Estado/Cidade & Feriados',
          annotations: [
            { targetId: 'modal.settings.select.state', label: 'Selecione seu Estado (UF)' },
            { targetId: 'modal.settings.input.city', label: 'Informe sua Cidade' },
            { targetId: 'modal.settings.btn.holidays', label: 'Abra o Calendário de Feriados' },
          ],
        },
      };
    }
    if (/\b(extrato|lancamento|filtro|transac)\b/.test(norm)) {
      return {
        name: 'capture_annotated_screen',
        args: {
          tab: 'transactions',
          title: 'Guia Visual: Extrato & Filtros de Lançamentos',
          annotations: [
            { targetId: 'transactions.filter.search', label: 'Busque por descrição ou #tag' },
            { targetId: 'transactions.filter.type', label: 'Filtre por Receita ou Despesa' },
            { targetId: 'header.btn.newTx', label: 'Clique para Novo Lançamento' },
          ],
        },
      };
    }
    return {
      name: 'capture_annotated_screen',
      args: {
        tab: 'overview',
        title: 'Guia Visual: Visão Geral do FinMind',
        annotations: [
          { targetId: 'overview.kpis', label: 'Resumo do mês e saldo consolidado' },
          { targetId: 'header.btn.settings', label: 'Configurações, Estado/Cidade e Feriados' },
          { targetId: 'header.btn.newTx', label: 'Atalho para Novo Lançamento' },
        ],
      },
    };
  }

  if (/\b(como faco|como faz|como cadastr|como cri|como edit|onde fica|onde configur|me ensine|me mostre como|demonstr)\b/.test(norm)) {
    if (/\b(meta|patrimonio|carteira)\b/.test(norm)) {
      return {
        name: 'guide_feature_workflow',
        args: { tab: 'goals', topic: 'Cadastrar uma nova Meta de Carteira', highlightTargetId: 'goals.btn.create', openModalType: 'GOAL' },
      };
    }
    if (/\b(feriado|estado|cidade|uf|dia util|configurac|ciclo mensal)\b/.test(norm)) {
      return {
        name: 'guide_feature_workflow',
        args: { tab: uiState.activeTab, topic: 'Configurar Estado, Cidade e Feriados', highlightTargetId: 'header.btn.settings', openModalType: 'SETTINGS' },
      };
    }
    if (/\b(custo estatico|ganho estatico|fixo|recorrente)\b/.test(norm)) {
      return {
        name: 'guide_feature_workflow',
        args: { tab: 'goals', topic: 'Cadastrar Custos ou Ganhos Estáticos', highlightTargetId: 'goals.btn.createExpenseRule', openModalType: 'STATIC_RULE' },
      };
    }
    if (/\b(previsao|vou ganhar|provavel gasto)\b/.test(norm)) {
      return {
        name: 'guide_feature_workflow',
        args: { tab: 'forecast', topic: 'Usar a aba Previsão de Valor', highlightTargetId: 'forecast.btn.addIncome' },
      };
    }
    if (/\b(conta|cartao|fatura)\b/.test(norm)) {
      return {
        name: 'guide_feature_workflow',
        args: { tab: 'accounts', topic: 'Gerenciar Contas e Cartões', highlightTargetId: 'accounts.btn.createAccount' },
      };
    }
    if (/\b(lancamento|despesa|receita|extrato)\b/.test(norm)) {
      return {
        name: 'guide_feature_workflow',
        args: { tab: 'transactions', topic: 'Registrar um Novo Lançamento', highlightTargetId: 'header.btn.newTx', openModalType: 'TX' },
      };
    }
  }

  if (/\b(alter|mud|atualiz|defin|cri|cadastr)[a-z]*\b.*\b(meta)\b/.test(norm)) {
    const amount = parseBrlAmount(message);
    if (amount) {
      const isEdit = /\b(alter|mud|atualiz)/.test(norm);
      return {
        name: 'upsert_portfolio_goal',
        args: {
          ...(isEdit ? { matchTitle: '' } : {}),
          title: isEdit ? 'Meta Financeira' : 'Nova Meta de Carteira',
          targetAmountBRL: amount,
          targetMonth: uiState.selectedMonth,
          targetYear: uiState.selectedYear,
        },
      };
    }
  }

  if (/\b(configur|defin|alter|mud)[a-z]*\b.*\b(estado|uf|cidade|ciclo mensal|tema)\b/.test(norm)) {
    const args: Record<string, unknown> = {};
    const ufMatch = message.match(/\b(?:estado|uf)\s+(?:para\s+)?([A-Z]{2})\b/i);
    if (ufMatch) args.holidayState = ufMatch[1].toUpperCase();
    const cityMatch = message.match(/cidade\s+(?:para\s+)?([A-Za-zÀ-ÿ\s]{2,40}?)(?:\s+e\s+|\s*$|[.,;])/i);
    if (cityMatch) args.holidayCity = cityMatch[1].trim();
    const cycleMatch = norm.match(/ciclo\s+mensal.*?\bdia\s+(\d{1,2})\b/);
    if (cycleMatch) args.fiscalMonthStartDay = Number(cycleMatch[1]);
    if (/\btema\s+claro\b/.test(norm)) args.theme = 'LIGHT';
    if (/\btema\s+escuro\b/.test(norm)) args.theme = 'DARK';
    if (Object.keys(args).length > 0) return { name: 'update_user_preferences', args };
  }

  if (/\b(filtr|busc|pesquis|mostr)[a-z]*\b.*\b(extrato|lancamento|despesa|receita|estatico)/.test(norm) && !/\bgrafico\b/.test(norm)) {
    const filterType = /\bdespesa/.test(norm) ? 'EXPENSE' : /\breceita/.test(norm) ? 'INCOME' : /\btransfer/.test(norm) ? 'TRANSFER' : 'ALL';
    const filterNature = /\b(estatic|fix[oa])/.test(norm) ? 'STATIC' : /\bvariave/.test(norm) ? 'VARIABLE' : 'ALL';
    const qMatch = message.match(/(?:por|com|chamado|contendo)\s+"?([^".,!?]{2,40})"?/i);
    return {
      name: 'apply_transaction_filters',
      args: {
        filterType,
        filterNature,
        ...(qMatch && !/despesa|receita|estatico|fixo/i.test(qMatch[1]) ? { searchQuery: qMatch[1].trim() } : {}),
      },
    };
  }

  if (/\b(va para|ir para|abra|abrir|navegue|levar para)\b/.test(norm)) {
    if (/\b(configurac|preferencia|feriado)\b/.test(norm)) return { name: 'open_settings', args: {} };
    if (/\b(meta|estatico)\b/.test(norm)) return { name: 'navigate_to_section', args: { tab: 'goals' } };
    if (/\b(previsao)\b/.test(norm)) return { name: 'navigate_to_section', args: { tab: 'forecast' } };
    if (/\b(conta|cartao)\b/.test(norm)) return { name: 'navigate_to_section', args: { tab: 'accounts' } };
    if (/\b(extrato|lancamento)\b/.test(norm)) return { name: 'navigate_to_section', args: { tab: 'transactions' } };
    if (/\b(comparativo)\b/.test(norm)) return { name: 'navigate_to_section', args: { tab: 'comparison' } };
    if (/\b(copiloto|conciliacao|diagnostico)\b/.test(norm)) return { name: 'navigate_to_section', args: { tab: 'ai' } };
    if (/\b(visao geral|inicio|dashboard)\b/.test(norm)) return { name: 'navigate_to_section', args: { tab: 'overview' } };
  }

  return null;
}

export function buildGuideSteps(args: {
  tab: ActiveTab;
  topic: string;
  highlightTargetId?: string;
  openModalType?: string;
}): AgentVisualStep[] {
  const steps: AgentVisualStep[] = [
    { id: 'g1', action: 'SWITCH_TAB', tab: args.tab, targetId: `nav.tab.${args.tab}`, caption: `Abrindo aba de ${args.topic}` },
  ];
  if (args.highlightTargetId) {
    steps.push({ id: 'g2', action: 'HIGHLIGHT', targetId: args.highlightTargetId, caption: `Localizando controle: ${args.topic}`, pauseMs: 650 });
  }
  if (args.openModalType) {
    steps.push({ id: 'g3', action: 'OPEN_MODAL', modalType: args.openModalType, targetId: args.highlightTargetId, caption: 'Abrindo formulário para demonstração (sem salvar)', pauseMs: 650 });
  }
  return steps;
}

export function buildScreenshotDirective(args: {
  tab: ActiveTab;
  title: string;
  openModalType?: string;
  annotations: Array<{ targetId: string; label: string }>;
}): ScreenshotCaptureDirective {
  const prepareSteps: AgentVisualStep[] = [
    { id: 'sc1', action: 'SWITCH_TAB', tab: args.tab, targetId: `nav.tab.${args.tab}`, caption: `Preparando tela: ${args.title}`, pauseMs: 180 },
  ];
  if (args.openModalType) {
    prepareSteps.push({ id: 'sc2', action: 'OPEN_MODAL', modalType: args.openModalType, caption: 'Abrindo modal para captura', pauseMs: 260 });
  }
  return {
    title: args.title,
    subtitle: 'Captura real da interface atual com anotações contextuais',
    prepareSteps,
    annotations: args.annotations.map((a, idx) => ({
      targetId: a.targetId,
      stepNumber: idx + 1,
      label: a.label,
      color: idx === 0 ? 'indigo' : idx === 1 ? 'emerald' : 'amber',
    })),
  };
}

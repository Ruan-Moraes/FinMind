import type { ActiveTab } from '@/features/dashboard/types/workbench-types';
import type {
  AgentVisualStep,
  ScreenshotCaptureDirective,
  UiStateSnapshot,
} from '@/features/ai-agent/domain/agent-types';
import type { ProviderToolCallResult } from '@/features/ai-agent/services/agent-tool-provider-client';
import { buildScreenshotArgsForTab } from '@/features/ai-agent/services/agent-screenshot-presets';
import { buildRichGuidePlaybook } from '@/features/ai-agent/services/agent-guide-playbooks';

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

  if (/\b(print[a-z]*|screenshot|captur[a-z]*|foto[s]?|fotograf[a-z]*|imagem da tela)/.test(norm)) {
    if (/\b(meta[s]?|estatic[oa][s]?|custo[s]? fixo[s]?|ganho[s]? fixo[s]?)/.test(norm)) {
      return { name: 'capture_annotated_screen', args: buildScreenshotArgsForTab('goals') };
    }
    if (/\b(configurac|feriado[s]?|estado[s]?|cidade[s]?|preferencia[s]?)/.test(norm)) {
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
    if (/\b(extrato[s]?|lancamento[s]?|filtro[s]?|transac)/.test(norm)) {
      return { name: 'capture_annotated_screen', args: buildScreenshotArgsForTab('transactions') };
    }
    if (/\b(previsao|previsoes|vou ganhar|provavel gasto)/.test(norm)) {
      return { name: 'capture_annotated_screen', args: buildScreenshotArgsForTab('forecast') };
    }
    if (/\b(conta[s]?|cartao|cartoes|fatura[s]?)/.test(norm)) {
      return { name: 'capture_annotated_screen', args: buildScreenshotArgsForTab('accounts') };
    }
    if (/\b(copiloto|diagnostico[s]?|conciliacao)/.test(norm)) {
      return { name: 'capture_annotated_screen', args: buildScreenshotArgsForTab('ai') };
    }
    if (/\b(visao geral|inicio|dashboard)/.test(norm)) {
      return { name: 'capture_annotated_screen', args: buildScreenshotArgsForTab('overview') };
    }
    return { name: 'capture_annotated_screen', args: buildScreenshotArgsForTab(uiState.activeTab) };
  }

  const isGuideQuestion =
    /\b(como\s+(faco|faz|fazer|configur[a-z]*|cadastr[a-z]*|cri[a-z]*|edit[a-z]*|alter[a-z]*|mud[a-z]*|adicion[a-z]*|exclu[a-z]*|remov[a-z]*|apag[a-z]*|pul[a-z]*|reativ[a-z]*|us[a-z]*|funciona[a-z]*|import[a-z]*|export[a-z]*|pag[a-z]*|ver|visualiz[a-z]*|ajust[a-z]*)|onde\s+(fica[a-z]*|esta[a-z]*|configur[a-z]*|alter[a-z]*|cadastr[a-z]*|vejo|encontr[a-z]*|acess[a-z]*|posso)|me\s+ensin[a-z]*|me\s+mostre\s+como|demonstr[a-z]*|passo\s+a\s+passo|tutorial)/.test(
      norm
    );

  if (isGuideQuestion) {
    if (/\b(feriado[s]?|estado[s]?|cidade[s]?|uf\b|dia util|dias uteis|configurac|ciclo mensal|tema|backup|snapshot|privacidad)/.test(norm)) {
      const settingsTopic = /\b(backup|snapshot)/.test(norm)
        ? 'Exportar e Restaurar Backup (Snapshot)'
        : /\b(tema|claro|escuro|aparencia)/.test(norm)
          ? 'Alterar Tema e Aparência'
          : /\bprivacidad/.test(norm)
            ? 'Configurar Modo Privacidade'
            : /\bciclo mensal/.test(norm)
              ? 'Configurar Ciclo Mensal e Preferências'
              : 'Configurar Estado, Cidade e Feriados';
      return {
        name: 'guide_feature_workflow',
        args: { tab: uiState.activeTab, topic: settingsTopic, highlightTargetId: 'header.btn.settings', openModalType: 'SETTINGS' },
      };
    }
    if (/\b(orcamento[s]?|limite[s]? de gasto|teto[s]? de gasto|teto mensal)/.test(norm)) {
      return { name: 'guide_feature_workflow', args: { tab: 'goals', topic: 'Configurar Limites de Gastos por Categoria', highlightTargetId: 'goals.section.budgets', openModalType: 'BUDGET' } };
    }
    if (/\bcategoria[s]?\b/.test(norm)) {
      return { name: 'guide_feature_workflow', args: { tab: 'goals', topic: 'Configurar Categorias de Gastos e Ganhos', highlightTargetId: 'goals.section.categories', openModalType: 'CATEGORY' } };
    }
    if (/\bmeta[s]? de saldo\b/.test(norm)) {
      return { name: 'guide_feature_workflow', args: { tab: 'forecast', topic: 'Definir Meta de Saldo por Data', highlightTargetId: 'forecast.btn.addTarget' } };
    }
    if (/\b(meta[s]?|patrimonio|carteira)/.test(norm)) {
      return { name: 'guide_feature_workflow', args: { tab: 'goals', topic: 'Cadastrar uma nova Meta de Carteira', highlightTargetId: 'goals.btn.create', openModalType: 'GOAL' } };
    }
    if (/\b(custo[s]? estatico|ganho[s]? estatico|estatico[s]?|fixo[s]?|fixa[s]?|recorrente[s]?|pular mes)/.test(norm)) {
      const staticTopic = /\bpular mes/.test(norm) ? 'Pular mês em Regras Fixas Mensais' : 'Gerenciar Custos e Ganhos Estáticos';
      return { name: 'guide_feature_workflow', args: { tab: 'goals', topic: staticTopic, highlightTargetId: 'goals.section.staticRules', openModalType: 'STATIC_RULE' } };
    }
    if (/\b(previsao|previsoes|vou ganhar|provavel gasto)/.test(norm)) {
      return { name: 'guide_feature_workflow', args: { tab: 'forecast', topic: 'Usar a aba Previsão de Valor', highlightTargetId: 'forecast.btn.addIncome' } };
    }
    if (/\b(cartao|cartoes|fatura[s]?)/.test(norm)) {
      return { name: 'guide_feature_workflow', args: { tab: 'accounts', topic: 'Cadastrar Cartão de Crédito', highlightTargetId: 'accounts.btn.createCard', openModalType: 'CARD' } };
    }
    if (/\b(conta[s]?|banco)\b/.test(norm)) {
      return { name: 'guide_feature_workflow', args: { tab: 'accounts', topic: 'Cadastrar Conta Bancária', highlightTargetId: 'accounts.btn.createAccount', openModalType: 'ACCOUNT' } };
    }
    if (/\b(lancamento[s]?|despesa[s]?|receita[s]?|extrato[s]?|filtro[s]?)/.test(norm)) {
      return { name: 'guide_feature_workflow', args: { tab: 'transactions', topic: 'Registrar ou Filtrar Lançamentos', highlightTargetId: 'header.btn.newTx', openModalType: 'TX' } };
    }
    if (/\b(provedor|openai|gemini|claude|api key|chave de api|modelo[s]? de ia)/.test(norm)) {
      return { name: 'guide_feature_workflow', args: { tab: 'ai', topic: 'Configurar Provedores e Chaves de API de IA', highlightTargetId: 'ai.panel.providers' } };
    }
    if (/\b(diagnostico[s]?|conciliacao|importar|copiloto)/.test(norm)) {
      return { name: 'guide_feature_workflow', args: { tab: 'ai', topic: 'Usar Copiloto IA, Conciliação e Diagnósticos', highlightTargetId: 'ai.panel.healthReports' } };
    }
  }

  // Somente CRIAÇÃO é determinística: editar exige saber QUAL meta, o que depende do modelo (que consulta as metas).
  if (
    /\b(cri|cadastr|defin|nova)[a-z]*\b.*\bmeta[s]?\b/.test(norm) &&
    !/\b(alter|mud|atualiz|edit|ajust)[a-z]*\b/.test(norm) &&
    !/\bmeta[s]? de saldo\b/.test(norm)
  ) {
    const amount = parseBrlAmount(message);
    if (amount) {
      return {
        name: 'upsert_portfolio_goal',
        args: {
          title: 'Nova Meta de Carteira',
          targetAmountBRL: amount,
          targetMonth: uiState.selectedMonth,
          targetYear: uiState.selectedYear,
        },
      };
    }
  }

  if (/\b(configur|defin|alter|mud)[a-z]*\b.*\b(estado|uf\b|cidade|ciclo mensal|tema)/.test(norm)) {
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

  if (/\b(filtr|busc|pesquis|mostr)[a-z]*\b.*\b(extrato|lancamento|despesa|receita|estatico)/.test(norm) && !/\bgrafico/.test(norm)) {
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

  if (
    /\b(va para|ir para|abra|abrir|navegue|levar para|mostre\s+(a\s+|minha\s+)?tela)\b/.test(norm) &&
    !/\b(grafic[oa]|pizza|rosca|donut|barra[s]?|linha[s]?|tabela|relatori[oa]|analis[a-z]*|compar[a-z]*)\b/.test(norm)
  ) {
    if (/\b(configurac|preferencia|feriado)/.test(norm)) return { name: 'open_settings', args: {} };
    if (/\b(meta|estatico)/.test(norm)) return { name: 'navigate_to_section', args: { tab: 'goals' } };
    if (/\b(previsao)/.test(norm)) return { name: 'navigate_to_section', args: { tab: 'forecast' } };
    if (/\b(conta|cartao|cartoes)/.test(norm)) return { name: 'navigate_to_section', args: { tab: 'accounts' } };
    if (/\b(extrato|lancamento)/.test(norm)) return { name: 'navigate_to_section', args: { tab: 'transactions' } };
    if (/\b(comparativo)/.test(norm)) return { name: 'navigate_to_section', args: { tab: 'comparison' } };
    if (/\b(copiloto|conciliacao|diagnostico)/.test(norm)) return { name: 'navigate_to_section', args: { tab: 'ai' } };
    if (/\b(visao geral|inicio|dashboard)/.test(norm)) return { name: 'navigate_to_section', args: { tab: 'overview' } };
  }

  return null;
}

export function detectDeterministicToolCalls(
  message: string,
  uiState: UiStateSnapshot
): ProviderToolCallResult[] {
  const primary = detectDeterministicToolCall(message, uiState);
  if (!primary) return [];
  const norm = normalizeText(message);
  // Suporte local a pedido composto: "mostre como configurar X e configure-a para mim"
  if (
    primary.name === 'guide_feature_workflow' &&
    /\b(e\s+(configure|crie|cadastre|altere|atualize|faca)|configure[- ]?[ao]?\s+para\s+mim)\b/.test(norm)
  ) {
    const amount = parseBrlAmount(message);
    if (primary.args.tab === 'goals' && amount) {
      return [
        primary,
        {
          name: 'upsert_portfolio_goal',
          args: {
            title: 'Nova Meta de Carteira',
            targetAmountBRL: amount,
            targetMonth: uiState.selectedMonth,
            targetYear: uiState.selectedYear,
          },
        },
      ];
    }
  }
  return [primary];
}

export function buildGuideSteps(args: {
  tab: ActiveTab;
  topic: string;
  highlightTargetId?: string;
  openModalType?: string;
}): AgentVisualStep[] {
  return buildRichGuidePlaybook(args);
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

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

export function parseBrlAmount(text: string): number | null {
  const toNum = (raw: string, mil?: string) => {
    const num = Number(raw.replace(/\./g, '').replace(',', '.')) * (mil ? 1000 : 1);
    return Number.isFinite(num) && num > 0 ? num : null;
  };
  // "R$" tem prioridade: evita confundir o ano ("para 2027") com o valor.
  const brl = text.match(/r\$\s*([\d.]+(?:,\d{1,2})?)(\s*mil\b)?/i);
  if (brl) return toNum(brl[1], brl[2]);
  const loose = text.match(/\b(para|de|valor)\s+([\d.]+(?:,\d{1,2})?)(\s*(?:mil|reais)\b)?/i);
  if (!loose) return null;
  // "para 2027" é um prazo (ano), não um valor.
  if (!loose[3] && loose[1].toLowerCase() === 'para' && /^20\d{2}$/.test(loose[2])) return null;
  return toNum(loose[2], loose[3]?.trim().toLowerCase() === 'mil' ? 'mil' : undefined);
}

const MONTHS_PT = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Extrai o nome da meta ("meta de viagem de R$ 5000" → "Viagem"). */
export function extractGoalTitle(message: string): string | null {
  const m = message.match(
    /\bmeta\s+(?:de\s+carteira\s+)?(?:de|para|chamada|do|da|"|“)?\s*["“']?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{1,40}?)["”']?\s*(?=(?:\b(?:de|no valor de|com|ate|até|para|em|no|valor)\b\s*)?(?:r\$|\d)|\b(?:ate|até)\b|$|[.,;!?])/i
  );
  const raw = m?.[1]?.trim();
  if (!raw || /^(r|de|para|do|da|no|com|valor|no valor|nova|uma)$/i.test(raw)) return null;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Prazo da meta: "até dezembro de 2027", "em 06/2027", "até 2028", "em 8 meses"; padrão = 12 meses à frente. */
export function extractGoalDeadline(message: string, refMonth: number, refYear: number): { month: number; year: number } {
  const norm = normalizeText(message);
  const named = norm.match(new RegExp(`\\b(${MONTHS_PT.join('|')})\\b(?:\\s+de)?\\s+(\\d{4})`));
  if (named) return { month: MONTHS_PT.indexOf(named[1]) + 1, year: Number(named[2]) };
  const numeric = norm.match(/\b(0?[1-9]|1[0-2])\/(\d{4})\b/);
  if (numeric) return { month: Number(numeric[1]), year: Number(numeric[2]) };
  const inMonths = norm.match(/\bem\s+(\d{1,3})\s+mes(?:es)?\b/);
  const inYears = norm.match(/\bem\s+(\d{1,2})\s+anos?\b/);
  const offset = inMonths ? Number(inMonths[1]) : inYears ? Number(inYears[1]) * 12 : null;
  if (offset) {
    const idx = refYear * 12 + (refMonth - 1) + offset;
    return { month: (idx % 12) + 1, year: Math.floor(idx / 12) };
  }
  const yearOnly = norm.match(/\b(?:ate|em|para)\s+(20\d{2})\b/);
  if (yearOnly) return { month: 12, year: Number(yearOnly[1]) };
  return { month: refMonth, year: refYear + 1 };
}

function buildLocalGoalArgs(message: string, uiState: UiStateSnapshot, amount: number) {
  const deadline = extractGoalDeadline(message, uiState.selectedMonth, uiState.selectedYear);
  return {
    title: extractGoalTitle(message) || 'Nova Meta de Carteira',
    targetAmountBRL: amount,
    targetMonth: deadline.month,
    targetYear: deadline.year,
  };
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
      return { name: 'upsert_portfolio_goal', args: buildLocalGoalArgs(message, uiState, amount) };
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
    if (/\btema\s+(?:para\s+(?:o\s+)?)?(?:modo\s+)?claro\b/.test(norm)) args.theme = 'LIGHT';
    if (/\btema\s+(?:para\s+(?:o\s+)?)?(?:modo\s+)?escuro\b/.test(norm)) args.theme = 'DARK';
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
        { name: 'upsert_portfolio_goal', args: buildLocalGoalArgs(message, uiState, amount) },
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

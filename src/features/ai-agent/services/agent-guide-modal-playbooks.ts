import type { ActiveTab } from '@/features/dashboard/types/workbench-types';
import type { AgentVisualStep } from '@/features/ai-agent/domain/agent-types';

export interface GuidePlaybookArgs {
  tab: ActiveTab;
  topic: string;
  highlightTargetId?: string;
  openModalType?: string;
}

export function buildSettingsPlaybook(topicNorm: string): AgentVisualStep[] {
  const openStep: AgentVisualStep = {
    id: 'cfg-open',
    action: 'OPEN_MODAL',
    modalType: 'SETTINGS',
    targetId: 'header.btn.settings',
    caption: 'Abrindo Configurações & Preferências',
    pauseMs: 320,
  };

  if (/(feriado|estado|cidade|uf\b|dia util|dias uteis|localiz)/.test(topicNorm)) {
    return [
      openStep,
      {
        id: 'cfg-hol-section',
        action: 'SCROLL_TO',
        targetId: 'modal.settings.section.holidays',
        fallbackTextMatch: 'Localização & Calendário de Feriados',
        caption: 'Rolando até Localização & Calendário de Feriados',
        tooltipTitle: 'Localização & Feriados',
        tooltipBody:
          'Aqui você define o Estado (UF) e a Cidade usados para calcular dias úteis automaticamente (como o 5º dia útil).',
        tooltipPlacement: 'top',
        tone: 'indigo',
        persistCoachmark: true,
        pauseMs: 1650,
      },
      {
        id: 'cfg-hol-state',
        action: 'HIGHLIGHT',
        targetId: 'modal.settings.select.state',
        fallbackTextMatch: 'Estado (UF)',
        caption: 'Destacando Estado (UF) e Cidade',
        tooltipTitle: 'Estado (UF) e Cidade',
        tooltipBody:
          'Selecione seu Estado para ativar feriados estaduais e informe a Cidade ao lado para feriados municipais.',
        tooltipPlacement: 'top',
        tone: 'indigo',
        persistCoachmark: true,
        pauseMs: 1650,
      },
      {
        id: 'cfg-hol-btn',
        action: 'HIGHLIGHT',
        targetId: 'modal.settings.btn.holidays',
        fallbackTextMatch: 'Calendário de Feriados',
        caption: 'Destacando o botão Calendário de Feriados',
        tooltipTitle: 'Gerenciar Calendário de Feriados',
        tooltipBody:
          'Clique neste botão para sincronizar feriados nacionais/estaduais ou cadastrar feriados manuais da sua cidade. Depois salve em "Salvar Preferências".',
        tooltipPlacement: 'top',
        tone: 'emerald',
        persistCoachmark: true,
        pauseMs: 1800,
      },
    ];
  }

  if (/(backup|snapshot|export|import)/.test(topicNorm)) {
    return [
      openStep,
      {
        id: 'cfg-backup',
        action: 'SCROLL_TO',
        targetId: 'modal.settings.section.backup',
        fallbackTextMatch: 'Backup Completo (Snapshot)',
        caption: 'Rolando até Exportação & Backup',
        tooltipTitle: 'Backup Completo (Snapshot)',
        tooltipBody:
          'Exporte toda a sua base em um arquivo JSON seguro ou restaure um snapshot anterior mantendo suas metas, regras e lançamentos.',
        tooltipPlacement: 'top',
        tone: 'indigo',
        persistCoachmark: true,
        pauseMs: 1800,
      },
    ];
  }

  if (/(tema|claro|escuro|aparencia|privacidad)/.test(topicNorm)) {
    const isPrivacy = /privacidad/.test(topicNorm);
    return [
      openStep,
      {
        id: 'cfg-theme',
        action: 'SCROLL_TO',
        targetId: isPrivacy ? 'modal.settings.section.privacy' : 'modal.settings.section.theme',
        fallbackTextMatch: isPrivacy ? 'Modo Privacidade' : 'Aparência da Interface',
        caption: isPrivacy ? 'Destacando Modo Privacidade' : 'Destacando Aparência da Interface',
        tooltipTitle: isPrivacy ? 'Modo Privacidade' : 'Aparência & Tema',
        tooltipBody: isPrivacy
          ? 'Ative para abrir o FinMind sempre com os valores monetários borrados por segurança.'
          : 'Alterne entre tema Claro e Escuro e salve em "Salvar Preferências" no rodapé do modal.',
        tooltipPlacement: 'bottom',
        tone: 'indigo',
        persistCoachmark: true,
        pauseMs: 1800,
      },
    ];
  }

  return [
    openStep,
    {
      id: 'cfg-prefs',
      action: 'SCROLL_TO',
      targetId: 'modal.settings.section.preferences',
      fallbackTextMatch: 'Preferências Operacionais',
      caption: 'Destacando Preferências Operacionais',
      tooltipTitle: 'Ciclo Mensal & Densidade',
      tooltipBody:
        'Defina o dia de início do seu ciclo financeiro mensal e a densidade da interface. Role para baixo para configurar Feriados e Backup.',
      tooltipPlacement: 'bottom',
      tone: 'indigo',
      persistCoachmark: true,
      pauseMs: 1800,
    },
  ];
}

export { buildGoalsTabPlaybook as buildGoalsAndStaticRulesPlaybook } from '@/features/ai-agent/services/agent-guide-goals-playbooks';

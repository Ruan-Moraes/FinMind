import type { ActiveTab } from '@/features/dashboard/types/workbench-types';
import {
  getToolRiskLevel,
  isBlockedRisk,
  requiresExplicitConfirmation,
} from '@/features/ai-agent/domain/agent-risk-policy';
import type {
  AgentInteractionMode,
  AgentKnowledgeCitation,
  AgentTurnPayload,
  AgentVisualStep,
} from '@/features/ai-agent/domain/agent-types';
import {
  createAgentAuditLog,
  generateIdempotencyKey,
} from '@/features/ai-agent/services/agent-audit-service';
import type { ProviderToolCallResult } from '@/features/ai-agent/services/agent-tool-provider-client';
import {
  buildGuideSteps,
  buildScreenshotDirective,
} from '@/features/ai-agent/services/agent-intent-router';
import {
  applyTxFiltersToolSchema,
  captureScreenToolSchema,
  changePeriodToolSchema,
  guideWorkflowToolSchema,
  navigateToolSchema,
} from '@/features/ai-agent/tools/tool-catalog';
import { getMutationToolExecutor } from '@/features/ai-agent/tools/tool-dispatcher';

export async function dispatchSelectedAgentTool(params: {
  userId: string;
  sessionId?: string | null;
  runId: string;
  selectedTool: ProviderToolCallResult;
  interactionMode: AgentInteractionMode;
  llmNarrative: string;
  executionMode: 'LIVE_AGENT_TOOLS' | 'DETERMINISTIC_AGENT_LOCAL';
  providerLabel: string;
  modelLabel: string;
  systemSources: AgentKnowledgeCitation[];
  topSectionPath?: string;
  apiWarning: string | null;
}): Promise<AgentTurnPayload> {
  const {
    userId, sessionId, runId, selectedTool, interactionMode, llmNarrative,
    executionMode, providerLabel, modelLabel, systemSources, topSectionPath, apiWarning,
  } = params;

  const base = {
    runId,
    providerUsed: providerLabel,
    modelUsed: modelLabel,
    executionMode,
    systemSources,
    apiWarning,
    answeredAt: new Date().toISOString(),
  };

  const risk = getToolRiskLevel(selectedTool.name);
  if (isBlockedRisk(risk)) {
    return {
      ...base,
      modality: 'INTERACTIVE_GUIDE',
      narrative: `A operação "${selectedTool.name}" está bloqueada pela política de segurança para execução autônoma.`,
      providerUsed: 'FINMIND_SECURITY_GUARD',
      visualSteps: [],
      dryRunGuide: true,
    };
  }

  if (selectedTool.name === 'navigate_to_section') {
    const parsed = navigateToolSchema.parse(selectedTool.args);
    const steps: AgentVisualStep[] = [
      { id: 'nav1', action: 'SWITCH_TAB', tab: parsed.tab as ActiveTab, targetId: `nav.tab.${parsed.tab}`, caption: 'Navegando para a aba solicitada' },
    ];
    if (parsed.targetId) {
      steps.push({ id: 'nav2', action: 'HIGHLIGHT', targetId: parsed.targetId, caption: 'Elemento localizado', pauseMs: 650 });
    }
    return {
      ...base,
      modality: 'AUTONOMOUS',
      narrative: llmNarrative || 'Pronto! Estou levando você diretamente para a tela solicitada.',
      visualSteps: steps,
      dryRunGuide: false,
    };
  }

  if (selectedTool.name === 'open_settings') {
    return {
      ...base,
      modality: 'AUTONOMOUS',
      narrative: llmNarrative || 'Abrindo **Configurações & Preferências** no cabeçalho para você.',
      visualSteps: [
        { id: 'cfg1', action: 'OPEN_MODAL', modalType: 'SETTINGS', targetId: 'header.btn.settings', caption: 'Abrindo Configurações & Preferências' },
      ],
      dryRunGuide: false,
    };
  }

  if (selectedTool.name === 'guide_feature_workflow') {
    const parsed = guideWorkflowToolSchema.parse(selectedTool.args);
    return {
      ...base,
      modality: 'INTERACTIVE_GUIDE',
      narrative:
        llmNarrative ||
        `Vou demonstrar na tela como **${parsed.topic}** sem salvar nenhuma alteração automática. Acompanhe o cursor e conclua quando desejar.${
          topSectionPath ? `\n\nReferência consultada: *${topSectionPath}*.` : ''
        }`,
      visualSteps: buildGuideSteps(parsed),
      dryRunGuide: true,
    };
  }

  if (selectedTool.name === 'capture_annotated_screen') {
    const parsed = captureScreenToolSchema.parse(selectedTool.args);
    return {
      ...base,
      modality: 'ANNOTATED_SCREENSHOT',
      narrative:
        llmNarrative ||
        `Estou capturando a interface real de **${parsed.title}** com marcações numeradas para orientar você passo a passo.`,
      visualSteps: [],
      dryRunGuide: true,
      screenshotDirective: buildScreenshotDirective(parsed),
    };
  }

  if (selectedTool.name === 'apply_transaction_filters') {
    const parsed = applyTxFiltersToolSchema.parse(selectedTool.args);
    const labels = [
      parsed.filterType && parsed.filterType !== 'ALL' ? `Tipo: ${parsed.filterType}` : null,
      parsed.filterNature && parsed.filterNature !== 'ALL' ? `Natureza: ${parsed.filterNature}` : null,
      parsed.searchQuery ? `Busca: "${parsed.searchQuery}"` : null,
    ].filter(Boolean);
    return {
      ...base,
      modality: 'AUTONOMOUS',
      narrative:
        llmNarrative ||
        `Aplicando os filtros no **Extrato & Comprovantes** (${labels.join(' • ') || 'Todos'}).`,
      visualSteps: [
        { id: 'f1', action: 'SWITCH_TAB', tab: 'transactions', targetId: 'nav.tab.transactions', caption: 'Abrindo Extrato & Comprovantes' },
        { id: 'f2', action: 'SET_TX_FILTERS', targetId: 'transactions.filter.search', modalPayload: parsed, caption: 'Aplicando filtros solicitados' },
        { id: 'f3', action: 'HIGHLIGHT', targetId: 'transactions.table', caption: 'Resultados filtrados no extrato', pauseMs: 450 },
      ],
      dryRunGuide: false,
    };
  }

  if (selectedTool.name === 'change_period') {
    const parsed = changePeriodToolSchema.parse(selectedTool.args);
    return {
      ...base,
      modality: 'AUTONOMOUS',
      narrative: llmNarrative || `Alterando o período exibido no dashboard para **${parsed.month}/${parsed.year}**.`,
      visualSteps: [
        { id: 'p1', action: 'SET_PERIOD', targetId: 'header.period.month', modalPayload: parsed, caption: `Trocando período para ${parsed.month}/${parsed.year}` },
      ],
      dryRunGuide: false,
    };
  }

  const executor = getMutationToolExecutor(selectedTool.name);
  if (executor && requiresExplicitConfirmation(risk)) {
    const preview = await executor.preparePreview(userId, selectedTool.args);
    if (interactionMode === 'GUIDED') {
      return {
        ...base,
        modality: 'INTERACTIVE_GUIDE',
        narrative: `No modo **Guiado**, vou apenas demonstrar o caminho visual para: **${preview.title}** (sem alterar dados no banco).`,
        visualSteps: preview.postConfirmVisualSteps.filter((s) => s.action !== 'CLOSE_MODAL'),
        dryRunGuide: true,
      };
    }

    const idempotencyKey = generateIdempotencyKey(runId, selectedTool.name);
    const auditLog = await createAgentAuditLog({
      userId,
      sessionId,
      runId,
      idempotencyKey,
      modality: 'AUTONOMOUS',
      toolName: selectedTool.name,
      riskLevel: risk,
      status: 'AWAITING_CONFIRMATION',
      rawParams: preview.normalizedParams,
      beforeState: preview.beforeState,
    });

    return {
      ...base,
      modality: 'AUTONOMOUS',
      narrative:
        llmNarrative ||
        `Preparei a operação **${preview.title}**. Revise o resumo abaixo e clique em **Confirmar e Executar** para eu operar a interface e verificar a gravação no banco.`,
      visualSteps: [],
      dryRunGuide: false,
      pendingMutation: {
        auditLogId: auditLog.id,
        runId,
        idempotencyKey,
        toolName: selectedTool.name,
        riskLevel: risk,
        title: preview.title,
        summary: preview.summary,
        beforePreview: preview.beforePreview,
        afterPreview: preview.afterPreview,
        params: preview.normalizedParams,
        postConfirmVisualSteps: preview.postConfirmVisualSteps,
        reversible: preview.reversible,
      },
    };
  }

  return {
    ...base,
    modality: 'ANALYTICAL',
    narrative: llmNarrative || 'Não identifiquei uma operação suportada para esse pedido.',
    visualSteps: [],
    dryRunGuide: false,
  };
}

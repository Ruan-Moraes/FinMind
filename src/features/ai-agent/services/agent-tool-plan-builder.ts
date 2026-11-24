import type { ActiveTab } from '@/features/dashboard/types/workbench-types';
import {
  getToolRiskLevel,
  isBlockedRisk,
  requiresExplicitConfirmation,
} from '@/features/ai-agent/domain/agent-risk-policy';
import type {
  AgentExecutionTrace,
  AgentInteractionMode,
  AgentKnowledgeCitation,
  AgentModality,
  AgentTurnPayload,
  AgentVisualStep,
  PendingAgentMutation,
  ScreenshotCaptureDirective,
} from '@/features/ai-agent/domain/agent-types';
import type { DynamicContentBlock } from '@/features/ai-agent/domain/dynamic-content-schemas';
import {
  buildPendingMutationFromPrepared,
  type PreparedMutationEntry,
} from '@/features/ai-agent/services/agent-batch-mutation-builder';
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

export interface ComposeAgentTurnParams {
  userId: string;
  sessionId?: string | null;
  runId: string;
  actionTools: ProviderToolCallResult[];
  contentBlocks: DynamicContentBlock[];
  interactionMode: AgentInteractionMode;
  llmNarrative: string;
  executionMode: 'LIVE_AGENT_TOOLS' | 'DETERMINISTIC_AGENT_LOCAL';
  providerLabel: string;
  modelLabel: string;
  systemSources: AgentKnowledgeCitation[];
  topSectionPath?: string;
  apiWarning: string | null;
  executionTrace?: AgentExecutionTrace;
}

export async function composeAgentTurnFromTools(
  params: ComposeAgentTurnParams
): Promise<AgentTurnPayload> {
  const {
    userId, sessionId, runId, actionTools, contentBlocks, interactionMode, llmNarrative,
    executionMode, providerLabel, modelLabel, systemSources, topSectionPath, apiWarning, executionTrace,
  } = params;

  const base = {
    runId,
    providerUsed: providerLabel,
    modelUsed: modelLabel,
    executionMode,
    systemSources,
    contentBlocks: contentBlocks.length > 0 ? contentBlocks : undefined,
    executionTrace,
    apiWarning,
    answeredAt: new Date().toISOString(),
  };

  const visualSteps: AgentVisualStep[] = [];
  const narratives: string[] = [];
  let dryRunGuide = false;
  const preparedMutations: PreparedMutationEntry[] = [];
  let pendingMutation: PendingAgentMutation | null = null;
  let screenshotDirective: ScreenshotCaptureDirective | null = null;
  let hasNavigationOrFilter = false;

  for (const selectedTool of actionTools) {
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
      const check = navigateToolSchema.safeParse(selectedTool.args);
      if (!check.success) continue;
      hasNavigationOrFilter = true;
      visualSteps.push({ id: `nav-${visualSteps.length + 1}`, action: 'SWITCH_TAB', tab: check.data.tab as ActiveTab, targetId: `nav.tab.${check.data.tab}`, caption: 'Navegando para a aba solicitada' });
      if (check.data.targetId) visualSteps.push({ id: `nav-hi-${visualSteps.length + 1}`, action: 'HIGHLIGHT', targetId: check.data.targetId, caption: 'Elemento localizado', pauseMs: 650 });
      narratives.push('Abrindo a tela solicitada para você.');
      continue;
    }

    if (selectedTool.name === 'open_settings') {
      hasNavigationOrFilter = true;
      visualSteps.push({ id: `cfg-${visualSteps.length + 1}`, action: 'OPEN_MODAL', modalType: 'SETTINGS', targetId: 'header.btn.settings', caption: 'Abrindo Configurações & Preferências' });
      narratives.push('Abrindo **Configurações & Preferências** no cabeçalho.');
      continue;
    }

    if (selectedTool.name === 'guide_feature_workflow') {
      const check = guideWorkflowToolSchema.safeParse(selectedTool.args);
      if (!check.success) continue;
      dryRunGuide = true;
      visualSteps.push(...buildGuideSteps(check.data));
      narratives.push(`Vou demonstrar na tela como **${check.data.topic}** passo a passo.${topSectionPath ? ` Referência: *${topSectionPath}*.` : ''}`);
      continue;
    }

    if (selectedTool.name === 'capture_annotated_screen') {
      const check = captureScreenToolSchema.safeParse(selectedTool.args);
      if (!check.success) continue;
      dryRunGuide = true;
      screenshotDirective = buildScreenshotDirective(check.data);
      narratives.push(`Capturando a interface real de **${check.data.title}** com marcações numeradas.`);
      continue;
    }

    if (selectedTool.name === 'apply_transaction_filters') {
      const check = applyTxFiltersToolSchema.safeParse(selectedTool.args);
      if (!check.success) continue;
      hasNavigationOrFilter = true;
      visualSteps.push(
        { id: `f-tab-${visualSteps.length + 1}`, action: 'SWITCH_TAB', tab: 'transactions', targetId: 'nav.tab.transactions', caption: 'Abrindo Extrato & Comprovantes' },
        { id: `f-set-${visualSteps.length + 2}`, action: 'SET_TX_FILTERS', targetId: 'transactions.filter.search', modalPayload: check.data, caption: 'Aplicando filtros solicitados' },
        { id: `f-hi-${visualSteps.length + 3}`, action: 'HIGHLIGHT', targetId: 'transactions.table', caption: 'Resultados filtrados no extrato', pauseMs: 450 }
      );
      narratives.push('Aplicando os filtros solicitados no **Extrato & Comprovantes**.');
      continue;
    }

    if (selectedTool.name === 'change_period') {
      const check = changePeriodToolSchema.safeParse(selectedTool.args);
      if (!check.success) continue;
      hasNavigationOrFilter = true;
      visualSteps.push({ id: `p-${visualSteps.length + 1}`, action: 'SET_PERIOD', targetId: 'header.period.month', modalPayload: check.data, caption: `Trocando período para ${check.data.month}/${check.data.year}` });
      narratives.push(`Alterando o período exibido para **${check.data.month}/${check.data.year}**.`);
      continue;
    }

    const executor = getMutationToolExecutor(selectedTool.name);
    if (executor && requiresExplicitConfirmation(risk)) {
      try {
        const preview = await executor.preparePreview(userId, selectedTool.args);
        preparedMutations.push({ toolName: selectedTool.name, risk, preview });
      } catch (err) {
        const reason = err instanceof Error ? err.message : null;
        narratives.push(
          reason ||
            `Faltaram parâmetros válidos para preparar "${selectedTool.name}". Informe os dados completos para eu preparar a operação.`
        );
      }
    }
  }

  if (preparedMutations.length > 0) {
    const built = await buildPendingMutationFromPrepared({
      userId,
      sessionId,
      runId,
      modality: visualSteps.length > 0 || contentBlocks.length > 0 ? 'HYBRID' : 'AUTONOMOUS',
      prepared: preparedMutations,
    });
    pendingMutation = built.pendingMutation;
    narratives.push(built.narrative);
    if (interactionMode === 'GUIDED' && visualSteps.length === 0) {
      visualSteps.push(
        ...pendingMutation.postConfirmVisualSteps
          .filter((s) => s.action !== 'CLOSE_MODAL')
          .map((s) => ({ ...s, persistCoachmark: Boolean(s.tooltipBody) }))
      );
      dryRunGuide = true;
    }
  }

  const modalitiesUsed = [
    contentBlocks.length > 0 ? 'ANALYTICAL' : null,
    screenshotDirective ? 'ANNOTATED_SCREENSHOT' : null,
    pendingMutation || hasNavigationOrFilter ? 'AUTONOMOUS' : null,
    dryRunGuide && !screenshotDirective ? 'INTERACTIVE_GUIDE' : null,
  ].filter(Boolean) as AgentModality[];

  const uniqueModalities = Array.from(new Set(modalitiesUsed));
  const modality: AgentModality =
    uniqueModalities.length > 1
      ? 'HYBRID'
      : uniqueModalities[0] || 'ANALYTICAL';

  return {
    ...base,
    modality,
    narrative:
      llmNarrative.trim() ||
      narratives.join('\n\n') ||
      'Pronto! Confira os detalhes abaixo.',
    visualSteps,
    dryRunGuide: dryRunGuide && !pendingMutation,
    pendingMutation,
    screenshotDirective,
  };
}

export async function dispatchSelectedAgentTool(
  params: Omit<ComposeAgentTurnParams, 'actionTools' | 'contentBlocks'> & {
    selectedTool: ProviderToolCallResult;
  }
): Promise<AgentTurnPayload> {
  return composeAgentTurnFromTools({ ...params, actionTools: [params.selectedTool], contentBlocks: [] });
}

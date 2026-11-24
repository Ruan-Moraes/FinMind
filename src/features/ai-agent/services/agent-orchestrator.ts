import { prisma } from '@/shared/lib/prisma';
import { getAiModelDescriptor } from '@/features/ai-copilot/models';
import { resolveActiveUserAiSelection } from '@/features/ai-copilot/services/ai-credentials-service';
import { detectBlockedSecurityIntent } from '@/features/ai-agent/domain/agent-risk-policy';
import type {
  AgentInteractionMode,
  AgentTurnPayload,
  UiStateSnapshot,
} from '@/features/ai-agent/domain/agent-types';
import { retrieveSystemKnowledge } from '@/features/ai-agent/knowledge/system-kb-retriever';
import {
  createAgentAuditLog,
  generateIdempotencyKey,
  generateRunId,
} from '@/features/ai-agent/services/agent-audit-service';
import type { AgentConversationMessage } from '@/features/ai-agent/services/agent-tool-provider-client';
import { detectDeterministicToolCalls } from '@/features/ai-agent/services/agent-intent-router';
import {
  buildNonFinancialFallbackReply,
  detectConversationalReply,
  isFinancialAnalyticsQuery,
} from '@/features/ai-agent/services/agent-conversational-classifier';
import { composeAgentTurnFromTools } from '@/features/ai-agent/services/agent-tool-plan-builder';
import { runLocalGroundedAnalyticsFallback } from '@/features/ai-agent/services/agent-local-fallback-planner';
import {
  buildAgentSystemPrompt,
  runLiveAgentToolLoop,
} from '@/features/ai-agent/services/agent-react-loop';
import { loadAnalyticsExecutionContext } from '@/features/ai-agent/tools/tool-executors-analytics';

async function loadRecentSessionHistory(
  sessionId: string | null | undefined,
  userId: string
): Promise<AgentConversationMessage[]> {
  if (!sessionId) return [];
  const owned = await prisma.aiChatSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });
  if (!owned) return [];
  const rows = await prisma.aiChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { role: true, content: true },
  });
  return rows.reverse().map((r) => ({
    role: r.role === 'user' ? 'user' : 'assistant',
    content: r.content.slice(0, 700),
  }));
}

export async function runAgentPlanningTurn(params: {
  userId: string;
  sessionId?: string | null;
  message: string;
  uiState: UiStateSnapshot;
  interactionMode: AgentInteractionMode;
}): Promise<AgentTurnPayload> {
  const { userId, sessionId, message, uiState, interactionMode } = params;
  const runId = generateRunId();
  const cleanMsg = message.trim();

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { settings: true } });
  if (!user) throw new Error('Usuário autenticado não encontrado.');

  // 1. Guarda de Segurança (ações bloqueadas como Reset Geral / credenciais)
  const blockedCheck = detectBlockedSecurityIntent(cleanMsg);
  if (blockedCheck.blocked) {
    await createAgentAuditLog({
      userId, sessionId, runId,
      idempotencyKey: generateIdempotencyKey(runId, 'blocked_security_intent'),
      modality: 'INTERACTIVE_GUIDE', toolName: 'reset_all_data', riskLevel: 'BLOCKED',
      status: 'CANCELLED', rawParams: { message: cleanMsg }, errorMessage: blockedCheck.reason,
    });
    return {
      runId, modality: 'INTERACTIVE_GUIDE', narrative: blockedCheck.reason!,
      providerUsed: 'FINMIND_SECURITY_GUARD', modelUsed: 'Política de Segurança do Agente',
      executionMode: 'DETERMINISTIC_AGENT_LOCAL', systemSources: [],
      visualSteps: [
        { id: 'sec1', action: 'OPEN_MODAL', modalType: 'SETTINGS', targetId: 'header.btn.settings', caption: 'Abrindo Configurações (orientação segura)' },
        {
          id: 'sec2', action: 'SCROLL_TO', targetId: 'modal.settings.dangerZone',
          caption: 'Zona de Perigo: exige confirmação manual',
          tooltipTitle: 'Ação Bloqueada por Segurança',
          tooltipBody: 'Operações destrutivas exigem confirmação manual com seu nome completo.',
          tone: 'amber', persistCoachmark: true, pauseMs: 750,
        },
      ],
      dryRunGuide: true, answeredAt: new Date().toISOString(),
    };
  }

  const [systemKb, historyMessages, analyticsCtx, activeAi] = await Promise.all([
    retrieveSystemKnowledge({ query: cleanMsg, activeTab: uiState.activeTab, topK: 5 }),
    loadRecentSessionHistory(sessionId, userId),
    loadAnalyticsExecutionContext(userId, uiState.selectedMonth, uiState.selectedYear),
    resolveActiveUserAiSelection(userId),
  ]);
  const systemSources = systemKb.chunks.map((c) => ({
    docId: c.docId, module: c.module, sectionPath: c.sectionPath, score: c.score,
  }));

  const descriptor = activeAi.modelId
    ? getAiModelDescriptor(activeAi.modelId, activeAi.provider)
    : null;

  let apiWarning: string | null = null;

  // 2. Loop Agêntico Multi-Etapas com o Modelo Real Selecionado pelo Usuário
  if (activeAi.hasKey && descriptor) {
    try {
      const kbBlock = systemKb.chunks.map((c) => c.contentText).join('\n\n');
      const systemInstruction = buildAgentSystemPrompt({ uiState, interactionMode, kbBlock });
      const loopResult = await runLiveAgentToolLoop({
        provider: activeAi.provider, apiKey: activeAi.apiKey, modelId: descriptor.id,
        systemInstruction, historyMessages, cleanMsg, analyticsCtx,
      });

      return composeAgentTurnFromTools({
        userId, sessionId, runId,
        actionTools: loopResult.actionTools,
        contentBlocks: loopResult.contentBlocks,
        interactionMode,
        llmNarrative: loopResult.finalNarrative,
        executionMode: 'LIVE_AGENT_TOOLS',
        providerLabel: descriptor.providerGroupLabel,
        modelLabel: descriptor.displayName,
        systemSources: loopResult.actionTools.length > 0 ? systemSources : [],
        topSectionPath: systemKb.chunks[0]?.sectionPath,
        apiWarning: null,
        executionTrace: loopResult.executionTrace,
      });
    } catch (err) {
      apiWarning =
        err instanceof Error
          ? `Provedor ${descriptor.displayName} indisponível (${err.message}); operando com motor determinístico local sobre seus dados reais.`
          : 'Provedor externo indisponível; operando em modo local.';
    }
  } else if (activeAi.hasKey && !descriptor) {
    apiWarning =
      'Provedor conectado, mas nenhum modelo foi selecionado. Escolha um modelo no seletor do Header ou na aba Copiloto IA.';
  }

  // 3. Contingência Local Honesta (quando não há chave de API configurada ou houve falha de rede)
  const conversationalReply = detectConversationalReply(cleanMsg);
  if (conversationalReply) {
    return {
      runId, modality: 'ANALYTICAL', narrative: conversationalReply,
      providerUsed: 'FINMIND_AGENT_LOCAL', modelUsed: 'Assistente Local',
      executionMode: 'DETERMINISTIC_AGENT_LOCAL', systemSources: [], visualSteps: [],
      dryRunGuide: false, apiWarning, answeredAt: new Date().toISOString(),
    };
  }

  const deterministicTools = detectDeterministicToolCalls(cleanMsg, uiState);
  if (deterministicTools.length > 0) {
    return composeAgentTurnFromTools({
      userId, sessionId, runId, actionTools: deterministicTools, contentBlocks: [],
      interactionMode, llmNarrative: '', executionMode: 'DETERMINISTIC_AGENT_LOCAL',
      providerLabel: 'FINMIND_AGENT_LOCAL', modelLabel: 'Motor Determinístico Local',
      systemSources, topSectionPath: systemKb.chunks[0]?.sectionPath, apiWarning,
      executionTrace: {
        iterations: 1,
        retriedForAlignment: false,
        steps: deterministicTools.map((t) => ({ toolName: t.name, phase: 'UI_ACTION', status: 'OK', durationMs: 0 })),
      },
    });
  }

  if (isFinancialAnalyticsQuery(cleanMsg)) {
    const localAnalytics = await runLocalGroundedAnalyticsFallback(cleanMsg, analyticsCtx);
    return {
      runId, modality: 'ANALYTICAL', narrative: localAnalytics.narrative,
      providerUsed: 'FINMIND_AGENT_LOCAL', modelUsed: 'Motor Analítico Local (Dados Reais)',
      executionMode: 'DETERMINISTIC_AGENT_LOCAL', systemSources: [], visualSteps: [],
      dryRunGuide: false, contentBlocks: localAnalytics.contentBlocks, apiWarning,
      executionTrace: {
        iterations: 1, retriedForAlignment: false,
        steps: localAnalytics.readToolsExecuted.map((t) => ({ toolName: t, phase: 'READ_DATA', status: 'OK', durationMs: 0 })),
      },
      answeredAt: new Date().toISOString(),
    };
  }

  return {
    runId, modality: 'ANALYTICAL', narrative: buildNonFinancialFallbackReply(systemKb.chunks),
    providerUsed: 'FINMIND_AGENT_LOCAL', modelUsed: 'Assistente Local + RAG Sistema',
    executionMode: 'DETERMINISTIC_AGENT_LOCAL', systemSources: systemSources.filter((s) => s.score >= 0.42),
    visualSteps: [], dryRunGuide: false, apiWarning, answeredAt: new Date().toISOString(),
  };
}

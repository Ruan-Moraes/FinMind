import { prisma } from '@/shared/lib/prisma';
import { executeContextualFinancialAssistant } from '@/features/ai-copilot/assistant';
import { getAiModelDescriptor, resolveDynamicModelRoute } from '@/features/ai-copilot/models';
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
import {
  callAgentProviderWithTools,
  type ProviderToolCallResult,
} from '@/features/ai-agent/services/agent-tool-provider-client';
import { detectDeterministicToolCall } from '@/features/ai-agent/services/agent-intent-router';
import { dispatchSelectedAgentTool } from '@/features/ai-agent/services/agent-tool-plan-builder';
import { AGENT_TOOL_DECLARATIONS } from '@/features/ai-agent/tools/tool-catalog';

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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { settings: true },
  });
  if (!user) throw new Error('Usuário autenticado não encontrado.');

  // 1. Guarda de Segurança (ações bloqueadas como Reset Geral / credenciais)
  const blockedCheck = detectBlockedSecurityIntent(cleanMsg);
  if (blockedCheck.blocked) {
    await createAgentAuditLog({
      userId,
      sessionId,
      runId,
      idempotencyKey: generateIdempotencyKey(runId, 'blocked_security_intent'),
      modality: 'INTERACTIVE_GUIDE',
      toolName: 'reset_all_data',
      riskLevel: 'BLOCKED',
      status: 'CANCELLED',
      rawParams: { message: cleanMsg },
      errorMessage: blockedCheck.reason,
    });
    return {
      runId,
      modality: 'INTERACTIVE_GUIDE',
      narrative: blockedCheck.reason!,
      providerUsed: 'FINMIND_SECURITY_GUARD',
      modelUsed: 'Política de Segurança do Agente',
      executionMode: 'DETERMINISTIC_AGENT_LOCAL',
      systemSources: [],
      visualSteps: [
        { id: 'sec1', action: 'OPEN_MODAL', modalType: 'SETTINGS', targetId: 'header.btn.settings', caption: 'Abrindo Configurações (orientação segura)' },
        { id: 'sec2', action: 'HIGHLIGHT', targetId: 'modal.settings.dangerZone', caption: 'Zona de Perigo: exige sua confirmação manual', pauseMs: 750 },
      ],
      dryRunGuide: true,
      answeredAt: new Date().toISOString(),
    };
  }

  // 2. RAG Documental do Sistema (Base de conhecimento versionada)
  const systemKb = await retrieveSystemKnowledge({
    query: cleanMsg,
    activeTab: uiState.activeTab,
    topK: 5,
    userKeys: {
      openaiApiKey: user.settings?.openaiApiKey,
      geminiApiKey: user.settings?.geminiApiKey,
    },
  });

  const systemSources = systemKb.chunks.map((c) => ({
    docId: c.docId,
    module: c.module,
    sectionPath: c.sectionPath,
    score: c.score,
  }));

  // 3. Seleção de ferramenta (Live Multi-Provedor Tool Calling + fallback determinístico)
  const provider = (user.settings?.aiProvider || 'OPENAI') as 'OPENAI' | 'GEMINI' | 'CLAUDE';
  const modelId =
    provider === 'OPENAI'
      ? user.settings?.openaiModel || 'gpt-4o-mini'
      : provider === 'GEMINI'
      ? user.settings?.geminiModel || 'gemini-2.0-flash'
      : user.settings?.claudeModel || 'claude-3-5-sonnet-latest';
  const descriptor = getAiModelDescriptor(modelId);
  const route = resolveDynamicModelRoute(descriptor.id, {
    openaiApiKey: user.settings?.openaiApiKey,
    geminiApiKey: user.settings?.geminiApiKey,
    claudeApiKey: user.settings?.claudeApiKey,
  });

  let selectedTool: ProviderToolCallResult | null = null;
  let llmNarrative = '';
  let executionMode: 'LIVE_AGENT_TOOLS' | 'DETERMINISTIC_AGENT_LOCAL' = 'DETERMINISTIC_AGENT_LOCAL';
  let apiWarning: string | null = null;

  const deterministicTool = detectDeterministicToolCall(cleanMsg, uiState);

  if (route.hasExternalApiKey) {
    try {
      const kbBlock = systemKb.chunks.map((c) => c.contentText).join('\n\n');
      const systemInstruction = [
        'Você é o Agente Autônomo do FinMind. Decida se deve chamar uma ferramenta ou responder analiticamente.',
        'Regras: 1) Use SOMENTE as ferramentas declaradas. 2) Nunca afirme que uma alteração foi salva antes da confirmação. 3) Para "como fazer" ou "onde fica", use guide_feature_workflow. 4) Para print/captura, use capture_annotated_screen. 5) Para perguntas analíticas puras de saldo/gastos/gráficos, não chame ferramenta.',
        `Estado atual da UI: aba=${uiState.activeTab}, período=${uiState.selectedMonth}/${uiState.selectedYear}, modal=${uiState.activeModalType || 'nenhum'}, modo=${interactionMode}.`,
        `<untrusted_system_kb>\n${kbBlock}\n</untrusted_system_kb>`,
      ].join('\n');

      const liveRes = await callAgentProviderWithTools({
        provider,
        apiKey: route.effectiveApiKey,
        modelId: descriptor.id,
        systemInstruction,
        userPrompt: cleanMsg,
        tools: AGENT_TOOL_DECLARATIONS,
      });
      if (liveRes.toolCalls.length > 0) {
        selectedTool = liveRes.toolCalls[0];
        llmNarrative = liveRes.text;
        executionMode = 'LIVE_AGENT_TOOLS';
      }
    } catch (err) {
      apiWarning =
        err instanceof Error
          ? `Planejamento externo indisponível (${err.message}); operando com motor determinístico local.`
          : null;
    }
  }

  if (!selectedTool && deterministicTool) {
    selectedTool = deterministicTool;
  }

  // 4. Fluxo Analítico Completo (RAG Financeiro + Gráficos Reais)
  if (!selectedTool) {
    const analytical = await executeContextualFinancialAssistant({
      userId,
      question: cleanMsg,
      referenceMonth: uiState.selectedMonth,
      referenceYear: uiState.selectedYear,
    });
    return {
      runId,
      modality: 'ANALYTICAL',
      narrative: analytical.directAnswer,
      providerUsed: analytical.providerUsed,
      modelUsed: analytical.modelUsed,
      executionMode:
        analytical.executionMode === 'LIVE_LLM_RAG'
          ? 'LIVE_AGENT_TOOLS'
          : 'DETERMINISTIC_AGENT_LOCAL',
      systemSources,
      visualSteps: [],
      dryRunGuide: false,
      charts: analytical.charts,
      historicalFacts: analytical.historicalFacts,
      calculatedResults: analytical.calculatedResults,
      projectionsAndEstimates: analytical.projectionsAndEstimates,
      personalizedRecommendations: analytical.personalizedRecommendations,
      apiWarning: apiWarning || analytical.apiWarning || null,
      answeredAt: analytical.answeredAt,
    };
  }

  // 5. Despacho da ferramenta selecionada (L0/L1 imediato ou L2/L3 com confirmação)
  return dispatchSelectedAgentTool({
    userId,
    sessionId,
    runId,
    selectedTool,
    interactionMode,
    llmNarrative,
    executionMode,
    providerLabel:
      executionMode === 'LIVE_AGENT_TOOLS' ? descriptor.providerGroupLabel : 'FINMIND_AGENT_LOCAL',
    modelLabel:
      executionMode === 'LIVE_AGENT_TOOLS' ? descriptor.displayName : 'Agente Local + RAG Sistema',
    systemSources,
    topSectionPath: systemKb.chunks[0]?.sectionPath,
    apiWarning,
  });
}

import type { AiProviderId } from '@/features/ai-copilot/models';
import type {
  AgentExecutionTrace,
  AgentInteractionMode,
  AgentTraceStep,
  UiStateSnapshot,
} from '@/features/ai-agent/domain/agent-types';
import {
  renderVisualContentToolSchema,
  type DynamicContentBlock,
} from '@/features/ai-agent/domain/dynamic-content-schemas';
import {
  callAgentProviderWithTools,
  type AgentConversationMessage,
  type ProviderToolCallResult,
} from '@/features/ai-agent/services/agent-tool-provider-client';
import { validateAgentTurnOutcome } from '@/features/ai-agent/services/agent-result-validator';
import { AGENT_TOOL_DECLARATIONS } from '@/features/ai-agent/tools/tool-catalog';
import { READ_ANALYTICS_TOOL_NAMES } from '@/features/ai-agent/tools/tool-catalog-analytics';
import {
  executeReadAnalyticsTool,
  type AnalyticsExecutionContext,
} from '@/features/ai-agent/tools/tool-executors-analytics';

const MAX_LOOP_ITERATIONS = 4;

export function buildAgentSystemPrompt(params: {
  uiState: UiStateSnapshot;
  interactionMode: AgentInteractionMode;
  kbBlock: string;
}): string {
  const { uiState, interactionMode, kbBlock } = params;
  return [
    'Você é o Agente Financeiro Autônomo do FinMind. Sua regra principal: o sucesso de um turno é atender à INTENÇÃO REAL do usuário, nunca apenas chamar uma ferramenta qualquer.',
    'DISTINÇÃO OBRIGATÓRIA ENTRE CONTEXTO E AÇÃO:',
    '- Mencionar "metas", "despesas", "extrato" ou "configurações" é CONTEXTO de domínio, NÃO um pedido de navegação.',
    '- Use `navigate_to_section` SOMENTE quando o usuário pedir explicitamente para ir/abrir/ver a tela em si (ex.: "Mostre minha tela de metas").',
    '- Para gráficos (pizza/rosca/barras/linhas/área), tabelas comparativas, análises, comparações ou relatórios: SEMPRE chame primeiro as ferramentas reais de consulta (`query_portfolio_goals`, `query_financial_overview`, `query_expenses_and_transactions`, `compare_financial_periods`, `query_forecasts_and_simulations`, `generate_financial_report`) e depois chame `render_visual_content` com os valores EXATOS retornados (em centavos onde solicitado).',
    '- NUNCA invente números. Se não houver dados cadastrados, informe claramente ao usuário sem inventar gráficos.',
    '- Para "ensinar/como fazer/como configuro", use `guide_feature_workflow` passando o `openModalType` e `highlightTargetId` EXATOS do recurso pedido: CATEGORY (categorias de gastos/ganhos), BUDGET (limites/orçamentos por categoria), GOAL (metas de carteira), STATIC_RULE (custos/ganhos estáticos), TX (lançamento), ACCOUNT (conta), CARD (cartão), SETTINGS (configurações/feriados/tema/backup). NUNCA abra modal de Meta (GOAL) quando o usuário pedir Categorias, Orçamentos ou Regras Fixas. Se o usuário pedir para ensinar E também configurar/criar, chame AMBAS as ferramentas (`guide_feature_workflow` + a ferramenta de mutação correspondente).',
    '- Para foto/print/captura da tela, use `capture_annotated_screen`.',
    '- Operações de escrita/exclusão (L2/L3) nunca são salvas automaticamente: prepare o plano via ferramenta e aguarde confirmação explícita. Nunca afirme que já foi salvo.',
    '- Se o pedido exceder as ferramentas reais disponíveis, explique a limitação com clareza em vez de executar uma ação não relacionada.',
    '- Para saudações, conversas gerais ou pedidos simples sem dados financeiros, responda naturalmente de forma breve sem gráficos.',
    `Estado atual da UI: aba=${uiState.activeTab}, período=${uiState.selectedMonth}/${uiState.selectedYear}, modal=${uiState.activeModalType || 'nenhum'}, modo=${interactionMode}.`,
    `<untrusted_system_kb>\n${kbBlock}\n</untrusted_system_kb>`,
  ].join('\n');
}

export interface LiveLoopResult {
  actionTools: ProviderToolCallResult[];
  contentBlocks: DynamicContentBlock[];
  finalNarrative: string;
  executionTrace: AgentExecutionTrace;
}

export async function runLiveAgentToolLoop(params: {
  provider: AiProviderId;
  apiKey: string;
  modelId: string;
  systemInstruction: string;
  historyMessages: AgentConversationMessage[];
  cleanMsg: string;
  analyticsCtx: AnalyticsExecutionContext;
}): Promise<LiveLoopResult> {
  const { provider, apiKey, modelId, systemInstruction, historyMessages, cleanMsg, analyticsCtx } = params;
  const loopMessages: AgentConversationMessage[] = [
    ...historyMessages,
    { role: 'user', content: cleanMsg },
  ];

  const traceSteps: AgentTraceStep[] = [];
  const readToolsExecuted: string[] = [];
  let actionTools: ProviderToolCallResult[] = [];
  let contentBlocks: DynamicContentBlock[] = [];
  let finalNarrative = '';
  let iterations = 0;
  let retriedForAlignment = false;

  for (let step = 0; step < MAX_LOOP_ITERATIONS; step += 1) {
    iterations += 1;
    const liveRes = await callAgentProviderWithTools({
      provider, apiKey, modelId, systemInstruction,
      messages: loopMessages, tools: AGENT_TOOL_DECLARATIONS,
    });
    if (liveRes.text) finalNarrative = liveRes.text;

    if (liveRes.toolCalls.length === 0) {
      const check = validateAgentTurnOutcome({
        userMessage: cleanMsg, readToolsExecuted,
        actionToolsCalled: actionTools.map((t) => t.name),
        contentBlocks, visualSteps: [], narrative: finalNarrative,
      });
      if (!check.aligned && !retriedForAlignment && check.correctionPrompt) {
        retriedForAlignment = true;
        traceSteps.push({ toolName: 'intent_validator', phase: 'VALIDATION', status: 'RETRY', durationMs: 0, note: check.reason });
        loopMessages.push({ role: 'assistant', content: liveRes.text || '(sem conteúdo)' });
        loopMessages.push({ role: 'user', content: check.correctionPrompt });
        continue;
      }
      break;
    }

    loopMessages.push({ role: 'assistant', content: liveRes.text, toolCalls: liveRes.toolCalls });
    const readCalls = liveRes.toolCalls.filter((tc) => READ_ANALYTICS_TOOL_NAMES.has(tc.name));
    const renderCalls = liveRes.toolCalls.filter((tc) => tc.name === 'render_visual_content');
    const otherActionCalls = liveRes.toolCalls.filter(
      (tc) => !READ_ANALYTICS_TOOL_NAMES.has(tc.name) && tc.name !== 'render_visual_content'
    );

    if (readCalls.length > 0) {
      const results = await Promise.all(
        readCalls.map(async (tc) => {
          const t0 = Date.now();
          try {
            const data = await executeReadAnalyticsTool(tc.name, tc.args, analyticsCtx);
            readToolsExecuted.push(tc.name);
            traceSteps.push({ toolName: tc.name, phase: 'READ_DATA', status: 'OK', durationMs: Date.now() - t0 });
            return { tc, content: JSON.stringify(data) };
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro ao consultar dados.';
            traceSteps.push({ toolName: tc.name, phase: 'READ_DATA', status: 'ERROR', durationMs: Date.now() - t0, note: msg });
            return { tc, content: JSON.stringify({ error: msg }) };
          }
        })
      );
      for (const r of results) {
        loopMessages.push({ role: 'tool', toolCallId: r.tc.id || r.tc.name, toolName: r.tc.name, content: r.content });
      }
    }

    for (const rc of renderCalls) {
      const parsed = renderVisualContentToolSchema.safeParse(rc.args);
      if (parsed.success) {
        contentBlocks = [...contentBlocks, ...parsed.data.blocks].slice(0, 6);
        traceSteps.push({ toolName: 'render_visual_content', phase: 'RENDER_UI', status: 'OK', durationMs: 0, note: `${parsed.data.blocks.length} bloco(s)` });
        loopMessages.push({
          role: 'tool', toolCallId: rc.id || rc.name, toolName: rc.name,
          content: JSON.stringify({ rendered: true, blocksCount: parsed.data.blocks.length }),
        });
      } else {
        traceSteps.push({ toolName: 'render_visual_content', phase: 'RENDER_UI', status: 'ERROR', durationMs: 0, note: 'Schema inválido' });
        loopMessages.push({
          role: 'tool', toolCallId: rc.id || rc.name, toolName: rc.name,
          content: JSON.stringify({ error: 'Formato inválido nos blocos. Verifique id, kind, title e campos numéricos.' }),
        });
      }
    }

    if (otherActionCalls.length > 0) {
      actionTools = [...actionTools, ...otherActionCalls];
      for (const ac of otherActionCalls) {
        traceSteps.push({ toolName: ac.name, phase: 'UI_ACTION', status: 'OK', durationMs: 0 });
        loopMessages.push({
          role: 'tool', toolCallId: ac.id || ac.name, toolName: ac.name,
          content: JSON.stringify({ queued: true, tool: ac.name }),
        });
      }
    }

    const check = validateAgentTurnOutcome({
      userMessage: cleanMsg, readToolsExecuted,
      actionToolsCalled: actionTools.map((t) => t.name),
      contentBlocks, visualSteps: [], narrative: finalNarrative,
    });

    if (!check.aligned && !retriedForAlignment && check.correctionPrompt) {
      retriedForAlignment = true;
      if (actionTools.every((t) => t.name === 'navigate_to_section' || t.name === 'open_settings')) {
        actionTools = [];
      }
      traceSteps.push({ toolName: 'intent_validator', phase: 'VALIDATION', status: 'RETRY', durationMs: 0, note: check.reason });
      loopMessages.push({ role: 'user', content: check.correctionPrompt });
      continue;
    }

    if (readCalls.length > 0 && renderCalls.length === 0 && otherActionCalls.length === 0) continue;
    if (renderCalls.length > 0 && !finalNarrative && step < MAX_LOOP_ITERATIONS - 1) continue;
    break;
  }

  return {
    actionTools,
    contentBlocks,
    finalNarrative,
    executionTrace: { iterations, retriedForAlignment, steps: traceSteps },
  };
}

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
import { getMutationToolExecutor } from '@/features/ai-agent/tools/tool-dispatcher';
import { TOOL_RISK_POLICY } from '@/features/ai-agent/domain/agent-risk-policy';

const UI_ACTION_TOOL_NAMES = new Set([
  'navigate_to_section', 'open_settings', 'guide_feature_workflow', 'capture_annotated_screen',
  'apply_transaction_filters', 'change_period',
]);

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
    '- CADASTRO DE CATEGORIAS E CLASSIFICAÇÃO: Você TEM as ferramentas `upsert_category` (para criar/editar categorias de gasto `EXPENSE` ou ganho `INCOME`) e `categorize_transactions` (para aplicar categorias em lançamentos do extrato). Use-as sempre que o usuário pedir para cadastrar categorias ou classificar lançamentos.',
    '- EXECUÇÃO EM LOTE (OBRIGATÓRIO PARA MÚLTIPLOS ITENS): Quando o usuário pedir para criar, alterar ou classificar VÁRIOS itens de uma vez (ex.: múltiplas categorias, várias regras fixas, metas ou classificações), emita TODAS as chamadas de ferramenta correspondentes no MESMO turno de uma só vez. O sistema agrupa automaticamente tudo em um único cartão de confirmação em lote. NUNCA execute um item por vez obrigando o usuário a digitar "Continue".',
    '- CONSULTAS ADICIONAIS: `query_budgets` (orçamentos e consumo), `query_static_rules` (regras fixas, cartão vinculado e situação no mês), `query_credit_card_invoices` (faturas), `query_categories` (categorias) e `query_health_reports` (diagnósticos salvos). Use-as antes de responder sobre esses temas ou antes de alterá-los.',
    '- EDITAR/EXCLUIR: para alterar ou excluir lançamentos, regras, metas, previsões, metas de saldo, categorias, contas ou cartões, use o nome/descrição REAIS (consulte antes se não tiver certeza) e NUNCA invente IDs. Na EDIÇÃO, envie apenas os campos que o usuário pediu para mudar: os omitidos são mantidos automaticamente.',
    '- RESULTADO DAS MUTAÇÕES: cada ferramenta de escrita devolve `prepared: true` (plano pronto, aguardando o clique do usuário em Confirmar) ou `error` (recusada, nada foi preparado). Se vier `error`, explique o motivo ao usuário e liste as opções que a mensagem trouxer; nunca diga que preparou ou salvou algo que foi recusado.',
    '- CUSTO FIXO NO CARTÃO: `upsert_static_rule` aceita `cardName` (custo cobrado no cartão de crédito) e `removeCard` para desvincular.',
    '- CLASSIFICAÇÃO: `categorize_transactions` memoriza o padrão para as próximas importações de extrato (`rememberForFuture`, padrão true); se o usuário pedir só uma correção pontual, envie `rememberForFuture: false`.',
    '- DIAGNÓSTICOS: `query_health_reports` lê os diagnósticos de saúde financeira já salvos; para análise nova no chat use `generate_financial_report`.',
    '- CRIAR LANÇAMENTO: informe `accountName`/`cardName`/`categoryName` somente se o usuário os mencionou; não presuma conta ou categoria. Transferência exige `accountName` e `destinationAccountName`; cartão aceita `installments` (1-48).',
    '- LIMITES: você NÃO importa/concilia extratos, não sincroniza feriados, não faz backup/restauração, não arquiva nem exclui contas/cartões, não edita parcelas individuais de compra parcelada, não anexa comprovantes e não gera (salva) novos diagnósticos no painel. Nesses casos diga que não consegue e use `guide_feature_workflow` para mostrar onde o usuário faz.',
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
  /** Recusas de preparo que o modelo ainda não comentou (devem ser exibidas ao usuário). */
  unrelayedErrors: string[];
  executionTrace: AgentExecutionTrace;
}

export async function runLiveAgentToolLoop(params: {
  userId: string;
  provider: AiProviderId;
  apiKey: string;
  modelId: string;
  systemInstruction: string;
  historyMessages: AgentConversationMessage[];
  cleanMsg: string;
  analyticsCtx: AnalyticsExecutionContext;
}): Promise<LiveLoopResult> {
  const { userId, provider, apiKey, modelId, systemInstruction, historyMessages, cleanMsg, analyticsCtx } = params;
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
  let unrelayedErrors: string[] = [];
  const outcomeFlags = () => ({
    guideRequested: actionTools.some((t) => t.name === 'guide_feature_workflow'),
    mutationPrepared: actionTools.some((t) => Boolean(getMutationToolExecutor(t.name))),
  });

  for (let step = 0; step < MAX_LOOP_ITERATIONS; step += 1) {
    iterations += 1;
    const liveRes = await callAgentProviderWithTools({
      provider, apiKey, modelId, systemInstruction,
      messages: loopMessages, tools: AGENT_TOOL_DECLARATIONS,
    });
    if (liveRes.text) {
      finalNarrative = liveRes.text;
      // O modelo respondeu depois de ver as recusas: ele mesmo já as comunicou.
      unrelayedErrors = [];
    }

    if (liveRes.toolCalls.length === 0) {
      const check = validateAgentTurnOutcome({
        userMessage: cleanMsg, readToolsExecuted,
        actionToolsCalled: actionTools.map((t) => t.name),
        contentBlocks, visualSteps: [], narrative: finalNarrative, ...outcomeFlags(),
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

    // Mutações são pré-validadas aqui (sem gravar nada) para o modelo ver recusas reais
    // (nome inexistente/ambíguo, duplicidade, campos faltando) e poder repassá-las ao usuário.
    const preparationErrors: string[] = [];
    for (const ac of otherActionCalls) {
      const t0 = Date.now();
      const executor = getMutationToolExecutor(ac.name);
      const isUiTool = UI_ACTION_TOOL_NAMES.has(ac.name);
      if (!executor && !isUiTool) {
        const msg = TOOL_RISK_POLICY[ac.name] === 'BLOCKED'
          ? `A operação "${ac.name}" é bloqueada pela política de segurança e não pode ser executada pelo agente.`
          : `A ferramenta "${ac.name}" não existe. Use apenas as ferramentas declaradas.`;
        traceSteps.push({ toolName: ac.name, phase: 'UI_ACTION', status: 'ERROR', durationMs: 0, note: msg });
        loopMessages.push({ role: 'tool', toolCallId: ac.id || ac.name, toolName: ac.name, content: JSON.stringify({ error: msg }) });
        if (TOOL_RISK_POLICY[ac.name] === 'BLOCKED') actionTools = [...actionTools, ac];
        continue;
      }
      if (executor) {
        try {
          const preview = await executor.preparePreview(userId, ac.args);
          actionTools = [...actionTools, ac];
          traceSteps.push({ toolName: ac.name, phase: 'UI_ACTION', status: 'OK', durationMs: Date.now() - t0, note: 'Plano preparado' });
          loopMessages.push({
            role: 'tool', toolCallId: ac.id || ac.name, toolName: ac.name,
            content: JSON.stringify({
              prepared: true, savedYet: false, title: preview.title, summary: preview.summary,
              note: 'NADA foi salvo. O usuário verá um cartão de confirmação; diga que aguarda a confirmação dele.',
            }),
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : `Parâmetros inválidos para "${ac.name}".`;
          preparationErrors.push(msg);
          traceSteps.push({ toolName: ac.name, phase: 'UI_ACTION', status: 'ERROR', durationMs: Date.now() - t0, note: msg });
          loopMessages.push({
            role: 'tool', toolCallId: ac.id || ac.name, toolName: ac.name,
            content: JSON.stringify({ error: msg, savedYet: false, note: 'Operação recusada e não preparada. Explique o motivo ao usuário e, se houver opções, liste-as.' }),
          });
        }
        continue;
      }
      actionTools = [...actionTools, ac];
      traceSteps.push({ toolName: ac.name, phase: 'UI_ACTION', status: 'OK', durationMs: 0 });
      loopMessages.push({
        role: 'tool', toolCallId: ac.id || ac.name, toolName: ac.name,
        content: JSON.stringify({ queued: true, tool: ac.name }),
      });
    }
    if (preparationErrors.length > 0) unrelayedErrors = [...unrelayedErrors, ...preparationErrors];

    const check = validateAgentTurnOutcome({
      userMessage: cleanMsg, readToolsExecuted,
      actionToolsCalled: actionTools.map((t) => t.name),
      contentBlocks, visualSteps: [], narrative: finalNarrative, ...outcomeFlags(),
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
    // Houve recusa: dá ao modelo uma chance de explicar/corrigir antes de encerrar o turno.
    if (preparationErrors.length > 0 && step < MAX_LOOP_ITERATIONS - 1) continue;
    if (renderCalls.length > 0 && !finalNarrative && step < MAX_LOOP_ITERATIONS - 1) continue;
    break;
  }

  return {
    actionTools,
    contentBlocks,
    finalNarrative,
    unrelayedErrors,
    executionTrace: { iterations, retriedForAlignment, steps: traceSteps },
  };
}

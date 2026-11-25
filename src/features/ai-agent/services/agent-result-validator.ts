import type { DynamicContentBlock } from '@/features/ai-agent/domain/dynamic-content-schemas';
import type { AgentVisualStep, PendingAgentMutation } from '@/features/ai-agent/domain/agent-types';

export interface IntentValidationInput {
  userMessage: string;
  readToolsExecuted: string[];
  actionToolsCalled: string[];
  contentBlocks: DynamicContentBlock[];
  visualSteps: AgentVisualStep[];
  pendingMutation?: PendingAgentMutation | null;
  narrative: string;
  /** O modelo chamou guide_feature_workflow neste turno (os passos visuais só são montados depois do loop). */
  guideRequested?: boolean;
  /** Alguma mutação foi preparada com sucesso (o cartão de confirmação só é criado depois do loop). */
  mutationPrepared?: boolean;
}

export interface IntentValidationResult {
  aligned: boolean;
  reason?: string;
  correctionPrompt?: string;
}

function norm(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function validateAgentTurnOutcome(input: IntentValidationInput): IntentValidationResult {
  const q = norm(input.userMessage);
  const onlyNavigated =
    input.actionToolsCalled.length > 0 &&
    input.actionToolsCalled.every((t) => t === 'navigate_to_section' || t === 'open_settings') &&
    input.readToolsExecuted.length === 0 &&
    input.contentBlocks.length === 0 &&
    !input.pendingMutation &&
    !input.mutationPrepared;

  const asksForChartOrTable =
    /\b(grafic[oa][s]?|pizza|rosca|donut|em barras?|em linhas?|linha do tempo|tabela[s]?|chart|diagrama)\b/.test(q);
  const asksForReportOrAnalysis =
    /\b(analis[a-z]*|compar[a-z]*|relatori[oa][s]?|diagnostic[oa][s]?|evoluc[a-z]*|proje[ct][a-z]*|simula[a-z]*|balanco|resumo financeiro)\b/.test(
      q
    );
  const asksForPieSpecifically = /\b(pizza|setor[es]*|pie)\b/.test(q);
  const asksToTeach =
    /\b(ensine|ensina|como\s+(faco|faz|fazer|configur[a-z]*|cadastr[a-z]*|cri[a-z]*)|passo\s+a\s+passo|tutorial)\b/.test(
      q
    );
  const asksToConfigureAlso =
    /\b(configure[- ]?[ao]?|crie|cadastre|altere|atualize|faca\s+para\s+mim|aplique)\b/.test(q);

  // 1. Erro clássico: usuário pediu gráfico/tabela/relatório/análise mas o agente só navegou
  if ((asksForChartOrTable || asksForReportOrAnalysis) && onlyNavigated) {
    return {
      aligned: false,
      reason: 'Apenas navegação executada para uma solicitação analítica/visual.',
      correctionPrompt:
        'CORREÇÃO OBRIGATÓRIA: O usuário NÃO pediu apenas para navegar até uma tela. Ele pediu um gráfico, tabela, relatório ou análise baseada em dados reais. NÃO use navigate_to_section como substituto. Chame agora as ferramentas query_* / compare_* / generate_financial_report para obter os dados reais e em seguida chame render_visual_content com o tipo visual solicitado (ex.: kind="pie" se pediu gráfico de pizza).',
    };
  }

  // 2. Pediu gráfico/tabela explicitamente e não gerou nenhum bloco visual (nem explicou falta de dados)
  if (asksForChartOrTable && input.contentBlocks.length === 0) {
    const explainsEmptyData = /(nao ha|nenhum[a]?|sem dados|vazi[oa]|nao encontrei|nao possui)/.test(
      norm(input.narrative)
    );
    if (!explainsEmptyData) {
      return {
        aligned: false,
        reason: 'Solicitação de gráfico/tabela sem componente visual renderizado.',
        correctionPrompt:
          'CORREÇÃO OBRIGATÓRIA: O usuário pediu um gráfico ou tabela visual. Consulte os dados reais (se ainda não consultou) e chame render_visual_content para renderizar o gráfico solicitado diretamente na conversa (use kind="pie" para pizza, "bar" para barras, "line" para linhas ou "table" para tabela). Se não houver registros cadastrados, informe claramente que não há dados suficientes.',
      };
    }
  }

  // 3. Pediu especificamente gráfico de pizza, mas renderizou apenas outro formato sem explicar
  if (
    asksForPieSpecifically &&
    input.contentBlocks.length > 0 &&
    !input.contentBlocks.some((b) => b.kind === 'pie' || b.kind === 'donut')
  ) {
    return {
      aligned: false,
      reason: 'Solicitado gráfico de pizza, mas nenhum bloco pie/donut foi gerado.',
      correctionPrompt:
        'CORREÇÃO OBRIGATÓRIA: O usuário pediu especificamente um gráfico de PIZZA. Chame render_visual_content incluindo um bloco com kind="pie" utilizando os dados reais já consultados.',
    };
  }

  // 4. Ancoragem de dados: blocos visuais gerados sem nenhuma ferramenta real de leitura executada
  if (input.contentBlocks.length > 0 && input.readToolsExecuted.length === 0) {
    return {
      aligned: false,
      reason: 'Conteúdo visual gerado sem consulta prévia aos dados reais do banco.',
      correctionPrompt:
        'CORREÇÃO OBRIGATÓRIA: Nunca gere gráficos, KPIs ou tabelas sem consultar primeiro os dados reais via query_financial_overview, query_portfolio_goals, query_expenses_and_transactions ou compare_financial_periods. Consulte os dados reais agora e então renderize o conteúdo.',
    };
  }

  // 5. Pedido composto: pediu para ensinar E também configurar/criar
  const guided = input.visualSteps.length > 0 || Boolean(input.guideRequested);
  if (asksToTeach && asksToConfigureAlso && guided && !input.pendingMutation && !input.mutationPrepared) {
    const asksClarification = /\?/.test(input.narrative);
    if (!asksClarification) {
      return {
        aligned: false,
        reason: 'Solicitação composta (ensinar + configurar) atendeu apenas a parte de ensino.',
        correctionPrompt:
          'CORREÇÃO: O usuário pediu para mostrar como configurar E também executar a configuração. Se já tiver os parâmetros necessários, chame também a ferramenta de mutação correspondente (ex.: upsert_portfolio_goal, update_user_preferences) para preparar o cartão de confirmação; caso faltem parâmetros (como valor ou título), peça apenas os dados que faltam.',
      };
    }
  }

  return { aligned: true };
}

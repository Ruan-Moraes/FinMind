import type {
  AgentModality,
  AgentRiskLevel,
  PendingAgentMutation,
  PendingBatchItemPreview,
} from '@/features/ai-agent/domain/agent-types';
import {
  createAgentAuditLog,
  generateIdempotencyKey,
} from '@/features/ai-agent/services/agent-audit-service';
import type { PreparedMutationPreview } from '@/features/ai-agent/tools/tool-executor-types';
import type { BatchMutationItemParam } from '@/features/ai-agent/tools/tool-executors-batch';

const TOOL_ACTION_LABELS: Record<string, string> = {
  upsert_category: 'Categoria',
  categorize_transactions: 'Classificação',
  upsert_static_rule: 'Regra Fixa',
  upsert_portfolio_goal: 'Meta de Carteira',
  delete_portfolio_goal: 'Excluir Meta',
  create_transaction: 'Lançamento',
  upsert_value_forecast: 'Previsão de Valor',
  update_user_preferences: 'Preferências',
  update_transaction: 'Editar Lançamento',
  delete_transaction: 'Excluir Lançamento',
  delete_static_rule: 'Excluir Regra Fixa',
  set_static_rule_month: 'Regra Fixa no Mês',
  upsert_budget: 'Limite de Gasto',
  delete_budget: 'Excluir Limite',
  delete_value_forecast: 'Excluir Previsão',
  upsert_balance_target: 'Meta de Saldo',
  upsert_account: 'Conta',
  upsert_credit_card: 'Cartão',
  pay_credit_card_invoice: 'Pagar Fatura',
  delete_balance_target: 'Excluir Meta de Saldo',
  delete_category: 'Excluir Categoria',
};

export interface PreparedMutationEntry {
  toolName: string;
  risk: AgentRiskLevel;
  preview: PreparedMutationPreview;
}

export async function buildPendingMutationFromPrepared(params: {
  userId: string;
  sessionId?: string | null;
  runId: string;
  modality: AgentModality;
  prepared: PreparedMutationEntry[];
}): Promise<{ pendingMutation: PendingAgentMutation; narrative: string }> {
  const { userId, sessionId, runId, modality, prepared } = params;

  if (prepared.length === 1) {
    const [{ toolName, risk, preview }] = prepared;
    const idempotencyKey = generateIdempotencyKey(runId, toolName);
    const auditLog = await createAgentAuditLog({
      userId,
      sessionId,
      runId,
      idempotencyKey,
      modality,
      toolName,
      riskLevel: risk,
      status: 'AWAITING_CONFIRMATION',
      rawParams: preview.normalizedParams,
      beforeState: preview.beforeState,
    });

    return {
      pendingMutation: {
        auditLogId: auditLog.id,
        runId,
        idempotencyKey,
        toolName,
        riskLevel: risk,
        title: preview.title,
        summary: preview.summary,
        beforePreview: preview.beforePreview,
        afterPreview: preview.afterPreview,
        params: preview.normalizedParams,
        postConfirmVisualSteps: preview.postConfirmVisualSteps,
        reversible: preview.reversible,
      },
      narrative: `Preparei **${preview.title}**. Revise o resumo abaixo e clique em **Confirmar e Executar** para aplicar e verificar a gravação no banco.`,
    };
  }

  const batchRisk: AgentRiskLevel = prepared.some((p) => p.risk === 'L3') ? 'L3' : 'L2';
  const items: BatchMutationItemParam[] = prepared.map((p) => ({
    toolName: p.toolName,
    title: p.preview.title,
    summary: p.preview.summary,
    params: p.preview.normalizedParams,
    beforeState: p.preview.beforeState,
  }));

  const idempotencyKey = generateIdempotencyKey(runId, `batch_mutations_${items.length}`);
  const auditLog = await createAgentAuditLog({
    userId,
    sessionId,
    runId,
    idempotencyKey,
    modality,
    toolName: 'batch_mutations',
    riskLevel: batchRisk,
    status: 'AWAITING_CONFIRMATION',
    rawParams: { items },
    beforeState: { count: items.length },
  });

  const shownAfter = items.slice(0, 12).map((item, idx) => ({
    label: `${idx + 1}. ${item.title}`,
    value: item.summary,
  }));
  if (items.length > 12) {
    shownAfter.push({
      label: `Mais ${items.length - 12} item(ns)`,
      value: 'Todos serão executados e verificados no mesmo lote.',
    });
  }

  const batchItems: PendingBatchItemPreview[] = prepared.map((p) => ({
    toolName: p.toolName,
    actionLabel: TOOL_ACTION_LABELS[p.toolName] || 'Ação',
    title: p.preview.title,
    summary: p.preview.summary,
    beforePreview: p.preview.beforePreview,
    afterPreview: p.preview.afterPreview,
  }));

  const firstVisualSteps = prepared[0]?.preview.postConfirmVisualSteps || [];

  return {
    pendingMutation: {
      auditLogId: auditLog.id,
      runId,
      idempotencyKey,
      toolName: 'batch_mutations',
      riskLevel: batchRisk,
      title: `Plano em Lote (${items.length} ações)`,
      summary: `Executar ${items.length} alterações em sequência e verificar cada gravação no banco.`,
      beforePreview: [{ label: 'Operações agrupadas', value: `${items.length} itens prontos para confirmação única` }],
      afterPreview: shownAfter,
      batchItems,
      params: { items },
      postConfirmVisualSteps: firstVisualSteps,
      reversible: prepared.every((p) => p.preview.reversible),
    },
    narrative: `Preparei um **Plano em Lote com ${items.length} ações** agrupadas abaixo. Revise cada etapa e clique em **Confirmar e Executar** para aplicar todas de uma vez com verificação no banco.`,
  };
}

import type {
  AgentModality,
  AgentRiskLevel,
  PendingAgentMutation,
} from '@/features/ai-agent/domain/agent-types';
import {
  createAgentAuditLog,
  generateIdempotencyKey,
} from '@/features/ai-agent/services/agent-audit-service';
import type { PreparedMutationPreview } from '@/features/ai-agent/tools/tool-executor-types';
import type { BatchMutationItemParam } from '@/features/ai-agent/tools/tool-executors-batch';

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
      params: { items },
      postConfirmVisualSteps: firstVisualSteps,
      reversible: prepared.every((p) => p.preview.reversible),
    },
    narrative: `Preparei um **Plano em Lote com ${items.length} ações** agrupadas abaixo. Revise os itens e clique em **Confirmar e Executar** para aplicar todos de uma vez com verificação no banco.`,
  };
}

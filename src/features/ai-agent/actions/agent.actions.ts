'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/lib/prisma';
import { requireAuthenticatedUser } from '@/features/auth';
import type {
  AgentInteractionMode,
  AgentTurnPayload,
  UiStateSnapshot,
} from '@/features/ai-agent/domain/agent-types';
import { runAgentPlanningTurn } from '@/features/ai-agent/services/agent-orchestrator';
import {
  getUserAuditLog,
  listRecentAgentAuditLogs,
  updateAuditLogStatus,
} from '@/features/ai-agent/services/agent-audit-service';
import { getMutationToolExecutor } from '@/features/ai-agent/tools/tool-dispatcher';
import { syncUserFinancialKnowledge } from '@/features/ai-copilot/rag';

function buildSessionTitle(message: string): string {
  const clean = message.trim().replace(/\s+/g, ' ');
  return clean.length > 56 ? `${clean.slice(0, 56)}…` : clean || 'Nova conversa';
}

function safeJsonParse(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function planAgentTurnAction(params: {
  sessionId?: string | null;
  message: string;
  uiState: UiStateSnapshot;
  interactionMode: AgentInteractionMode;
}): Promise<{ ok: true; sessionId: string; payload: AgentTurnPayload } | { ok: false; error: string }> {
  const user = await requireAuthenticatedUser();
  const cleanMsg = params.message.trim();
  if (!cleanMsg) return { ok: false, error: 'Digite uma solicitação para o agente.' };

  try {
    let sessionId = params.sessionId || null;
    if (sessionId) {
      const owned = await prisma.aiChatSession.findFirst({
        where: { id: sessionId, userId: user.id },
        select: { id: true },
      });
      if (!owned) sessionId = null;
    }

    if (!sessionId) {
      const created = await prisma.aiChatSession.create({
        data: { userId: user.id, title: buildSessionTitle(cleanMsg) },
      });
      sessionId = created.id;
    }

    const payload = await runAgentPlanningTurn({
      userId: user.id,
      sessionId,
      message: cleanMsg,
      uiState: params.uiState,
      interactionMode: params.interactionMode,
    });

    await prisma.$transaction([
      prisma.aiChatMessage.create({
        data: { sessionId, role: 'user', content: cleanMsg },
      }),
      prisma.aiChatMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: payload.narrative,
          responseJson: JSON.stringify({ kind: 'AGENT_TURN', payload }),
        },
      }),
      prisma.aiChatSession.updateMany({
        where: { id: sessionId, userId: user.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    return { ok: true, sessionId, payload };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Falha ao planejar a ação do agente.',
    };
  }
}

export async function confirmAndExecuteAgentAction(auditLogId: string): Promise<
  | { ok: true; verified: boolean; summary: string; reversible: boolean }
  | { ok: false; error: string }
> {
  try {
    const user = await requireAuthenticatedUser();
    const log = await getUserAuditLog(user.id, auditLogId);
    if (!log) return { ok: false, error: 'Registro de operação não encontrado para o usuário.' };

    const executor = getMutationToolExecutor(log.toolName);

    // Idempotência: se já foi concluído, não duplica
    if (log.status === 'SUCCEEDED') {
      return {
        ok: true,
        verified: true,
        summary: 'Esta operação já foi executada e verificada anteriormente (proteção contra duplicidade).',
        reversible: Boolean(executor?.rollback),
      };
    }

    if (!executor) {
      return { ok: false, error: `Executor não encontrado para a ferramenta "${log.toolName}".` };
    }

    // Lock atômico contra cliques concorrentes (TOCTOU)
    const claimed = await prisma.agentActionAuditLog.updateMany({
      where: { id: log.id, userId: user.id, status: 'AWAITING_CONFIRMATION' },
      data: { status: 'EXECUTING' },
    });
    if (claimed.count !== 1) {
      return {
        ok: false,
        error: `Operação em estado "${log.status}" não pode ser confirmada novamente.`,
      };
    }

    const startedAt = Date.now();
    try {
      const parsedParams = (safeJsonParse(log.paramsJson) ?? {}) as Record<string, unknown>;
      const result = await executor.executeAndVerify(user.id, parsedParams);
      const durationMs = Date.now() - startedAt;

      if (!result.ok || !result.verified) {
        await updateAuditLogStatus(user.id, log.id, {
          status: 'FAILED',
          errorMessage: result.error || result.summary,
          verificationResult: result.verificationDetail ?? { verified: false },
          durationMs,
        });
        return { ok: false, error: result.error || result.summary };
      }

      await updateAuditLogStatus(user.id, log.id, {
        status: 'SUCCEEDED',
        afterState: result.afterState ?? null,
        verificationResult: result.verificationDetail ?? { verified: true },
        durationMs,
      });

      // Executores gravam direto no banco: reindexa o RAG aqui para a busca semântica não ficar defasada.
      await syncUserFinancialKnowledge(user.id).catch(() => undefined);
      revalidatePath('/');
      return {
        ok: true,
        verified: true,
        summary: result.summary,
        reversible: Boolean(executor.rollback),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao executar operação confirmada.';
      await updateAuditLogStatus(user.id, log.id, {
        status: 'FAILED',
        errorMessage: message,
        durationMs: Date.now() - startedAt,
      });
      return { ok: false, error: message };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro ao confirmar operação do agente.',
    };
  }
}

export async function cancelAgentPlanAction(auditLogId: string): Promise<{ ok: boolean }> {
  try {
    const user = await requireAuthenticatedUser();
    await prisma.agentActionAuditLog.updateMany({
      where: { id: auditLogId, userId: user.id, status: 'AWAITING_CONFIRMATION' },
      data: { status: 'CANCELLED' },
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function rollbackAgentExecutionAction(
  auditLogId: string
): Promise<{ ok: boolean; summary: string }> {
  try {
    const user = await requireAuthenticatedUser();
    const log = await getUserAuditLog(user.id, auditLogId);
    if (!log || log.status !== 'SUCCEEDED') {
      return { ok: false, summary: 'Apenas operações concluídas podem ser desfeitas.' };
    }

    const executor = getMutationToolExecutor(log.toolName);
    if (!executor?.rollback) {
      return { ok: false, summary: 'Esta operação não suporta reversão automática.' };
    }

    const beforeState = safeJsonParse(log.beforeStateJson);
    const afterState = safeJsonParse(log.afterStateJson);
    const res = await executor.rollback(user.id, beforeState, afterState);

    if (res.ok) {
      await prisma.agentActionAuditLog.updateMany({
        where: { id: log.id, userId: user.id, status: 'SUCCEEDED' },
        data: { status: 'ROLLED_BACK' },
      });
      await syncUserFinancialKnowledge(user.id).catch(() => undefined);
      revalidatePath('/');
    }
    return res;
  } catch (err) {
    return {
      ok: false,
      summary: err instanceof Error ? err.message : 'Falha ao desfazer a operação.',
    };
  }
}

export async function listAgentAuditLogsAction() {
  try {
    const user = await requireAuthenticatedUser();
    const logs = await listRecentAgentAuditLogs(user.id, 20);
    return {
      ok: true as const,
      logs: logs.map((l) => ({
        id: l.id,
        runId: l.runId,
        modality: l.modality,
        toolName: l.toolName,
        riskLevel: l.riskLevel,
        status: l.status,
        errorMessage: l.errorMessage,
        durationMs: l.durationMs,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  } catch {
    return { ok: false as const, logs: [] };
  }
}

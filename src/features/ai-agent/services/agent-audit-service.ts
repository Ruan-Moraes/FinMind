import crypto from 'node:crypto';
import { prisma } from '@/shared/lib/prisma';
import { redactSensitiveParams } from '@/features/ai-agent/domain/agent-risk-policy';
import type { AgentModality, AgentRiskLevel } from '@/features/ai-agent/domain/agent-types';

export function generateRunId(): string {
  return `run_${crypto.randomBytes(6).toString('hex')}`;
}

export function generateIdempotencyKey(runId: string, toolName: string): string {
  return `${runId}:${toolName}:${crypto.randomBytes(4).toString('hex')}`;
}

function assertAuditDelegateAvailable() {
  const delegates = prisma as unknown as Record<string, unknown>;
  if (!delegates.agentActionAuditLog) {
    throw new Error(
      'O servidor de desenvolvimento (pnpm dev) precisa ser reiniciado após a atualização do schema do banco de dados.'
    );
  }
}

export async function createAgentAuditLog(params: {
  userId: string;
  sessionId?: string | null;
  runId: string;
  idempotencyKey: string;
  modality: AgentModality;
  toolName: string;
  riskLevel: AgentRiskLevel;
  status:
    | 'PLANNED'
    | 'AWAITING_CONFIRMATION'
    | 'EXECUTING'
    | 'SUCCEEDED'
    | 'FAILED'
    | 'CANCELLED'
    | 'ROLLED_BACK';
  rawParams: Record<string, unknown>;
  beforeState?: unknown;
  afterState?: unknown;
  verificationResult?: unknown;
  errorMessage?: string | null;
  durationMs?: number | null;
}) {
  assertAuditDelegateAvailable();
  const safeParams = redactSensitiveParams(params.rawParams);
  return prisma.agentActionAuditLog.create({
    data: {
      userId: params.userId,
      sessionId: params.sessionId || null,
      runId: params.runId,
      idempotencyKey: params.idempotencyKey,
      modality: params.modality,
      toolName: params.toolName,
      riskLevel: params.riskLevel,
      status: params.status,
      paramsJson: JSON.stringify(safeParams),
      beforeStateJson:
        params.beforeState !== undefined ? JSON.stringify(params.beforeState) : null,
      afterStateJson: params.afterState !== undefined ? JSON.stringify(params.afterState) : null,
      verificationResultJson:
        params.verificationResult !== undefined ? JSON.stringify(params.verificationResult) : null,
      errorMessage: params.errorMessage ?? null,
      durationMs: params.durationMs ?? null,
    },
  });
}

export async function getUserAuditLog(userId: string, auditLogId: string) {
  return prisma.agentActionAuditLog.findFirst({
    where: { id: auditLogId, userId },
  });
}

export async function updateAuditLogStatus(
  userId: string,
  auditLogId: string,
  patch: {
    status:
      | 'EXECUTING'
      | 'SUCCEEDED'
      | 'FAILED'
      | 'CANCELLED'
      | 'ROLLED_BACK';
    afterState?: unknown;
    verificationResult?: unknown;
    errorMessage?: string | null;
    durationMs?: number | null;
  }
) {
  const existing = await prisma.agentActionAuditLog.findFirst({
    where: { id: auditLogId, userId },
  });
  if (!existing) return null;

  return prisma.agentActionAuditLog.update({
    where: { id: existing.id },
    data: {
      status: patch.status,
      ...(patch.afterState !== undefined && { afterStateJson: JSON.stringify(patch.afterState) }),
      ...(patch.verificationResult !== undefined && {
        verificationResultJson: JSON.stringify(patch.verificationResult),
      }),
      ...(patch.errorMessage !== undefined && { errorMessage: patch.errorMessage }),
      ...(patch.durationMs !== undefined && { durationMs: patch.durationMs }),
    },
  });
}

export async function listRecentAgentAuditLogs(userId: string, limit = 25) {
  return prisma.agentActionAuditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

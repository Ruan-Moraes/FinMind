'use server';

import { prisma } from '@/shared/lib/prisma';
import { requireAuthenticatedUser } from '@/features/auth';
import type { AssistantStructuredResponse } from '@/features/ai-copilot/assistant';
import type { AgentTurnPayload } from '@/features/ai-agent/domain/agent-types';

export interface SerializedChatSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  messageCount: number;
}

export interface SerializedChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: AssistantStructuredResponse;
  agentPayload?: AgentTurnPayload;
  mutationStatus?: 'AWAITING' | 'RUNNING' | 'SUCCEEDED' | 'CANCELLED' | 'FAILED' | 'ROLLED_BACK';
  createdAt: string;
}

export async function listAiChatSessionsAction(): Promise<{
  ok: boolean;
  sessions: SerializedChatSessionSummary[];
}> {
  const user = await requireAuthenticatedUser();
  const rows = await prisma.aiChatSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 40,
    include: { _count: { select: { messages: true } } },
  });

  return {
    ok: true,
    sessions: rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      messageCount: r._count.messages,
    })),
  };
}

export async function getAiChatSessionMessagesAction(sessionId: string): Promise<{
  ok: boolean;
  sessionTitle?: string;
  messages: SerializedChatMessage[];
  error?: string;
}> {
  const user = await requireAuthenticatedUser();
  const session = await prisma.aiChatSession.findFirst({
    where: { id: sessionId, userId: user.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!session) {
    return { ok: false, messages: [], error: 'Conversa não encontrada.' };
  }

  const parsedMessages = session.messages.map((m) => {
    let parsedResponse: AssistantStructuredResponse | undefined;
    let agentPayload: AgentTurnPayload | undefined;
    if (m.responseJson) {
      try {
        const parsed = JSON.parse(m.responseJson) as
          | { kind?: string; payload?: AgentTurnPayload }
          | AssistantStructuredResponse;
        if ('kind' in parsed && parsed.kind === 'AGENT_TURN' && parsed.payload) {
          agentPayload = parsed.payload;
        } else {
          parsedResponse = parsed as AssistantStructuredResponse;
        }
      } catch {
        parsedResponse = undefined;
      }
    }
    return { m, parsedResponse, agentPayload };
  });

  const auditIds = parsedMessages
    .map((x) => x.agentPayload?.pendingMutation?.auditLogId)
    .filter((id): id is string => Boolean(id));

  const auditStatusMap = new Map<string, string>();
  if (auditIds.length > 0 && (prisma as unknown as Record<string, unknown>).agentActionAuditLog) {
    const logs = await prisma.agentActionAuditLog.findMany({
      where: { id: { in: auditIds }, userId: user.id },
      select: { id: true, status: true },
    });
    for (const l of logs) auditStatusMap.set(l.id, l.status);
  }

  const mapAuditStatus = (
    raw?: string
  ): SerializedChatMessage['mutationStatus'] => {
    if (raw === 'SUCCEEDED') return 'SUCCEEDED';
    if (raw === 'CANCELLED') return 'CANCELLED';
    if (raw === 'FAILED') return 'FAILED';
    if (raw === 'ROLLED_BACK') return 'ROLLED_BACK';
    if (raw === 'EXECUTING') return 'RUNNING';
    return 'AWAITING';
  };

  return {
    ok: true,
    sessionTitle: session.title,
    messages: parsedMessages.map(({ m, parsedResponse, agentPayload }) => ({
      id: m.id,
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
      response: parsedResponse,
      agentPayload,
      mutationStatus: agentPayload?.pendingMutation
        ? mapAuditStatus(auditStatusMap.get(agentPayload.pendingMutation.auditLogId))
        : undefined,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function deleteAiChatSessionAction(sessionId: string): Promise<{ ok: boolean }> {
  const user = await requireAuthenticatedUser();
  await prisma.aiChatSession.deleteMany({ where: { id: sessionId, userId: user.id } });
  return { ok: true };
}

export async function deleteAiChatSessionsBatchAction(
  sessionIds: string[]
): Promise<{ ok: boolean; deletedCount: number }> {
  const user = await requireAuthenticatedUser();
  const cleanIds = Array.from(new Set(sessionIds.map((id) => id.trim()).filter(Boolean)));
  if (cleanIds.length === 0) return { ok: true, deletedCount: 0 };

  const res = await prisma.aiChatSession.deleteMany({
    where: { id: { in: cleanIds }, userId: user.id },
  });
  return { ok: true, deletedCount: res.count };
}

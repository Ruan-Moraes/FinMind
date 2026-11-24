'use server';

import { prisma } from '@/shared/lib/prisma';
import { requireAuthenticatedUser } from '@/features/auth';
import {
  executeContextualFinancialAssistant,
  type AssistantStructuredResponse,
} from '@/features/ai-copilot/assistant';
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
  createdAt: string;
}

function buildSessionTitle(question: string): string {
  const clean = question.replace(/\s+/g, ' ').trim();
  if (clean.length <= 56) return clean;
  return `${clean.slice(0, 53).trimEnd()}...`;
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

  return {
    ok: true,
    sessionTitle: session.title,
    messages: session.messages.map((m) => {
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
      return {
        id: m.id,
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
        response: parsedResponse,
        agentPayload,
        createdAt: m.createdAt.toISOString(),
      };
    }),
  };
}

export async function sendAiChatMessageAction(data: {
  sessionId?: string | null;
  question: string;
  month?: number;
  year?: number;
}): Promise<{
  ok: boolean;
  sessionId?: string;
  sessionTitle?: string;
  response?: AssistantStructuredResponse;
  error?: string;
}> {
  const user = await requireAuthenticatedUser();
  const cleanQuestion = data.question.trim();
  if (cleanQuestion.length < 2) {
    return { ok: false, error: 'Digite uma pergunta válida para o assistente.' };
  }

  let activeSessionId = data.sessionId || '';
  let activeSessionTitle = '';

  if (activeSessionId) {
    const existing = await prisma.aiChatSession.findFirst({
      where: { id: activeSessionId, userId: user.id },
      select: { id: true, title: true },
    });
    if (existing) {
      activeSessionTitle = existing.title;
    } else {
      activeSessionId = '';
    }
  }

  if (!activeSessionId) {
    const created = await prisma.aiChatSession.create({
      data: {
        userId: user.id,
        title: buildSessionTitle(cleanQuestion),
      },
      select: { id: true, title: true },
    });
    activeSessionId = created.id;
    activeSessionTitle = created.title;
  }

  await prisma.aiChatMessage.create({
    data: {
      sessionId: activeSessionId,
      role: 'user',
      content: cleanQuestion,
    },
  });

  try {
    const response = await executeContextualFinancialAssistant({
      userId: user.id,
      question: cleanQuestion,
      referenceMonth: data.month,
      referenceYear: data.year,
    });

    await prisma.$transaction([
      prisma.aiChatMessage.create({
        data: {
          sessionId: activeSessionId,
          role: 'assistant',
          content: response.directAnswer,
          responseJson: JSON.stringify(response),
        },
      }),
      prisma.aiChatSession.update({
        where: { id: activeSessionId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return {
      ok: true,
      sessionId: activeSessionId,
      sessionTitle: activeSessionTitle,
      response,
    };
  } catch (err) {
    return {
      ok: false,
      sessionId: activeSessionId,
      sessionTitle: activeSessionTitle,
      error: err instanceof Error ? err.message : 'Falha ao consultar o assistente financeiro.',
    };
  }
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

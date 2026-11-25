'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  deleteAiChatSessionAction,
  deleteAiChatSessionsBatchAction,
  getAiChatSessionMessagesAction,
  listAiChatSessionsAction,
  type SerializedChatSessionSummary,
} from '@/features/ai-copilot/actions/ai-chat-history.actions';
import type { AssistantStructuredResponse } from '@/features/ai-copilot/assistant';
import type {
  AgentTurnPayload,
  CapturedAnnotatedImage,
  PendingAgentMutation,
} from '@/features/ai-agent/domain/agent-types';
import {
  cancelAgentPlanAction,
  confirmAndExecuteAgentAction,
  planAgentTurnAction,
  rollbackAgentExecutionAction,
} from '@/features/ai-agent/actions/agent.actions';
import { useAgentRuntime } from '@/features/ai-agent/context/agent-runtime-context';
import type { MutationUiState } from '@/features/ai-agent/components/agent-confirmation-card';

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text?: string;
  response?: AssistantStructuredResponse;
  agentPayload?: AgentTurnPayload;
  capturedImage?: CapturedAnnotatedImage | null;
  mutationState?: MutationUiState;
}

export function useFloatingChatbot() {
  const router = useRouter();
  const runtime = useAgentRuntime();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const [sessions, setSessions] = React.useState<SerializedChatSessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = React.useState(false);
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatEntry[]>([]);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  // Operações em andamento por auditLogId: cliques repetidos (duplo clique) são ignorados.
  const inFlightRef = React.useRef(new Set<string>());

  const refreshSessions = React.useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const res = await listAiChatSessionsAction();
      if (res.ok) setSessions(res.sessions);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen) void refreshSessions();
  }, [isOpen, refreshSessions]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading, isOpen, showHistory]);

  const handleOpenSession = async (sessionId: string) => {
    setShowHistory(false);
    setIsLoading(true);
    try {
      const res = await getAiChatSessionMessagesAction(sessionId);
      if (res.ok) {
        setActiveSessionId(sessionId);
        setMessages(
          res.messages.map((m) => ({
            id: m.id, role: m.role, text: m.content, response: m.response, agentPayload: m.agentPayload,
            mutationState: m.agentPayload?.pendingMutation ? { status: m.mutationStatus || 'AWAITING' } : undefined,
          }))
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNewSession = () => { setActiveSessionId(null); setMessages([]); setShowHistory(false); };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteAiChatSessionAction(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) { setActiveSessionId(null); setMessages([]); }
  };

  const handleDeleteSessionsBatch = async (sessionIds: string[]) => {
    if (sessionIds.length === 0) return;
    await deleteAiChatSessionsBatchAction(sessionIds);
    const idSet = new Set(sessionIds);
    setSessions((prev) => prev.filter((s) => !idSet.has(s.id)));
    if (activeSessionId && idSet.has(activeSessionId)) { setActiveSessionId(null); setMessages([]); }
  };

  const captureForMessage = async (msgId: string, payload: AgentTurnPayload) => {
    if (!payload.screenshotDirective) return;
    try {
      const img = await runtime.executeScreenshotDirective(payload.screenshotDirective);
      if (img) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, capturedImage: img } : m))
        );
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `e-cap-${Date.now()}`, role: 'error', text: 'Não foi possível capturar a tela atual.' },
      ]);
    }
  };

  const sendQuestion = async (overrideQuestion?: string) => {
    const q = (overrideQuestion ?? input).trim();
    if (!q || isLoading) return;

    setShowHistory(false);
    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: q }]);
    setIsLoading(true);
    runtime.setStatus('PLANNING');

    try {
      const res = await planAgentTurnAction({
        sessionId: activeSessionId,
        message: q,
        uiState: runtime.buildUiStateSnapshot(),
        interactionMode: runtime.mode,
      });

      if (!res.ok) {
        runtime.setStatus('IDLE');
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: 'error', text: res.error },
        ]);
        return;
      }

      setActiveSessionId(res.sessionId);
      const msgId = `a-${Date.now()}`;
      const payload = res.payload;
      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          role: 'assistant',
          agentPayload: payload,
          mutationState: payload.pendingMutation ? { status: 'AWAITING' } : undefined,
        },
      ]);
      void refreshSessions();

      if (payload.visualSteps.length > 0) {
        const vis = await runtime.runVisualSequence(payload.visualSteps);
        if (vis.interrupted) {
          setMessages((prev) => [
            ...prev,
            {
              id: `int-${Date.now()}`,
              role: 'error',
              text: `Execução interrompida por você no passo ${vis.completedSteps + 1}. Nenhuma alteração pendente foi aplicada.`,
            },
          ]);
        }
      } else {
        runtime.setStatus('IDLE');
      }

      if (payload.screenshotDirective) {
        await captureForMessage(msgId, payload);
      }
    } catch {
      runtime.setStatus('IDLE');
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: 'error', text: 'Erro de comunicação com o agente IA.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateMsgMutationState = (msgId: string, mutationState: MutationUiState) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, mutationState } : m)));
  };

  const handleConfirmMutation = async (msgId: string, mutation: PendingAgentMutation) => {
    if (inFlightRef.current.has(mutation.auditLogId)) return;
    inFlightRef.current.add(mutation.auditLogId);
    updateMsgMutationState(msgId, { status: 'RUNNING' });
    try {
      if (mutation.postConfirmVisualSteps.length > 0) {
        const vis = await runtime.runVisualSequence(mutation.postConfirmVisualSteps);
        if (vis.interrupted) { updateMsgMutationState(msgId, { status: 'AWAITING' }); return; }
      }
      runtime.setStatus('VERIFYING');
      const res = await confirmAndExecuteAgentAction(mutation.auditLogId);
      runtime.setStatus('IDLE');
      if (res.ok) {
        // ok sem verified = lote parcial: algo foi gravado, então o Desfazer precisa continuar disponível.
        updateMsgMutationState(msgId, { status: 'SUCCEEDED', resultText: res.summary });
        router.refresh();
      } else {
        updateMsgMutationState(msgId, { status: 'FAILED', resultText: res.error });
        router.refresh();
      }
    } catch {
      runtime.setStatus('IDLE');
      updateMsgMutationState(msgId, { status: 'FAILED', resultText: 'Erro de comunicação ao confirmar a operação.' });
    } finally {
      inFlightRef.current.delete(mutation.auditLogId);
    }
  };

  const handleCancelMutation = async (msgId: string, mutation: PendingAgentMutation) => {
    try {
      await cancelAgentPlanAction(mutation.auditLogId);
      updateMsgMutationState(msgId, { status: 'CANCELLED' });
    } catch {
      updateMsgMutationState(msgId, { status: 'FAILED', resultText: 'Não foi possível cancelar a operação.' });
    }
  };

  const handleRollbackMutation = async (msgId: string, mutation: PendingAgentMutation) => {
    if (inFlightRef.current.has(mutation.auditLogId)) return;
    inFlightRef.current.add(mutation.auditLogId);
    updateMsgMutationState(msgId, { status: 'RUNNING' });
    try {
      const res = await rollbackAgentExecutionAction(mutation.auditLogId);
      if (res.ok) { updateMsgMutationState(msgId, { status: 'ROLLED_BACK', resultText: res.summary }); router.refresh(); }
      // A operação original continua gravada: mantém o estado concluído para permitir nova tentativa.
      else updateMsgMutationState(msgId, { status: 'SUCCEEDED', resultText: res.summary });
    } catch {
      updateMsgMutationState(msgId, { status: 'SUCCEEDED', resultText: 'Erro de comunicação ao desfazer a operação. Tente novamente.' });
    } finally {
      inFlightRef.current.delete(mutation.auditLogId);
    }
  };

  return {
    isOpen, setIsOpen, isExpanded, setIsExpanded, showHistory, setShowHistory,
    sessions, isLoadingSessions, activeSessionId, input, setInput, isLoading,
    messages, scrollRef, handleOpenSession, handleStartNewSession,
    handleDeleteSession, handleDeleteSessionsBatch, sendQuestion, handleConfirmMutation,
    handleCancelMutation, handleRollbackMutation, captureForMessage, runtime,
  };
}

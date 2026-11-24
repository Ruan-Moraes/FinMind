'use client';

import * as React from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { useFloatingChatbot } from '@/features/ai-copilot/hooks/use-floating-chatbot';
import { FloatingChatHeader } from '@/features/ai-copilot/components/floating-chat-header';
import { FloatingChatMessage } from '@/features/ai-copilot/components/floating-chat-message';
import { FloatingChatHistoryDrawer } from '@/features/ai-copilot/components/floating-chat-history-drawer';
import { AgentTurnMessage } from '@/features/ai-agent/components/agent-turn-message';

const SUGGESTED_PROMPTS = [
  'Como faço para cadastrar uma nova meta financeira?',
  'Tire um print anotado das metas e custos estáticos',
  'Mostre um gráfico dos meus maiores gastos por categoria',
  'Filtre o extrato apenas por despesas',
];

export function FloatingAiChatbot() {
  const { wb } = useWorkbench();
  const { hideValues } = wb;

  const {
    isOpen, setIsOpen, isExpanded, setIsExpanded, showHistory, setShowHistory,
    sessions, isLoadingSessions, activeSessionId, input, setInput, isLoading,
    messages, scrollRef, handleOpenSession, handleStartNewSession,
    handleDeleteSession, handleDeleteSessionsBatch, sendQuestion, handleConfirmMutation,
    handleCancelMutation, handleRollbackMutation, captureForMessage, runtime,
  } = useFloatingChatbot();

  return (
    <>
      {isOpen && (
        <aside
          data-agent-chat-panel="true"
          data-agent-capture-ignore="true"
          aria-label="Assistente Financeiro Inteligente"
          className={`fixed z-50 right-4 sm:right-6 bottom-20 sm:bottom-24 flex flex-col rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 shadow-2xl overflow-hidden transition-all duration-200 ${
            isExpanded
              ? 'w-[min(680px,calc(100vw-2rem))] h-[min(780px,calc(100vh-7rem))]'
              : 'w-[min(450px,calc(100vw-2rem))] h-[min(650px,calc(100vh-7rem))]'
          }`}
        >
          <FloatingChatHeader
            showHistory={showHistory}
            isExpanded={isExpanded}
            mode={runtime.mode}
            onToggleHistory={() => setShowHistory((v) => !v)}
            onNewSession={handleStartNewSession}
            onToggleExpand={() => setIsExpanded((v) => !v)}
            onClose={() => setIsOpen(false)}
            onChangeMode={runtime.setMode}
          />

          {showHistory ? (
            <FloatingChatHistoryDrawer
              sessions={sessions}
              activeSessionId={activeSessionId}
              isLoadingSessions={isLoadingSessions}
              onSelectSession={(id) => void handleOpenSession(id)}
              onStartNewSession={handleStartNewSession}
              onDeleteSession={(id) => void handleDeleteSession(id)}
              onDeleteSessionsBatch={(ids) => void handleDeleteSessionsBatch(ids)}
            />
          ) : (
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="space-y-4 py-3">
                  <div className="rounded-2xl border border-indigo-200/70 dark:border-indigo-900/60 bg-white dark:bg-zinc-950 p-4 space-y-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      Olá! Sou seu Agente Interativo do FinMind.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                      Posso navegar pelas telas com cursor visual, ensinar passo a passo, gerar capturas anotadas, aplicar filtros, alterar metas/configurações com sua confirmação e montar gráficos reais.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium text-slate-400 block px-1">
                      Experimente pedir:
                    </span>
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        disabled={isLoading}
                        onClick={() => void sendQuestion(prompt)}
                        className="w-full text-left text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-indigo-500/60 text-slate-700 dark:text-zinc-300 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 text-white px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-sm">
                          {msg.text}
                        </div>
                      </div>
                    );
                  }
                  if (msg.role === 'error') {
                    return (
                      <div
                        key={msg.id}
                        className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3 py-2 text-xs text-rose-700 dark:text-rose-300"
                      >
                        {msg.text}
                      </div>
                    );
                  }
                  if (msg.agentPayload) {
                    const p = msg.agentPayload;
                    return (
                      <AgentTurnMessage
                        key={msg.id}
                        payload={p}
                        hideValues={hideValues}
                        capturedImage={msg.capturedImage}
                        mutationState={msg.mutationState}
                        onConfirmMutation={
                          p.pendingMutation
                            ? () => void handleConfirmMutation(msg.id, p.pendingMutation!)
                            : undefined
                        }
                        onCancelMutation={
                          p.pendingMutation
                            ? () => void handleCancelMutation(msg.id, p.pendingMutation!)
                            : undefined
                        }
                        onRollbackMutation={
                          p.pendingMutation
                            ? () => void handleRollbackMutation(msg.id, p.pendingMutation!)
                            : undefined
                        }
                        onReplayVisual={
                          p.visualSteps.length > 0
                            ? () => void runtime.runVisualSequence(p.visualSteps)
                            : undefined
                        }
                        onRecaptureScreen={
                          p.screenshotDirective ? () => void captureForMessage(msg.id, p) : undefined
                        }
                      />
                    );
                  }
                  return msg.response ? (
                    <FloatingChatMessage key={msg.id} response={msg.response} hideValues={hideValues} />
                  ) : null;
                })
              )}

              {isLoading && (
                <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-xs text-slate-500 dark:text-zinc-400 animate-pulse">
                  Consultando base de conhecimento, estado da tela e dados reais...
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendQuestion();
            }}
            className="p-3 bg-white dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800 flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Peça para executar, ensinar, capturar tela ou analisar..."
              className="flex-1 text-xs"
            />
            <Button
              type="submit"
              variant="primary"
              size="icon"
              disabled={isLoading || !input.trim()}
              aria-label="Enviar pergunta ao assistente IA"
              className="h-10 w-10 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </aside>
      )}

      <button
        type="button"
        data-agent-id="agent.btn.toggleChat"
        data-agent-capture-ignore="true"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Fechar Assistente IA' : 'Abrir Assistente IA'}
        title="Conversar com o Agente IA"
        className="fixed z-40 right-4 sm:right-6 bottom-36 sm:bottom-6 h-13 px-4 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 flex items-center gap-2 font-semibold text-xs sm:text-sm transition-all active:scale-95"
      >
        {isOpen ? (
          <X className="h-5 w-5 shrink-0" />
        ) : (
          <>
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Assistente IA</span>
          </>
        )}
      </button>
    </>
  );
}

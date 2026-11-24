'use client';

import * as React from 'react';
import { Clock, MessageSquarePlus, Trash2 } from 'lucide-react';
import type { SerializedChatSessionSummary } from '@/features/ai-copilot/actions/ai-chat-history.actions';

interface Props {
  sessions: SerializedChatSessionSummary[];
  activeSessionId: string | null;
  isLoadingSessions: boolean;
  onSelectSession: (sessionId: string) => void;
  onStartNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onDeleteSessionsBatch: (sessionIds: string[]) => void;
}

export function FloatingChatHistoryDrawer({
  sessions,
  activeSessionId,
  isLoadingSessions,
  onSelectSession,
  onStartNewSession,
  onDeleteSession,
  onDeleteSessionsBatch,
}: Props) {
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = React.useState(false);

  const selectAllRef = React.useRef<HTMLInputElement>(null);

  // Mantém seleção sincronizada caso sessões sejam removidas
  React.useEffect(() => {
    const valid = new Set(sessions.map((s) => s.id));
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)));
  }, [sessions]);

  const allSelected = sessions.length > 0 && selectedIds.length === sessions.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < sessions.length;

  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const toggleSelectAll = () => {
    setConfirmBulkDelete(false);
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sessions.map((s) => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setConfirmBulkDelete(false);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirmBulkDelete = () => {
    onDeleteSessionsBatch(selectedIds);
    setSelectedIds([]);
    setConfirmBulkDelete(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-indigo-500" />
          Histórico de Conversas ({sessions.length})
        </span>
        <button
          type="button"
          onClick={onStartNewSession}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Nova conversa
        </button>
      </div>

      {!isLoadingSessions && sessions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 px-3 py-2 text-xs">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-zinc-300 font-medium">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              aria-label="Selecionar todas as conversas"
              className="h-4 w-4 rounded border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span>
              {allSelected
                ? `Todas selecionadas (${selectedIds.length})`
                : selectedIds.length > 0
                ? `${selectedIds.length} selecionada(s)`
                : 'Selecionar tudo'}
            </span>
          </label>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5">
              {confirmBulkDelete ? (
                <>
                  <button
                    type="button"
                    onClick={handleConfirmBulkDelete}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold transition-colors"
                  >
                    Confirmar exclusão ({selectedIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmBulkDelete(false)}
                    className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] font-medium"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 text-[11px] font-semibold transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Excluir selecionadas ({selectedIds.length})</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isLoadingSessions ? (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 text-center text-xs text-slate-400 animate-pulse">
          Carregando histórico de conversas...
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-6 text-center text-xs text-slate-400">
          Nenhuma conversa salva ainda. Envie sua primeira pergunta para iniciar o histórico.
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isConfirming = confirmDeleteId === session.id;
            const isChecked = selectedIds.includes(session.id);
            return (
              <div
                key={session.id}
                className={`rounded-xl border p-3 transition-colors ${
                  isChecked
                    ? 'border-rose-400/70 bg-rose-500/5 dark:border-rose-500/50'
                    : isActive
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-indigo-400/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSelectOne(session.id)}
                    aria-label={`Selecionar conversa ${session.title}`}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={() => onSelectSession(session.id)}
                    className="flex-1 text-left min-w-0 space-y-0.5"
                  >
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">
                      {session.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {new Date(session.updatedAt).toLocaleString('pt-BR')} •{' '}
                      {session.messageCount} {session.messageCount === 1 ? 'mensagem' : 'mensagens'}
                    </div>
                  </button>

                  {isConfirming ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteSession(session.id);
                          setConfirmDeleteId(null);
                        }}
                        className="px-2 py-1 rounded-md bg-rose-600 text-white text-[10px] font-semibold hover:bg-rose-500"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 rounded-md bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[10px] font-medium"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(session.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-zinc-800 shrink-0"
                      title="Excluir conversa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

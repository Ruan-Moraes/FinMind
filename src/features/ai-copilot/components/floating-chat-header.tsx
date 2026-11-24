'use client';

import * as React from 'react';
import { History, Maximize2, MessageSquarePlus, Minimize2, Sparkles, X } from 'lucide-react';

export function FloatingChatHeader(props: {
  showHistory: boolean;
  isExpanded: boolean;
  onToggleHistory: () => void;
  onNewSession: () => void;
  onToggleExpand: () => void;
  onClose: () => void;
}) {
  const { showHistory, isExpanded, onToggleHistory, onNewSession, onToggleExpand, onClose } = props;

  return (
    <div className="px-4 py-3 bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
              Agente Financeiro IA
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
              Opera, orienta, captura telas e analisa dados reais
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleHistory}
            className={`p-1.5 rounded-lg transition-colors ${
              showHistory
                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
            title="Histórico de conversas"
            aria-label="Histórico de conversas"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNewSession}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
            title="Nova conversa"
            aria-label="Nova conversa"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleExpand}
            className="hidden sm:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
            title={isExpanded ? 'Reduzir janela' : 'Expandir janela'}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
            aria-label="Fechar assistente IA"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

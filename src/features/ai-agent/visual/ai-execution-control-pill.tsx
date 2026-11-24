'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, Sparkles, Square } from 'lucide-react';
import type { AgentExecutionStatus } from '@/features/ai-agent/domain/agent-types';

export function AiExecutionControlPill(props: {
  status: AgentExecutionStatus;
  stepIndex: number;
  totalSteps: number;
  caption: string;
  onTogglePause: () => void;
  onStop: () => void;
}) {
  const { status, stepIndex, totalSteps, caption, onTogglePause, onStop } = props;
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const visible =
    mounted && (status === 'RUNNING_VISUAL' || status === 'PAUSED' || status === 'VERIFYING');
  if (!visible) return null;

  return createPortal(
    <div
      data-agent-capture-ignore="true"
      data-agent-control-pill="true"
      role="status"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[130] flex items-center gap-2.5 rounded-full border border-indigo-400/50 bg-zinc-950/95 text-white px-4 py-2 shadow-2xl shadow-indigo-950/50 backdrop-blur-md max-w-[min(560px,calc(100vw-2rem))]"
    >
      <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-white animate-pulse" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-300">
          <span>
            {status === 'VERIFYING'
              ? 'Verificando resultado real...'
              : status === 'PAUSED'
              ? 'Execução pausada'
              : `Agente IA • Passo ${Math.min(stepIndex + 1, Math.max(1, totalSteps))}/${Math.max(1, totalSteps)}`}
          </span>
        </div>
        <div className="text-xs text-zinc-100 truncate">{caption || 'Executando ação...'}</div>
      </div>

      {status !== 'VERIFYING' && (
        <button
          type="button"
          onClick={onTogglePause}
          className="inline-flex items-center gap-1 rounded-full bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-100 transition-colors shrink-0"
          aria-label={status === 'PAUSED' ? 'Retomar execução do agente' : 'Pausar execução do agente'}
        >
          {status === 'PAUSED' ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          <span>{status === 'PAUSED' ? 'Retomar' : 'Pausar'}</span>
        </button>
      )}

      <button
        type="button"
        onClick={onStop}
        className="inline-flex items-center gap-1 rounded-full bg-rose-600 hover:bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors shrink-0"
        aria-label="Parar execução do agente"
      >
        <Square className="h-3 w-3 fill-current" />
        <span>Parar (Esc)</span>
      </button>
    </div>,
    document.body
  );
}

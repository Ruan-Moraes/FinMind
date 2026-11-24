'use client';

import * as React from 'react';
import { ArrowRight, CheckCircle2, RotateCcw, ShieldAlert, XCircle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import type { PendingAgentMutation } from '@/features/ai-agent/domain/agent-types';

export interface MutationUiState {
  status: 'AWAITING' | 'RUNNING' | 'SUCCEEDED' | 'CANCELLED' | 'ROLLED_BACK' | 'FAILED';
  resultText?: string;
}

export function AgentConfirmationCard(props: {
  mutation: PendingAgentMutation;
  state: MutationUiState;
  onConfirm: () => void;
  onCancel: () => void;
  onRollback: () => void;
}) {
  const { mutation, state, onConfirm, onCancel, onRollback } = props;
  const isDestructive = mutation.riskLevel === 'L3';

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/70 bg-indigo-50/40 dark:bg-indigo-950/30 p-3 space-y-2.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
            {isDestructive && <ShieldAlert className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
            <span>{mutation.title}</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-300">{mutation.summary}</p>
        </div>
        <Badge variant={isDestructive ? 'expense' : 'transfer'}>
          {isDestructive ? 'Exclusão (L3)' : 'Confirmação (L2)'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/80 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-zinc-800 p-2 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Antes
          </span>
          {mutation.beforePreview.map((item, idx) => (
            <div key={idx} className="flex justify-between gap-2 text-[11px]">
              <span className="text-slate-500 dark:text-zinc-400">{item.label}:</span>
              <span className="font-medium text-slate-700 dark:text-zinc-200 truncate">
                {item.value}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-white dark:bg-zinc-950 border border-indigo-200/80 dark:border-indigo-800/70 p-2 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500 flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />
            Depois
          </span>
          {mutation.afterPreview.map((item, idx) => (
            <div key={idx} className="flex justify-between gap-2 text-[11px]">
              <span className="text-slate-500 dark:text-zinc-400">{item.label}:</span>
              <span className="font-semibold text-indigo-700 dark:text-indigo-300 truncate">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {state.status === 'AWAITING' && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={isDestructive ? 'destructive' : 'primary'}
            size="sm"
            onClick={onConfirm}
          >
            Confirmar e Executar
          </Button>
        </div>
      )}

      {state.status === 'RUNNING' && (
        <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-300 animate-pulse">
          Executando visualmente, persistindo e verificando no banco...
        </div>
      )}

      {state.status === 'SUCCEEDED' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-2 text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>{state.resultText || 'Operação concluída e verificada no banco.'}</span>
          </div>
          {mutation.reversible && (
            <Button type="button" variant="secondary" size="sm" onClick={onRollback}>
              <RotateCcw className="h-3 w-3" />
              <span>Desfazer</span>
            </Button>
          )}
        </div>
      )}

      {state.status === 'ROLLED_BACK' && (
        <div className="rounded-lg bg-slate-100 dark:bg-zinc-900 px-2.5 py-1.5 text-[11px] text-slate-600 dark:text-zinc-300">
          {state.resultText || 'Alteração desfeita e estado anterior restaurado.'}
        </div>
      )}

      {state.status === 'CANCELLED' && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
          <XCircle className="h-3.5 w-3.5" />
          <span>Operação cancelada. Nenhuma alteração foi salva.</span>
        </div>
      )}

      {state.status === 'FAILED' && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-2.5 py-2 text-[11px] text-rose-700 dark:text-rose-300">
          {state.resultText || 'Falha ao executar ou verificar a operação.'}
        </div>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import type {
  PendingAgentMutation,
  PendingBatchItemPreview,
} from '@/features/ai-agent/domain/agent-types';

export interface MutationUiState {
  status: 'AWAITING' | 'RUNNING' | 'SUCCEEDED' | 'CANCELLED' | 'ROLLED_BACK' | 'FAILED';
  resultText?: string;
}

function StateDiffBlock(props: {
  before: Array<{ label: string; value: string }>;
  after: Array<{ label: string; value: string }>;
  compact?: boolean;
}) {
  const { before, after, compact = false } = props;
  const pad = compact ? 'p-2' : 'p-2.5';

  return (
    <div className="space-y-1.5">
      <div
        className={`rounded-lg bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 ${pad} space-y-1`}
      >
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          De (estado atual)
        </div>
        <div className="space-y-1">
          {before.map((row, idx) => (
            <div key={idx} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[11px]">
              <span className="text-slate-500 dark:text-zinc-400">{row.label}</span>
              <span className="font-medium text-slate-700 dark:text-zinc-200 text-right break-words">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center -my-1">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
          <ArrowDown className="h-2.5 w-2.5" />
        </span>
      </div>

      <div
        className={`rounded-lg bg-indigo-50/50 dark:bg-indigo-950/35 border border-indigo-200/80 dark:border-indigo-800/70 ${pad} space-y-1`}
      >
        <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
          <ArrowRight className="h-3 w-3" />
          <span>Para (como vai ficar)</span>
        </div>
        <div className="space-y-1">
          {after.map((row, idx) => (
            <div key={idx} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[11px]">
              <span className="text-slate-600 dark:text-zinc-400">{row.label}</span>
              <span className="font-semibold text-indigo-700 dark:text-indigo-200 text-right break-words">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BatchItemCard(props: { item: PendingBatchItemPreview; index: number }) {
  const { item, index } = props;
  return (
    <div className="rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 space-y-2.5 shadow-sm">
      <div className="flex items-start gap-2.5">
        <span className="h-5 min-w-5 px-1.5 rounded-md bg-indigo-600 text-white text-[10px] font-bold inline-flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-zinc-300">
              {item.actionLabel}
            </span>
            <span className="font-semibold text-xs text-slate-900 dark:text-zinc-100 leading-snug">
              {item.title}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
            {item.summary}
          </p>
        </div>
      </div>
      <StateDiffBlock before={item.beforePreview} after={item.afterPreview} compact />
    </div>
  );
}

export function AgentConfirmationCard(props: {
  mutation: PendingAgentMutation;
  state: MutationUiState;
  onConfirm: () => void;
  onCancel: () => void;
  onRollback: () => void;
}) {
  const { mutation, state, onConfirm, onCancel, onRollback } = props;
  const [showAllBatch, setShowAllBatch] = React.useState(false);
  const isDestructive = mutation.riskLevel === 'L3';
  const batchItems = mutation.batchItems && mutation.batchItems.length > 0 ? mutation.batchItems : null;
  const visibleBatchItems = batchItems
    ? showAllBatch
      ? batchItems
      : batchItems.slice(0, 3)
    : [];
  const hiddenCount = batchItems ? Math.max(0, batchItems.length - visibleBatchItems.length) : 0;

  return (
    <div className="rounded-2xl border border-indigo-200/90 dark:border-indigo-900/70 bg-indigo-50/40 dark:bg-indigo-950/25 p-3.5 space-y-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
            {isDestructive ? (
              <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />
            ) : batchItems ? (
              <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            ) : null}
            <span>{mutation.title}</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
            {mutation.summary}
          </p>
        </div>
        <Badge variant={isDestructive ? 'expense' : 'transfer'} className="shrink-0">
          {isDestructive ? 'Exclusão (L3)' : batchItems ? `Lote (${batchItems.length})` : 'Confirmação (L2)'}
        </Badge>
      </div>

      {batchItems ? (
        <div className="space-y-2.5">
          <div className="max-h-96 overflow-y-auto pr-0.5 space-y-2.5">
            {visibleBatchItems.map((item, idx) => (
              <BatchItemCard key={`${item.toolName}-${idx}`} item={item} index={idx} />
            ))}
          </div>
          {batchItems.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllBatch((v) => !v)}
              className="w-full py-1.5 px-3 rounded-xl border border-indigo-200/80 dark:border-indigo-800/70 bg-white/80 dark:bg-zinc-950/70 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              {showAllBatch ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span>Recolher lista de ações</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>Mostrar mais {hiddenCount} ação(ões) do lote</span>
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
          <StateDiffBlock before={mutation.beforePreview} after={mutation.afterPreview} />
        </div>
      )}

      {state.status === 'AWAITING' && (
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-indigo-200/60 dark:border-indigo-900/50">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={isDestructive ? 'destructive' : 'primary'}
            size="sm"
            onClick={onConfirm}
          >
            {batchItems ? `Confirmar e Executar (${batchItems.length})` : 'Confirmar e Executar'}
          </Button>
        </div>
      )}

      {state.status === 'RUNNING' && (
        <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-300 animate-pulse">
          {batchItems
            ? `Executando lote de ${batchItems.length} ações e verificando cada gravação no banco...`
            : 'Executando visualmente, persistindo e verificando no banco...'}
        </div>
      )}

      {state.status === 'SUCCEEDED' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>{state.resultText || 'Operação concluída e verificada no banco.'}</span>
          </div>
          {mutation.reversible && (
            <Button type="button" variant="secondary" size="sm" onClick={onRollback}>
              <RotateCcw className="h-3 w-3" />
              <span>{batchItems ? 'Desfazer Lote' : 'Desfazer'}</span>
            </Button>
          )}
        </div>
      )}

      {state.status === 'ROLLED_BACK' && (
        <div className="rounded-xl bg-slate-100 dark:bg-zinc-900 px-3 py-2 text-[11px] text-slate-600 dark:text-zinc-300">
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
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-[11px] text-rose-700 dark:text-rose-300">
          {state.resultText || 'Falha ao executar ou verificar a operação.'}
        </div>
      )}
    </div>
  );
}

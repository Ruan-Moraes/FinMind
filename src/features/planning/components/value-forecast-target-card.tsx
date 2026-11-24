'use client';

import * as React from 'react';
import { CheckCircle2, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { formatCentsToBRL } from '@/shared/lib/currency';
import {
  EvaluatedBalanceTarget,
  formatIsoDatePtBR,
} from '@/features/planning/domain/value-forecast-calculator';

interface Props {
  evaluation: EvaluatedBalanceTarget;
  hideValues: boolean;
  onDelete: (id: string) => void;
}

export function ValueForecastTargetCard({ evaluation: ev, hideValues, onDelete }: Props) {
  const statusCfg = {
    PENDING: {
      badge: `Faltam ${ev.daysUntilTarget} ${ev.daysUntilTarget === 1 ? 'dia' : 'dias'}`,
      variant: 'transfer' as const,
      box: 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950',
    },
    EXACT: {
      badge: 'Saldo ficou igual ao planejado',
      variant: 'income' as const,
      box: 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/25',
    },
    ABOVE: {
      badge: 'Saldo ficou maior que o planejado',
      variant: 'income' as const,
      box: 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/25',
    },
    BELOW: {
      badge: 'Saldo ficou menor que o planejado',
      variant: 'expense' as const,
      box: 'border-rose-300 dark:border-rose-800/80 bg-rose-50/40 dark:bg-rose-950/25',
    },
  }[ev.verificationStatus];

  const diffValue = ev.isDue ? ev.actualDiffInCents : ev.projectedDiffVsPlannedInCents;

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${statusCfg.box}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              {ev.target.title}
            </h3>
            <Badge variant={statusCfg.variant}>{statusCfg.badge}</Badge>
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            Dia da meta: <strong>{formatIsoDatePtBR(ev.target.targetDate)}</strong>
            {ev.target.notes ? ` • ${ev.target.notes}` : ''}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(ev.target.id)}
          className="h-8 w-8 text-slate-400 hover:text-rose-500 shrink-0"
          title="Excluir meta de data"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
        <div className="rounded-xl bg-white/80 dark:bg-zinc-900/90 border border-slate-200/70 dark:border-zinc-800 p-2.5">
          <span className="text-slate-400 block text-[11px]">Planejado</span>
          <strong className="text-sm text-slate-900 dark:text-zinc-100">
            {formatCentsToBRL(ev.target.plannedBalanceInCents, hideValues)}
          </strong>
        </div>
        <div className="rounded-xl bg-white/80 dark:bg-zinc-900/90 border border-slate-200/70 dark:border-zinc-800 p-2.5">
          <span className="text-slate-400 block text-[11px]">
            {ev.isDue ? 'Saldo Real' : 'Estimado p/ o Dia'}
          </span>
          <strong className="text-sm text-indigo-600 dark:text-indigo-400">
            {formatCentsToBRL(
              ev.isDue ? ev.actualBalanceInCents : ev.projectedBalanceAtTargetInCents,
              hideValues
            )}
          </strong>
        </div>
        <div className="rounded-xl bg-white/80 dark:bg-zinc-900/90 border border-slate-200/70 dark:border-zinc-800 p-2.5">
          <span className="text-slate-400 block text-[11px]">Diferença</span>
          <strong
            className={`text-sm ${
              diffValue >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {diffValue > 0 ? '+' : ''}
            {formatCentsToBRL(diffValue, hideValues)}
          </strong>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-300">
        {ev.verificationStatus === 'EXACT' && (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Na data definida, seu saldo ficou exatamente igual ao planejado.</span>
          </>
        )}
        {ev.verificationStatus === 'ABOVE' && (
          <>
            <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>
              Na data definida, seu saldo ficou{' '}
              <strong>+{formatCentsToBRL(ev.actualDiffInCents, hideValues)}</strong> acima do planejado.
            </span>
          </>
        )}
        {ev.verificationStatus === 'BELOW' && (
          <>
            <TrendingDown className="h-4 w-4 text-rose-500 shrink-0" />
            <span>
              Na data definida, seu saldo ficou{' '}
              <strong>{formatCentsToBRL(Math.abs(ev.actualDiffInCents), hideValues)}</strong> abaixo do planejado.
            </span>
          </>
        )}
        {ev.verificationStatus === 'PENDING' && (
          <span>
            Considerando seu saldo atual e {ev.includedItemsCount}{' '}
            {ev.includedItemsCount === 1 ? 'previsão' : 'previsões'} até esta data.
          </span>
        )}
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';
import type { MonthlyRuleExecutionStatus } from '@/features/planning/domain/recurrence-month-skip';

interface StaticRuleStatusCellProps {
  execStatus: MonthlyRuleExecutionStatus;
  shortDueDate: string;
  nextMonthLabel: string;
}

export function StaticRuleStatusCell({
  execStatus,
  shortDueDate,
  nextMonthLabel,
}: StaticRuleStatusCellProps) {
  if (execStatus === 'SKIPPED') {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
          Não conta neste mês
        </span>
        <span className="text-[11px] text-slate-400 dark:text-zinc-500 whitespace-nowrap pl-3">
          Volta em {nextMonthLabel}
        </span>
      </div>
    );
  }

  if (execStatus === 'PAID') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
        Já caiu no mês
      </span>
    );
  }

  if (execStatus === 'OVERDUE') {
    return (
      <span
        title={`Venceu em ${shortDueDate} e já está contabilizado neste mês`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
        Contabilizado
        <span className="text-[11px] font-normal text-slate-400 dark:text-zinc-500">
          • {shortDueDate}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-zinc-600 shrink-0" />
      Previsto
      <span className="text-[11px] text-slate-400 dark:text-zinc-500">• {shortDueDate}</span>
    </span>
  );
}

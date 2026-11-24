'use client';

import * as React from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';

export interface TransactionCategoryCellProps {
  categoryName?: string | null;
  categoryColor?: string | null;
  nature: string;
  isUserConfirmed?: boolean;
  isAiClassified?: boolean;
  layout?: 'stacked' | 'inline';
}

export function TransactionCategoryCell({
  categoryName,
  categoryColor,
  nature,
  isUserConfirmed,
  isAiClassified,
  layout = 'stacked',
}: TransactionCategoryCellProps) {
  const dotColor = categoryName ? categoryColor || '#64748b' : '#f59e0b';

  const categoryLabel = (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: dotColor }}
        aria-hidden="true"
      />
      <span
        className={`text-xs font-medium truncate whitespace-nowrap ${
          categoryName
            ? 'text-slate-800 dark:text-zinc-200'
            : 'text-amber-600 dark:text-amber-400'
        }`}
      >
        {categoryName || 'Sem Categoria'}
      </span>
    </div>
  );

  const metaRow = (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <Badge
        variant={nature === 'STATIC' ? 'static' : 'variable'}
        className="px-2 py-0 text-[11px] leading-[18px]"
      >
        {nature === 'STATIC' ? 'Estático' : 'Variável'}
      </Badge>
      {isUserConfirmed ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          Confirmado
        </span>
      ) : isAiClassified ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
          <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
          IA
        </span>
      ) : null}
    </div>
  );

  if (layout === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        {categoryLabel}
        {metaRow}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {categoryLabel}
      {metaRow}
    </div>
  );
}

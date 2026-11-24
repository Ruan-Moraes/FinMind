'use client';

import * as React from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { formatCentsToBRL } from '@/shared/lib/currency';
import { setRecurrenceRuleMonthOverrideAction } from '@/features/planning/actions/recurrence-categories.actions';

interface Props {
  ruleId: string;
  ruleType: string;
  baseAmountInCents: number;
  effectiveAmountInCents: number;
  hasOverride: boolean;
  isSkipped: boolean;
  selectedMonth: number;
  selectedYear: number;
  hideValues: boolean;
  onSaved: () => void;
  align?: 'right' | 'left' | 'center';
  isEditing?: boolean;
  onStartEdit?: () => void;
  onStopEdit?: () => void;
}

export function StaticRuleMonthAmountCell({
  ruleId,
  ruleType,
  baseAmountInCents,
  effectiveAmountInCents,
  hasOverride,
  isSkipped,
  selectedMonth,
  selectedYear,
  hideValues,
  onSaved,
  align = 'right',
  isEditing,
  onStartEdit,
  onStopEdit,
}: Props) {
  const [internalEditing, setInternalEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const wasEditingRef = React.useRef(false);

  const editing = isEditing !== undefined ? isEditing : internalEditing;

  React.useEffect(() => {
    if (editing && !wasEditingRef.current) {
      setDraft((effectiveAmountInCents / 100).toFixed(2).replace('.', ','));
      setErrorMsg(null);
    }
    wasEditingRef.current = editing;
  }, [editing, effectiveAmountInCents]);

  const openEditor = () => {
    setDraft((effectiveAmountInCents / 100).toFixed(2).replace('.', ','));
    setErrorMsg(null);
    if (onStartEdit) onStartEdit();
    else setInternalEditing(true);
  };

  const closeEditor = () => {
    setErrorMsg(null);
    if (onStopEdit) onStopEdit();
    else setInternalEditing(false);
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await setRecurrenceRuleMonthOverrideAction({
        id: ruleId,
        month: selectedMonth,
        year: selectedYear,
        amountRaw: draft,
      });
      if (res.ok) {
        closeEditor();
        onSaved();
      } else {
        setErrorMsg(res.error || 'Valor inválido.');
      }
    } catch {
      setErrorMsg('Erro ao salvar valor.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToBase = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await setRecurrenceRuleMonthOverrideAction({
        id: ruleId,
        month: selectedMonth,
        year: selectedYear,
        amountRaw: null,
      });
      if (res.ok) {
        closeEditor();
        onSaved();
      } else {
        setErrorMsg(res.error || 'Não foi possível restaurar.');
      }
    } catch {
      setErrorMsg('Erro ao restaurar valor.');
    } finally {
      setIsSaving(false);
    }
  };

  const formJustify =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';
  const stackAlign =
    align === 'center' ? 'items-center text-center' : align === 'right' ? 'items-end' : 'items-start';

  if (editing) {
    return (
      <div className={`flex flex-col ${stackAlign} gap-1`}>
        <form
          onSubmit={(e) => void handleSave(e)}
          className={`flex items-center gap-1 ${formJustify}`}
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeEditor();
            }}
            aria-label="Valor ajustado para este mês"
            placeholder="0,00"
            autoFocus
            className="w-24 h-7 px-2 rounded-lg border border-indigo-400 dark:border-indigo-600 bg-white dark:bg-zinc-900 text-xs font-semibold tabular-nums text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          <button
            type="submit"
            disabled={isSaving}
            title="Salvar valor apenas para este mês"
            aria-label="Salvar valor do mês"
            className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          {hasOverride && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleResetToBase()}
              title="Voltar ao valor padrão mensal"
              aria-label="Restaurar valor padrão"
              className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 hover:text-amber-500"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={closeEditor}
            title="Cancelar"
            aria-label="Cancelar ajuste do mês"
            className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
        {errorMsg && (
          <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
            {errorMsg}
          </span>
        )}
      </div>
    );
  }

  const amountColor = isSkipped
    ? 'line-through text-slate-400 dark:text-zinc-500'
    : ruleType === 'INCOME'
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-600 dark:text-rose-400';

  return (
    <div className={`flex flex-col ${stackAlign} gap-0.5`}>
      {isSkipped ? (
        <span className={`font-semibold tabular-nums whitespace-nowrap ${amountColor}`}>
          {ruleType === 'INCOME' ? '+' : '-'}
          {formatCentsToBRL(effectiveAmountInCents, hideValues)}
        </span>
      ) : (
        <button
          type="button"
          onClick={openEditor}
          title="Clique para ajustar o valor apenas neste mês"
          aria-label="Ajustar valor neste mês"
          className={`font-semibold tabular-nums whitespace-nowrap rounded-lg px-2 py-0.5 ${
            align === 'right' ? '-mr-2' : align === 'left' ? '-ml-2' : ''
          } hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer ${amountColor}`}
        >
          {ruleType === 'INCOME' ? '+' : '-'}
          {formatCentsToBRL(effectiveAmountInCents, hideValues)}
        </button>
      )}

      {hasOverride && !isSkipped && (
        <span className="text-[11px] text-indigo-600 dark:text-indigo-400 tabular-nums whitespace-nowrap">
          Ajustado no mês • base {formatCentsToBRL(baseAmountInCents, hideValues)}
        </span>
      )}
    </div>
  );
}

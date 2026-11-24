'use client';

import * as React from 'react';
import { AlertCircle, CalendarOff, CheckCircle2, Loader2, RotateCcw, X } from 'lucide-react';
import { MONTH_NAMES_PT } from '@/shared/lib/currency';
import { toggleRecurrenceRuleSkipMonthAction } from '@/features/planning/actions/recurrence-categories.actions';
import { getNextMonthLabelPt } from '@/features/planning/domain/recurrence-month-skip';

export interface SkipMonthFeedbackState {
  kind: 'skipped' | 'restored' | 'error';
  ruleId?: string;
  ruleDescription?: string;
  month: number;
  year: number;
  message: string;
  detail?: string;
}

export function useStaticRuleSkipToggle(
  selectedMonth: number,
  selectedYear: number,
  onRefresh: () => void
) {
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<SkipMonthFeedbackState | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    setFeedback(null);
    clearTimer();
  }, [selectedMonth, selectedYear, clearTimer]);

  React.useEffect(() => () => clearTimer(), [clearTimer]);

  const scheduleAutoClear = React.useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setFeedback(null);
    }, 14000);
  }, [clearTimer]);

  const handleToggleSkip = React.useCallback(
    async (
      ruleId: string,
      ruleDescription: string,
      targetMonth = selectedMonth,
      targetYear = selectedYear
    ) => {
      setTogglingId(ruleId);
      clearTimer();
      try {
        const res = await toggleRecurrenceRuleSkipMonthAction({
          id: ruleId,
          month: targetMonth,
          year: targetYear,
        });

        if (!res.ok) {
          setFeedback({
            kind: 'error',
            ruleId,
            ruleDescription,
            month: targetMonth,
            year: targetYear,
            message: res.error || 'Não foi possível atualizar o status deste mês.',
          });
          scheduleAutoClear();
          return;
        }

        const currentLabel = `${MONTH_NAMES_PT[targetMonth - 1]}/${targetYear}`;
        const nextLabel = getNextMonthLabelPt(targetYear, targetMonth);
        const labelName = res.ruleDescription || ruleDescription;

        if (res.isSkipped) {
          setFeedback({
            kind: 'skipped',
            ruleId,
            ruleDescription: labelName,
            month: targetMonth,
            year: targetYear,
            message: `"${labelName}" foi pulado em ${currentLabel}.`,
            detail: `Não será contabilizado neste mês e volta automaticamente em ${nextLabel}.`,
          });
        } else {
          setFeedback({
            kind: 'restored',
            ruleId,
            ruleDescription: labelName,
            month: targetMonth,
            year: targetYear,
            message: `"${labelName}" foi reativado em ${currentLabel}.`,
            detail: 'O valor voltou a compor seu orçamento e suas projeções deste mês.',
          });
        }

        onRefresh();
        scheduleAutoClear();
      } catch {
        setFeedback({
          kind: 'error',
          ruleId,
          ruleDescription,
          month: targetMonth,
          year: targetYear,
          message: 'Erro de comunicação ao atualizar a regra fixa. Tente novamente.',
        });
        scheduleAutoClear();
      } finally {
        setTogglingId(null);
      }
    },
    [selectedMonth, selectedYear, onRefresh, clearTimer, scheduleAutoClear]
  );

  const handleUndo = React.useCallback(() => {
    if (!feedback?.ruleId || !feedback.ruleDescription) return;
    void handleToggleSkip(feedback.ruleId, feedback.ruleDescription, feedback.month, feedback.year);
  }, [feedback, handleToggleSkip]);

  const dismissFeedback = React.useCallback(() => {
    clearTimer();
    setFeedback(null);
  }, [clearTimer]);

  return { togglingId, feedback, handleToggleSkip, handleUndo, dismissFeedback };
}

interface BannerProps {
  feedback: SkipMonthFeedbackState | null;
  isUndoing: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}

export function StaticRuleSkipFeedbackBanner({
  feedback,
  isUndoing,
  onUndo,
  onDismiss,
}: BannerProps) {
  if (!feedback) return null;

  const isError = feedback.kind === 'error';
  const isSkipped = feedback.kind === 'skipped';

  const containerTone = isError
    ? 'border-rose-300/80 dark:border-rose-500/40 bg-rose-50/90 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
    : isSkipped
    ? 'border-amber-300/80 dark:border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/35 text-amber-900 dark:text-amber-100'
    : 'border-emerald-300/80 dark:border-emerald-500/40 bg-emerald-50/90 dark:bg-emerald-950/35 text-emerald-900 dark:text-emerald-100';

  const iconTone = isError
    ? 'text-rose-600 dark:text-rose-400'
    : isSkipped
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="static-rule-skip-feedback"
      className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm transition-all ${containerTone}`}
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
        {isError ? (
          <AlertCircle className={`h-4 w-4 shrink-0 mt-0.5 sm:mt-0 ${iconTone}`} />
        ) : isSkipped ? (
          <CalendarOff className={`h-4 w-4 shrink-0 mt-0.5 sm:mt-0 ${iconTone}`} />
        ) : (
          <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 sm:mt-0 ${iconTone}`} />
        )}
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold leading-snug">{feedback.message}</p>
          {feedback.detail && (
            <p className="text-[11px] opacity-85 leading-snug">{feedback.detail}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {!isError && feedback.ruleId && (
          <button
            type="button"
            disabled={isUndoing}
            onClick={onUndo}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border border-current/25 bg-white/80 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-900 font-semibold text-[11px] transition-colors disabled:opacity-50"
          >
            {isUndoing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            <span>Desfazer</span>
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

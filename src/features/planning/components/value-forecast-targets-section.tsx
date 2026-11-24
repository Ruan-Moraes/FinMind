'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck2, Plus, Sparkles } from 'lucide-react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { formatCentsToBRL } from '@/shared/lib/currency';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { EvaluatedBalanceTarget } from '@/features/planning/domain/value-forecast-calculator';
import {
  createBalanceTargetCheckAction,
  deleteBalanceTargetCheckAction,
} from '@/features/planning/actions/value-forecast.actions';
import { ValueForecastTargetCard } from '@/features/planning/components/value-forecast-target-card';

interface Props {
  evaluatedTargets: EvaluatedBalanceTarget[];
  projectedFinalBalanceInCents: number;
  hideValues: boolean;
}

export function ValueForecastTargetsSection({
  evaluatedTargets,
  projectedFinalBalanceInCents,
  hideValues,
}: Props) {
  const router = useRouter();
  const { wb } = useWorkbench();
  const { setPendingDelete } = wb;
  const [title, setTitle] = React.useState('');
  const [plannedBalanceRaw, setPlannedBalanceRaw] = React.useState('');
  const [targetDate, setTargetDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    const res = await createBalanceTargetCheckAction({
      title,
      plannedBalanceRaw,
      targetDate,
      notes,
    });
    setIsSaving(false);
    if (!res.ok) {
      setError(res.error || 'Não foi possível salvar a meta.');
      return;
    }
    setTitle('');
    setPlannedBalanceRaw('');
    setNotes('');
    router.refresh();
  };

  const handleRequestDelete = (id: string) => {
    const found = evaluatedTargets.find((e) => e.target.id === id);
    setPendingDelete({
      title: 'Excluir Meta de Saldo por Data',
      entityName: found
        ? `${found.target.title} (${formatCentsToBRL(found.target.plannedBalanceInCents, false)})`
        : 'Meta de Saldo',
      description:
        'Tem certeza que deseja excluir esta meta de saldo por data? O acompanhamento desta data será removido.',
      confirmLabel: 'Sim, Excluir Meta',
      onConfirm: async () => {
        await deleteBalanceTargetCheckAction(id);
        router.refresh();
        return { ok: true };
      },
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60 p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
            <CalendarCheck2 className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-zinc-100">
                Metas de Saldo por Data
              </h2>
              <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-300">
                Verificação no dia
              </span>
              {evaluatedTargets.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-slate-200/70 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-zinc-300 tabular-nums">
                  {evaluatedTargets.length} {evaluatedTargets.length === 1 ? 'meta' : 'metas'}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-3xl">
              Defina o saldo que você planeja alcançar em um dia específico. Na data escolhida, comparamos automaticamente com o seu saldo real.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-5 shadow-sm space-y-4"
      >
        {error && (
          <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="flex flex-col gap-1.5 min-w-0">
            <label htmlFor="target-title" className="h-5 flex items-center text-xs font-medium text-slate-700 dark:text-zinc-300 truncate">
              Nome da meta
            </label>
            <Input id="target-title" placeholder="Ex: Saldo após freela" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2 h-5">
              <label htmlFor="target-amount" className="text-xs font-medium text-slate-700 dark:text-zinc-300 truncate">
                Saldo planejado
              </label>
              {projectedFinalBalanceInCents > 0 && (
                <button
                  type="button"
                  onClick={() => setPlannedBalanceRaw((projectedFinalBalanceInCents / 100).toFixed(2).replace('.', ','))}
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-500/15 px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition-colors shrink-0"
                  title={`Preencher com saldo projetado (${formatCentsToBRL(projectedFinalBalanceInCents, hideValues)})`}
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Usar projetado</span>
                </button>
              )}
            </div>
            <Input id="target-amount" inputMode="decimal" prefixText="R$" tabular placeholder="5.000,00" value={plannedBalanceRaw} onChange={(e) => setPlannedBalanceRaw(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <label htmlFor="target-date" className="h-5 flex items-center text-xs font-medium text-slate-700 dark:text-zinc-300 truncate">
              Dia da meta
            </label>
            <Input id="target-date" type="date" tabular value={targetDate} onChange={(e) => setTargetDate(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2 h-5">
              <label htmlFor="target-notes" className="text-xs font-medium text-slate-700 dark:text-zinc-300 truncate">
                Observação
              </label>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 shrink-0">Opcional</span>
            </div>
            <Input id="target-notes" placeholder="Ex: Com 13º e freela" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t border-slate-100 dark:border-zinc-800/80">
          <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
            {projectedFinalBalanceInCents > 0 ? (
              <>
                <Sparkles className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <span>
                  Saldo projetado atual:{' '}
                  <strong className="font-semibold text-slate-700 dark:text-zinc-200 tabular-nums">
                    {formatCentsToBRL(projectedFinalBalanceInCents, hideValues)}
                  </strong>
                </span>
              </>
            ) : (
              <span>A verificação acontece automaticamente quando chegar a data escolhida.</span>
            )}
          </p>
          <Button
            data-agent-id="forecast.btn.addTarget"
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSaving}
            className="w-full sm:w-auto shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar Meta de Data</span>
          </Button>
        </div>
      </form>

      {evaluatedTargets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 px-6 py-8 flex flex-col items-center justify-center text-center gap-2">
          <div className="h-10 w-10 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <CalendarCheck2 className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">
            Nenhuma meta de saldo por data cadastrada
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md">
            Crie uma meta acima para acompanhar automaticamente se o seu saldo atingiu o valor planejado no dia escolhido.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {evaluatedTargets.map((ev) => (
            <ValueForecastTargetCard
              key={ev.target.id}
              evaluation={ev}
              hideValues={hideValues}
              onDelete={handleRequestDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

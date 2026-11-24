'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck2, Plus } from 'lucide-react';
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
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CalendarCheck2 className="h-5 w-5 text-indigo-500 shrink-0" />
          Metas de Saldo por Data (Verificação no Dia)
        </h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Defina o saldo que você planeja alcançar em um dia específico. Quando bater a data, verificamos automaticamente se o seu saldo real ficou igual, maior ou menor do que o planejado.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3"
      >
        {error && (
          <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label htmlFor="target-title" className="text-xs font-medium text-slate-600 dark:text-zinc-300">
              Nome da meta
            </label>
            <Input
              id="target-title"
              placeholder="Ex: Saldo após freela"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <label htmlFor="target-amount" className="text-xs font-medium text-slate-600 dark:text-zinc-300">
                Saldo planejado (R$)
              </label>
              {projectedFinalBalanceInCents > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setPlannedBalanceRaw(
                      (projectedFinalBalanceInCents / 100).toFixed(2).replace('.', ',')
                    )
                  }
                  className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Usar projetado
                </button>
              )}
            </div>
            <Input
              id="target-amount"
              inputMode="decimal"
              placeholder="Ex: 5.000,00"
              value={plannedBalanceRaw}
              onChange={(e) => setPlannedBalanceRaw(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="target-date" className="text-xs font-medium text-slate-600 dark:text-zinc-300">
              Dia da meta
            </label>
            <Input
              id="target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="target-notes" className="text-xs font-medium text-slate-600 dark:text-zinc-300">
              Observação (opcional)
            </label>
            <Input
              id="target-notes"
              placeholder="Ex: Com 13º e freela"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
            <Plus className="h-4 w-4" />
            <span>Adicionar Meta de Data</span>
          </Button>
        </div>
      </form>

      {evaluatedTargets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-6 text-center text-xs text-slate-500 dark:text-zinc-400">
          Nenhuma meta de saldo por data cadastrada ainda. Crie uma acima para acompanhar se seu saldo bateu o planejado no dia escolhido.
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
    </div>
  );
}

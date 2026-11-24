'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownCircle, ArrowUpCircle, CalendarClock, Plus, Trash2 } from 'lucide-react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { formatCentsToBRL } from '@/shared/lib/currency';
import {
  formatIsoDatePtBR,
  SerializedValueForecastItem,
} from '@/features/planning/domain/value-forecast-calculator';
import {
  createValueForecastItemAction,
  deleteValueForecastItemAction,
} from '@/features/planning/actions/value-forecast.actions';

interface Props {
  items: SerializedValueForecastItem[];
  hideValues: boolean;
}

export function ValueForecastItemsSection({ items, hideValues }: Props) {
  const router = useRouter();
  const { wb } = useWorkbench();
  const { setPendingDelete } = wb;
  const [type, setType] = React.useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [title, setTitle] = React.useState('');
  const [amountRaw, setAmountRaw] = React.useState('');
  const [expectedDate, setExpectedDate] = React.useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    const res = await createValueForecastItemAction({
      type,
      title,
      amountRaw,
      expectedDate,
      notes,
    });
    setIsSaving(false);
    if (!res.ok) {
      setError(res.error || 'Não foi possível salvar a previsão.');
      return;
    }
    setTitle('');
    setAmountRaw('');
    setNotes('');
    router.refresh();
  };

  const handleRequestDelete = (item: SerializedValueForecastItem) => {
    setPendingDelete({
      title: 'Excluir Previsão de Valor',
      entityName: `${item.title} (${item.type === 'INCOME' ? '+' : '-'}${formatCentsToBRL(
        item.amountInCents,
        false
      )})`,
      description:
        'Tem certeza que deseja excluir esta previsão? O saldo projetado será recalculado imediatamente.',
      confirmLabel: 'Sim, Excluir Previsão',
      onConfirm: async () => {
        await deleteValueForecastItemAction(item.id);
        router.refresh();
        return { ok: true };
      },
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-emerald-500 shrink-0" />
          Previsões de Ganhos & Gastos
        </h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Cadastre o que você prevê receber e o que provavelmente vai gastar para projetar o seu saldo futuro.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3"
      >
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-slate-600 dark:text-zinc-300 block">
            Tipo de previsão
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              data-agent-id="forecast.btn.addIncome"
              onClick={() => setType('INCOME')}
              className={`flex items-center justify-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                type === 'INCOME'
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500 shadow-sm'
                  : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:border-emerald-300 dark:hover:border-emerald-800'
              }`}
            >
              <ArrowUpCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              <span>Vou Ganhar</span>
            </button>
            <button
              type="button"
              data-agent-id="forecast.btn.addExpense"
              onClick={() => setType('EXPENSE')}
              className={`flex items-center justify-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                type === 'EXPENSE'
                  ? 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500 shadow-sm'
                  : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:border-rose-300 dark:hover:border-rose-800'
              }`}
            >
              <ArrowDownCircle className="h-5 w-5 text-rose-500 shrink-0" />
              <span>Provável Gasto</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label htmlFor="forecast-title" className="text-xs font-medium text-slate-600 dark:text-zinc-300">
              Descrição
            </label>
            <Input
              id="forecast-title"
              placeholder={type === 'INCOME' ? 'Ex: Freela, 13º, Bônus' : 'Ex: IPVA, Viagem, Troca de pneu'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="forecast-amount" className="text-xs font-medium text-slate-600 dark:text-zinc-300">
              Valor previsto (R$)
            </label>
            <Input
              id="forecast-amount"
              inputMode="decimal"
              placeholder="Ex: 1.200,00"
              value={amountRaw}
              onChange={(e) => setAmountRaw(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="forecast-date" className="text-xs font-medium text-slate-600 dark:text-zinc-300">
              Data prevista
            </label>
            <Input
              id="forecast-date"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="forecast-notes" className="text-xs font-medium text-slate-600 dark:text-zinc-300">
              Observação (opcional)
            </label>
            <Input
              id="forecast-notes"
              placeholder="Detalhes opcionais"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
            <Plus className="h-4 w-4" />
            <span>{type === 'INCOME' ? 'Adicionar Ganho Previsto' : 'Adicionar Gasto Previsto'}</span>
          </Button>
        </div>
      </form>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-6 text-center text-xs text-slate-500 dark:text-zinc-400">
          Nenhuma previsão de ganho ou gasto cadastrada ainda.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-slate-200 dark:divide-zinc-800">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm tabular-nums"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant={item.type === 'INCOME' ? 'income' : 'expense'}>
                  {item.type === 'INCOME' ? 'Ganho' : 'Gasto'}
                </Badge>
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-zinc-100 truncate">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400">
                    Previsto para {formatIsoDatePtBR(item.expectedDate)}
                    {item.notes ? ` • ${item.notes}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <strong
                  className={
                    item.type === 'INCOME'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }
                >
                  {item.type === 'INCOME' ? '+' : '-'}
                  {formatCentsToBRL(item.amountInCents, hideValues)}
                </strong>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRequestDelete(item)}
                  className="h-8 w-8 text-slate-400 hover:text-rose-500"
                  title="Excluir previsão"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Input, Select, Switch } from '@/shared/ui/input';
import type { HolidayRecord } from '@/features/planning/domain/business-days';

interface Props {
  year: number;
  holidays: HolidayRecord[];
  onAddManual: (item: {
    date: string;
    name: string;
    scope: 'NATIONAL' | 'STATE' | 'MUNICIPAL';
  }) => Promise<void>;
  onToggleActive: (id: string, next: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const SCOPE_META: Record<string, { label: string; variant: 'neutral' | 'transfer' | 'income' }> = {
  NATIONAL: { label: 'Nacional', variant: 'neutral' },
  STATE: { label: 'Estadual', variant: 'transfer' },
  MUNICIPAL: { label: 'Municipal', variant: 'income' },
};

function formatDateBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function HolidaysManagerList({
  year,
  holidays,
  onAddManual,
  onToggleActive,
  onDelete,
}: Props) {
  const [manualDate, setManualDate] = React.useState(`${year}-01-01`);
  const [manualName, setManualName] = React.useState('');
  const [manualScope, setManualScope] = React.useState<'NATIONAL' | 'STATE' | 'MUNICIPAL'>(
    'MUNICIPAL'
  );
  const [isSavingManual, setIsSavingManual] = React.useState(false);

  React.useEffect(() => {
    setManualDate((prev) => (prev.startsWith(`${year}-`) ? prev : `${year}-01-01`));
  }, [year]);

  const yearHolidays = React.useMemo(
    () => holidays.filter((h) => h.year === year).sort((a, b) => a.date.localeCompare(b.date)),
    [holidays, year]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualDate) return;
    setIsSavingManual(true);
    try {
      await onAddManual({ date: manualDate, name: manualName.trim(), scope: manualScope });
      setManualName('');
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 p-3.5 space-y-3"
      >
        <div className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
          Adicionar Feriado Manual (Municipal, Estadual ou Recesso)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          <div className="sm:col-span-3">
            <Input
              type="date"
              aria-label="Data do feriado"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-4">
            <Input
              placeholder="Ex: Aniversário da Cidade"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-3">
            <Select
              aria-label="Abrangência do feriado"
              value={manualScope}
              onChange={(e) =>
                setManualScope(e.target.value as 'NATIONAL' | 'STATE' | 'MUNICIPAL')
              }
            >
              <option value="MUNICIPAL">Municipal</option>
              <option value="STATE">Estadual</option>
              <option value="NATIONAL">Nacional</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSavingManual}
              className="w-full h-11"
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar</span>
            </Button>
          </div>
        </div>
      </form>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
          <span>
            Feriados cadastrados em <strong>{year}</strong> ({yearHolidays.length})
          </span>
          <span className="text-[11px]">Desative um feriado para não pulá-lo nos dias úteis</span>
        </div>

        {yearHolidays.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-6 text-center text-xs text-slate-400">
            Nenhum feriado salvo para {year}. Clique em &ldquo;Sincronizar Feriados (2026–2028)&rdquo; acima ou adicione manualmente.
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-slate-200 dark:divide-zinc-800">
            {yearHolidays.map((h) => {
              const meta = SCOPE_META[h.scope] || SCOPE_META.NATIONAL;
              return (
                <div
                  key={h.id}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs ${
                    h.isActive ? '' : 'opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono font-semibold text-slate-700 dark:text-zinc-300 shrink-0 tabular-nums">
                      {formatDateBr(h.date)}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-zinc-100 truncate">
                      {h.name}
                    </span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={h.isActive}
                      onCheckedChange={(checked) => void onToggleActive(h.id, checked)}
                      label={`Ativar ${h.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => void onDelete(h.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
                      title="Excluir feriado"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

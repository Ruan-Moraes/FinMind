'use client';

import * as React from 'react';
import { Calendar, ChevronRight, MapPin } from 'lucide-react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { FormField, Input, Select } from '@/shared/ui/input';
import { BRAZIL_STATES } from '@/features/planning/domain/brazil-holidays-catalog';

interface Props {
  holidayState: string;
  setHolidayState: (val: string) => void;
  holidayCity: string;
  setHolidayCity: (val: string) => void;
  onOpenHolidaysModal: () => void;
}

export function HolidaysSettingsCard({
  holidayState,
  setHolidayState,
  holidayCity,
  setHolidayCity,
  onOpenHolidaysModal,
}: Props) {
  const { props } = useWorkbench();

  const activeHolidaysCount = React.useMemo(
    () => (props.holidays || []).filter((h) => h.isActive).length,
    [props.holidays]
  );

  const countLabel =
    activeHolidaysCount === 0
      ? 'Nenhum feriado sincronizado'
      : activeHolidaysCount === 1
      ? '1 feriado ativo'
      : `${activeHolidaysCount} feriados ativos`;

  const locationSummary = holidayState
    ? holidayCity.trim()
      ? `${holidayCity.trim()} (${holidayState})`
      : `Estado ${holidayState}`
    : 'Apenas feriados nacionais';

  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-zinc-800/90 bg-slate-50/50 dark:bg-zinc-950/70 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3.5">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
            <MapPin className="h-4.5 w-4.5" />
          </div>
          <div className="space-y-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 leading-snug">
              Localização & Calendário de Feriados (Dias Úteis)
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Define seu Estado e Cidade para calcular vencimentos por dias úteis (ex: 5º dia útil) nos Custos e Ganhos Estáticos.
            </p>
          </div>
        </div>

        <button
          type="button"
          data-agent-id="modal.settings.btn.holidays"
          onClick={onOpenHolidaysModal}
          className="inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl border border-indigo-500/35 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-all whitespace-nowrap shrink-0 self-start sm:self-center"
        >
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>Calendário de Feriados</span>
          <ChevronRight className="h-3.5 w-3.5 opacity-75 shrink-0" />
        </button>
      </div>

      <div className="border-t border-slate-200/70 dark:border-zinc-800/80 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Estado (UF)" hint="Feriados estaduais">
          <div data-agent-id="modal.settings.select.state">
            <Select
              value={holidayState}
              onChange={(e) => setHolidayState(e.target.value)}
              aria-label="Estado para feriados"
            >
              <option value="">Apenas Nacionais</option>
              {BRAZIL_STATES.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.name} ({st.code})
                </option>
              ))}
            </Select>
          </div>
        </FormField>

        <FormField label="Cidade" hint="Feriados municipais">
          <Input
            data-agent-id="modal.settings.input.city"
            placeholder="Ex: Belo Horizonte"
            value={holidayCity}
            onChange={(e) => setHolidayCity(e.target.value)}
            aria-label="Cidade para feriados municipais"
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/75 dark:bg-zinc-900/60 px-3.5 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-zinc-300">
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              activeHolidaysCount > 0 ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="font-semibold text-slate-900 dark:text-zinc-100 tabular-nums">
            {countLabel}
          </span>
          <span className="text-slate-400 dark:text-zinc-600">•</span>
          <span className="text-slate-500 dark:text-zinc-400">{locationSummary}</span>
        </div>

        <button
          type="button"
          onClick={onOpenHolidaysModal}
          className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Sincronizar / editar lista →
        </button>
      </div>
    </div>
  );
}

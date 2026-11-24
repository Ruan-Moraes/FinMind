'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, RefreshCw, Sparkles } from 'lucide-react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { Modal } from '@/shared/ui/modal';
import { Button } from '@/shared/ui/button';
import { FormField, Input, Select } from '@/shared/ui/input';
import {
  BRAZIL_STATES,
  type HolidaySeedItem,
} from '@/features/planning/domain/brazil-holidays-catalog';
import {
  deleteHolidayAction,
  saveHolidaysBatchAction,
  suggestMunicipalHolidaysWithAiAction,
  syncOfficialHolidaysAction,
  toggleHolidayActiveAction,
} from '@/features/planning/actions/holidays.actions';
import { HolidaysManagerList } from '@/features/planning/components/holidays-manager-list';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  draftStateCode?: string;
  draftCityName?: string;
}

export function HolidaysManagerModal({ isOpen, onClose, draftStateCode, draftCityName }: Props) {
  const router = useRouter();
  const { props } = useWorkbench();
  const { selectedYear, settings, holidays = [] } = props;

  const [year, setYear] = React.useState(selectedYear);
  const [stateCode, setStateCode] = React.useState(draftStateCode ?? settings.holidayState ?? '');
  const [cityName, setCityName] = React.useState(draftCityName ?? settings.holidayCity ?? '');
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isAskingAi, setIsAskingAi] = React.useState(false);
  const [isSavingAi, setIsSavingAi] = React.useState(false);
  const [banner, setBanner] = React.useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [aiSuggestions, setAiSuggestions] = React.useState<HolidaySeedItem[]>([]);
  const [selectedAiDates, setSelectedAiDates] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!isOpen) return;
    setYear(selectedYear);
    setStateCode(draftStateCode !== undefined ? draftStateCode : settings.holidayState || '');
    setCityName(draftCityName !== undefined ? draftCityName : settings.holidayCity || '');
    setBanner(null);
    setAiSuggestions([]);
  }, [isOpen, selectedYear, settings.holidayState, settings.holidayCity, draftStateCode, draftCityName]);

  const handleSyncOfficial = async () => {
    setIsSyncing(true);
    setBanner(null);
    try {
      const yearsToSync = Array.from(new Set([year, 2026, 2027, 2028]));
      const res = await syncOfficialHolidaysAction({
        years: yearsToSync, stateCode: stateCode || null, cityName: cityName || null,
      });
      if (res.ok) {
        setBanner({
          type: 'ok',
          text: `${res.syncedCount} feriados nacionais${stateCode ? ` e estaduais (${stateCode})` : ''} sincronizados para ${yearsToSync.sort().join(', ')}.`,
        });
        router.refresh();
      } else {
        setBanner({ type: 'err', text: res.error || 'Falha ao sincronizar feriados.' });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSuggestMunicipalAi = async () => {
    setIsAskingAi(true);
    setBanner(null);
    setAiSuggestions([]);
    try {
      const res = await suggestMunicipalHolidaysWithAiAction({ cityName, stateCode, year });
      if (!res.ok) {
        setBanner({ type: 'err', text: res.error || 'Não foi possível buscar feriados com IA.' });
        return;
      }
      const list = res.suggestions || [];
      if (list.length === 0) {
        setBanner({
          type: 'ok',
          text: `Nenhum feriado municipal adicional encontrado pela IA para ${cityName}/${stateCode} em ${year}. Cadastre manualmente abaixo.`,
        });
        return;
      }
      setAiSuggestions(list);
      const checked: Record<string, boolean> = {};
      for (const s of list) checked[`${s.date}::${s.name}`] = true;
      setSelectedAiDates(checked);
    } finally {
      setIsAskingAi(false);
    }
  };

  const handleConfirmAiSuggestions = async () => {
    const toSave = aiSuggestions.filter((s) => selectedAiDates[`${s.date}::${s.name}`]);
    if (toSave.length === 0) return;
    setIsSavingAi(true);
    try {
      const res = await saveHolidaysBatchAction(toSave);
      if (res.ok) {
        setAiSuggestions([]);
        setBanner({ type: 'ok', text: `${res.savedCount} feriado(s) municipal(is) salvo(s)!` });
        router.refresh();
      }
    } finally {
      setIsSavingAi(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title="Calendário de Feriados (Dias Úteis)"
      subtitle="Sincronize feriados nacionais (2026–2028), estaduais e municipais para calcular automaticamente o 5º dia útil e vencimentos."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Ano de Referência">
            <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
              {[2026, 2027, 2028, 2029].map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Estado (UF)">
            <Select value={stateCode} onChange={(e) => setStateCode(e.target.value)}>
              <option value="">Apenas Nacionais</option>
              {BRAZIL_STATES.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.name} ({st.code})
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Cidade (p/ feriados municipais)">
            <Input
              placeholder="Ex: Belo Horizonte"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
            />
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="primary" size="sm" isLoading={isSyncing} onClick={() => void handleSyncOfficial()}>
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sincronizar Nacionais + Estaduais (2026–2028)</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            isLoading={isAskingAi}
            onClick={() => void handleSuggestMunicipalAi()}
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span>Buscar Feriados da Cidade com IA ({year})</span>
          </Button>
        </div>

        {banner && (
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
              banner.type === 'ok'
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                : 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
            }`}
          >
            {banner.text}
          </div>
        )}

        {aiSuggestions.length > 0 && (
          <div className="rounded-xl border border-indigo-300 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 p-3.5 space-y-2.5">
            <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">
              Sugestões da IA para {cityName}/{stateCode} ({year}) — revise antes de salvar:
            </div>
            <div className="space-y-1.5">
              {aiSuggestions.map((s) => {
                const k = `${s.date}::${s.name}`;
                return (
                  <label key={k} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedAiDates[k])}
                      onChange={(e) =>
                        setSelectedAiDates((prev) => ({ ...prev, [k]: e.target.checked }))
                      }
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                    />
                    <span className="font-mono font-semibold">{s.date}</span>
                    <span>{s.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setAiSuggestions([])}>
                Descartar
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSavingAi}
                onClick={() => void handleConfirmAiSuggestions()}
              >
                <Check className="h-3.5 w-3.5" />
                <span>Salvar Selecionados</span>
              </Button>
            </div>
          </div>
        )}

        <HolidaysManagerList
          year={year}
          holidays={holidays}
          stateCode={stateCode}
          cityName={cityName}
          onAddManual={async (item) => {
            await saveHolidaysBatchAction([{ ...item, stateCode: stateCode || null, cityName: cityName || null, source: 'MANUAL' }]);
            router.refresh();
          }}
          onToggleActive={async (id, next) => { await toggleHolidayActiveAction(id, next); router.refresh(); }}
          onDelete={async (id) => { await deleteHolidayAction(id); router.refresh(); }}
        />
      </div>
    </Modal>
  );
}

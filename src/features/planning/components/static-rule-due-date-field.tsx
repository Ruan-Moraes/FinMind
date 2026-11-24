'use client';

import * as React from 'react';
import { Calendar, CalendarCheck2 } from 'lucide-react';
import { FormField, Input } from '@/shared/ui/input';
import { MONTH_NAMES_PT } from '@/shared/lib/currency';
import {
  computeNthBusinessDay,
  type HolidayRecord,
} from '@/features/planning/domain/business-days';

interface Props {
  ruleDay: number;
  setRuleDay: (d: number) => void;
  ruleDayType: 'CALENDAR_DAY' | 'BUSINESS_DAY';
  setRuleDayType: (t: 'CALENDAR_DAY' | 'BUSINESS_DAY') => void;
  ruleIncludeSaturday: boolean;
  setRuleIncludeSaturday: (v: boolean) => void;
  selectedMonth: number;
  selectedYear: number;
  holidays: HolidayRecord[];
}

export function StaticRuleDueDateField({
  ruleDay,
  setRuleDay,
  ruleDayType,
  setRuleDayType,
  ruleIncludeSaturday,
  setRuleIncludeSaturday,
  selectedMonth,
  selectedYear,
  holidays,
}: Props) {
  const isBusiness = ruleDayType === 'BUSINESS_DAY';

  const preview = React.useMemo(() => {
    if (!isBusiness) return null;
    return computeNthBusinessDay({
      year: selectedYear,
      month: selectedMonth,
      nthBusinessDay: ruleDay,
      holidays,
      includeSaturday: ruleIncludeSaturday,
    });
  }, [isBusiness, selectedYear, selectedMonth, ruleDay, holidays, ruleIncludeSaturday]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-slate-700 dark:text-zinc-300">
          Vencimento / Recebimento
        </span>
        <div className="inline-flex rounded-lg border border-slate-200 dark:border-zinc-800 p-0.5 bg-slate-100/70 dark:bg-zinc-900 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setRuleDayType('CALENDAR_DAY')}
            className={`px-2 py-1 rounded-md transition-colors ${
              !isBusiness
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm'
                : 'text-slate-500 dark:text-zinc-400'
            }`}
          >
            Dia Fixo
          </button>
          <button
            type="button"
            onClick={() => {
              setRuleDayType('BUSINESS_DAY');
              if (ruleDay > 23) setRuleDay(5);
            }}
            className={`px-2 py-1 rounded-md transition-colors ${
              isBusiness
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-zinc-400'
            }`}
          >
            Dia Útil
          </button>
        </div>
      </div>

      <FormField
        label={isBusiness ? 'Qual dia útil do mês?' : 'Dia do mês'}
        hint={isBusiness ? 'Ex: 5 = 5º dia útil' : '1 a 31'}
      >
        <Input
          type="number"
          min={1}
          max={isBusiness ? 23 : 31}
          tabular
          value={ruleDay}
          onChange={(e) => setRuleDay(Number(e.target.value))}
          required
        />
      </FormField>

      {isBusiness && preview && (
        <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-3 space-y-2 text-xs">
          <div className="flex items-start gap-2 text-indigo-900 dark:text-indigo-200">
            <CalendarCheck2 className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div>
                <strong>{ruleDay}º dia útil</strong> em {MONTH_NAMES_PT[selectedMonth - 1]}/
                {selectedYear}:{' '}
                <strong className="text-indigo-700 dark:text-indigo-300">
                  {preview.formattedDate} ({preview.weekdayFull})
                </strong>
              </div>
              {preview.skippedHolidays.length > 0 && (
                <div className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 flex items-center gap-1">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>
                    Pulou:{' '}
                    {preview.skippedHolidays.map((h) => `${h.name} (${h.date})`).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-zinc-300 cursor-pointer pt-1 border-t border-indigo-200/50 dark:border-indigo-900/40">
            <input
              type="checkbox"
              checked={ruleIncludeSaturday}
              onChange={(e) => setRuleIncludeSaturday(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Considerar sábado como dia útil (regra CLT)</span>
          </label>
        </div>
      )}
    </div>
  );
}

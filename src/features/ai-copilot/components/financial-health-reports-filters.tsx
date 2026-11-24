'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Input, Select } from '@/shared/ui/input';
import {
  type HealthReportsFilterState,
  type ProviderFilter,
  type ScoreFilter,
  type SortOrder,
} from '@/features/ai-copilot/domain/health-reports-filter';

export function FinancialHealthReportsFiltersBar(props: {
  filters: HealthReportsFilterState;
  onChange: (patch: Partial<HealthReportsFilterState>) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  totalCount: number;
  filteredCount: number;
  startIdx: number;
  pageSize: number;
}) {
  const {
    filters, onChange, onClear, hasActiveFilters,
    totalCount, filteredCount, startIdx, pageSize,
  } = props;

  return (
    <div className="rounded-xl border border-slate-200/90 dark:border-zinc-800/90 bg-white/80 dark:bg-zinc-950/60 p-3.5 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-2.5">
        <div className="lg:col-span-4 relative">
          <Search className="h-4 w-4 text-slate-400 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={filters.searchQuery}
            onChange={(e) => onChange({ searchQuery: e.target.value })}
            placeholder="Buscar no parecer, riscos ou plano..."
            aria-label="Buscar diagnósticos salvos"
            className="pl-10"
          />
        </div>
        <div className="lg:col-span-2">
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
            aria-label="Data inicial do diagnóstico"
            title="Data inicial"
          />
        </div>
        <div className="lg:col-span-2">
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
            aria-label="Data final do diagnóstico"
            title="Data final"
          />
        </div>
        <div className="lg:col-span-2">
          <Select
            value={filters.scoreFilter}
            onChange={(e) => onChange({ scoreFilter: e.target.value as ScoreFilter })}
            aria-label="Filtrar por saúde financeira"
          >
            <option value="ALL">Todas as Notas</option>
            <option value="HEALTHY">Saudável (80–100)</option>
            <option value="ATTENTION">Atenção (50–79)</option>
            <option value="CRITICAL">Crítico (&lt; 50)</option>
          </Select>
        </div>
        <div className="lg:col-span-2">
          <Select
            value={filters.providerFilter}
            onChange={(e) => onChange({ providerFilter: e.target.value as ProviderFilter })}
            aria-label="Filtrar por provedor de IA"
          >
            <option value="ALL">Todos os Provedores</option>
            <option value="OPENAI">OpenAI (ChatGPT)</option>
            <option value="GEMINI">Google Gemini</option>
            <option value="CLAUDE">Anthropic Claude</option>
            <option value="MOTOR_DETERMINISTICO">Motor Local</option>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-zinc-400">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular-nums">
            {filteredCount === 0
              ? 'Nenhum diagnóstico encontrado para os filtros aplicados'
              : `Mostrando ${startIdx + 1}–${Math.min(startIdx + pageSize, filteredCount)} de ${filteredCount} diagnóstico(s)`}
            {filteredCount !== totalCount ? ` (${totalCount} no total)` : ''}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 font-medium"
            >
              <X className="h-3 w-3" />
              Limpar filtros
            </button>
          )}
        </div>
        <div className="w-44">
          <Select
            value={filters.sortOrder}
            onChange={(e) => onChange({ sortOrder: e.target.value as SortOrder })}
            aria-label="Ordenar diagnósticos"
          >
            <option value="NEWEST">Mais recentes</option>
            <option value="OLDEST">Mais antigos</option>
            <option value="SCORE_DESC">Maior nota</option>
            <option value="SCORE_ASC">Menor nota</option>
          </Select>
        </div>
      </div>
    </div>
  );
}

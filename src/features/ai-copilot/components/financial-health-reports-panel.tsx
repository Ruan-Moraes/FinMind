'use client';

import * as React from 'react';
import { ShieldCheck, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  type AiPendingDeleteState,
  type SerializedAiReport,
} from '@/features/ai-copilot/components/ai-financial-hub';
import { FinancialHealthReportCard } from '@/features/ai-copilot/components/financial-health-report-card';
import { FinancialHealthReportsFiltersBar } from '@/features/ai-copilot/components/financial-health-reports-filters';
import {
  filterAndSortHealthReports,
  type HealthReportsFilterState,
} from '@/features/ai-copilot/domain/health-reports-filter';

const REPORTS_PER_PAGE = 4;

const INITIAL_FILTERS: HealthReportsFilterState = {
  searchQuery: '',
  dateFrom: '',
  dateTo: '',
  scoreFilter: 'ALL',
  providerFilter: 'ALL',
  sortOrder: 'NEWEST',
};

export function FinancialHealthReportsPanel(props: {
  isRunningAnalysis: boolean;
  statusAnalysisError: string | null;
  savedReports: SerializedAiReport[];
  handleGenerateStatusReport: () => void;
  setPendingDelete: (d: AiPendingDeleteState | null) => void;
}) {
  const {
    isRunningAnalysis, statusAnalysisError, savedReports,
    handleGenerateStatusReport, setPendingDelete,
  } = props;

  const [filters, setFilters] = React.useState<HealthReportsFilterState>(INITIAL_FILTERS);
  const [page, setPage] = React.useState(1);

  const hasActiveFilters = Boolean(
    filters.searchQuery.trim() ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.scoreFilter !== 'ALL' ||
      filters.providerFilter !== 'ALL'
  );

  const updateFilters = (patch: Partial<HealthReportsFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  const filteredReports = React.useMemo(
    () => filterAndSortHealthReports(savedReports, filters),
    [savedReports, filters]
  );

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / REPORTS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * REPORTS_PER_PAGE;
  const paginatedReports = filteredReports.slice(startIdx, startIdx + REPORTS_PER_PAGE);

  return (
    <div data-agent-id="ai.panel.healthReports" className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/70 p-6 space-y-5">
      <div className="w-full flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-500 shrink-0" />
            Diagnóstico de Status Financeiro & Plano de Ação IA
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Analisa sua Meta de Carteira, Renda Livre Estática, categoria que mais gastou e evolução entre os meses.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2.5 shrink-0 lg:ml-auto">
          <Button data-agent-id="ai.btn.generateHealth" variant="primary" size="md" onClick={handleGenerateStatusReport} isLoading={isRunningAnalysis}>
            <Sparkles className="h-4 w-4" />
            Gerar Diagnóstico do Meu Status Agora
          </Button>
        </div>
      </div>

      {statusAnalysisError && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-3.5 text-xs font-medium text-rose-700 dark:text-rose-300">
          {statusAnalysisError}
        </div>
      )}

      {savedReports.length > 0 && (
        <FinancialHealthReportsFiltersBar
          filters={filters}
          onChange={updateFilters}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
          totalCount={savedReports.length}
          filteredCount={filteredReports.length}
          startIdx={startIdx}
          pageSize={REPORTS_PER_PAGE}
        />
      )}

      <div className="space-y-4">
        {savedReports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-8 text-center text-sm text-slate-400">
            Clique em &ldquo;Gerar Diagnóstico do Meu Status Agora&rdquo; para receber uma análise completa da sua carteira e salvar no banco.
          </div>
        ) : paginatedReports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-8 text-center text-sm text-slate-500 dark:text-zinc-400 space-y-2">
            <div>Nenhum diagnóstico corresponde aos filtros de data, nota ou busca informados.</div>
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </div>
        ) : (
          paginatedReports.map((rep) => (
            <FinancialHealthReportCard key={rep.id} report={rep} setPendingDelete={setPendingDelete} />
          ))
        )}
      </div>

      {filteredReports.length > REPORTS_PER_PAGE && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
            Página {safePage} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage(Math.max(1, safePage - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { AI_PROVIDER_META, type AiProviderId } from '@/features/ai-copilot/providers';

export type ScoreFilter = 'ALL' | 'HEALTHY' | 'ATTENTION' | 'CRITICAL';
export type ProviderFilter = 'ALL' | 'OPENAI' | 'GEMINI' | 'CLAUDE' | 'MOTOR_DETERMINISTICO';
export type SortOrder = 'NEWEST' | 'OLDEST' | 'SCORE_DESC' | 'SCORE_ASC';

export interface HealthReportsFilterState {
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
  scoreFilter: ScoreFilter;
  providerFilter: ProviderFilter;
  sortOrder: SortOrder;
}

export interface HealthReportFilterable {
  id: string;
  provider: string;
  connectionMode: string;
  healthScore: number;
  summary: string;
  strengths: string[];
  risks: string[];
  actionPlan: string[];
  createdAt: string;
}

export function getHealthScoreBand(score: number): {
  key: 'HEALTHY' | 'ATTENTION' | 'CRITICAL';
  label: string;
  badgeVariant: 'income' | 'warning' | 'expense';
  boxClass: string;
} {
  if (score >= 80) {
    return {
      key: 'HEALTHY',
      label: 'Saudável',
      badgeVariant: 'income',
      boxClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    };
  }
  if (score >= 50) {
    return {
      key: 'ATTENTION',
      label: 'Atenção',
      badgeVariant: 'warning',
      boxClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    };
  }
  return {
    key: 'CRITICAL',
    label: 'Crítico',
    badgeVariant: 'expense',
    boxClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  };
}

export function toLocalDateKey(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function filterAndSortHealthReports<T extends HealthReportFilterable>(
  reports: T[],
  filters: HealthReportsFilterState
): T[] {
  const q = filters.searchQuery.trim().toLowerCase();
  const filtered = reports.filter((rep) => {
    if (
      filters.scoreFilter !== 'ALL' &&
      getHealthScoreBand(rep.healthScore).key !== filters.scoreFilter
    ) {
      return false;
    }
    if (filters.providerFilter !== 'ALL' && rep.provider !== filters.providerFilter) {
      return false;
    }
    const dateKey = toLocalDateKey(rep.createdAt);
    if (filters.dateFrom && dateKey && dateKey < filters.dateFrom) return false;
    if (filters.dateTo && dateKey && dateKey > filters.dateTo) return false;
    if (q) {
      const providerName = AI_PROVIDER_META[rep.provider as AiProviderId]?.name || rep.provider;
      const haystack = [rep.summary, providerName, ...rep.strengths, ...rep.risks, ...rep.actionPlan]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (filters.sortOrder === 'OLDEST') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (filters.sortOrder === 'SCORE_DESC') return b.healthScore - a.healthScore;
    if (filters.sortOrder === 'SCORE_ASC') return a.healthScore - b.healthScore;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

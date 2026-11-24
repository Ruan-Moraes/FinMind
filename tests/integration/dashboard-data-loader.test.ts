import { describe, it, expect } from 'vitest';
import { ensurePersonalUserInitialized } from '@/features/auth';
import { loadSerializedDashboardData } from '@/features/analytics/services/dashboard-data-loader';

describe('Integração SQLite: Dashboard Data Loader (SSR Aggregator)', () => {
  it('agrega em paralelo e serializa contas, cartões, metas, resumo mensal, MoM e relatórios de IA', async () => {
    const user = await ensurePersonalUserInitialized();

    const data = await loadSerializedDashboardData({
      user,
      ssoState: { authenticated: false, session: null },
      resolvedParams: {
        month: '11',
        year: '2026',
        compMonthA: '10',
        compYearA: '2026',
        compMonthB: '11',
        compYearB: '2026',
      },
    });

    expect(data.user.id).toBe(user.id);
    expect(data.selectedMonth).toBe(11);
    expect(data.selectedYear).toBe(2026);
    expect(data.compareMonthA).toBe(10);
    expect(data.compareMonthB).toBe(11);
    expect(Array.isArray(data.accounts)).toBe(true);
    expect(Array.isArray(data.categories)).toBe(true);
    expect(Array.isArray(data.sixMonthsHistory)).toBe(true);
    expect(data.sixMonthsHistory).toHaveLength(6);
    expect(data.monthSummary.month).toBe(11);
    expect(data.momComparison.monthA.month).toBe(10);
    expect(data.momComparison.monthB.month).toBe(11);
  });
});

import { describe, it, expect } from 'vitest';
import {
  filterAndSortHealthReports,
  type HealthReportsFilterState,
  type HealthReportFilterable,
} from '@/features/ai-copilot/domain/health-reports-filter';

const BASE_FILTERS: HealthReportsFilterState = {
  searchQuery: '',
  dateFrom: '',
  dateTo: '',
  scoreFilter: 'ALL',
  providerFilter: 'ALL',
  sortOrder: 'NEWEST',
};

const SAMPLE_REPORTS: HealthReportFilterable[] = [
  {
    id: 'r1',
    provider: 'OPENAI',
    connectionMode: 'API_QUOTA',
    healthScore: 88,
    summary: 'Reserva sólida e fluxo positivo em novembro.',
    strengths: ['Boa margem estática'],
    risks: ['Delivery elevado'],
    actionPlan: ['Manter aporte mensal'],
    createdAt: '2026-11-20T15:00:00.000Z',
  },
  {
    id: 'r2',
    provider: 'GEMINI',
    connectionMode: 'API_QUOTA',
    healthScore: 62,
    summary: 'Atenção aos gastos com cartão de crédito em outubro.',
    strengths: ['Receita estável'],
    risks: ['Fatura acima de 40% da renda'],
    actionPlan: ['Reduzir parcelamentos'],
    createdAt: '2026-10-15T15:00:00.000Z',
  },
  {
    id: 'r3',
    provider: 'CLAUDE',
    connectionMode: 'SUBSCRIPTION',
    healthScore: 38,
    summary: 'Déficit crítico em setembro por emergência médica.',
    strengths: ['Controle de contas fixas'],
    risks: ['Saldo negativo temporário'],
    actionPlan: ['Priorizar recomposição de reserva'],
    createdAt: '2026-09-05T15:00:00.000Z',
  },
];

describe('filterAndSortHealthReports', () => {
  it('filtra por intervalo de datas (De / Até)', () => {
    const res = filterAndSortHealthReports(SAMPLE_REPORTS, {
      ...BASE_FILTERS,
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
    });
    expect(res.map((r) => r.id)).toEqual(['r2']);
  });

  it('filtra por faixa de saúde financeira e por provedor', () => {
    expect(
      filterAndSortHealthReports(SAMPLE_REPORTS, { ...BASE_FILTERS, scoreFilter: 'HEALTHY' }).map(
        (r) => r.id
      )
    ).toEqual(['r1']);
    expect(
      filterAndSortHealthReports(SAMPLE_REPORTS, { ...BASE_FILTERS, scoreFilter: 'CRITICAL' }).map(
        (r) => r.id
      )
    ).toEqual(['r3']);
    expect(
      filterAndSortHealthReports(SAMPLE_REPORTS, {
        ...BASE_FILTERS,
        providerFilter: 'GEMINI',
      }).map((r) => r.id)
    ).toEqual(['r2']);
  });

  it('busca por texto no resumo, riscos e plano de ação', () => {
    const res = filterAndSortHealthReports(SAMPLE_REPORTS, {
      ...BASE_FILTERS,
      searchQuery: 'parcelamentos',
    });
    expect(res.map((r) => r.id)).toEqual(['r2']);
  });

  it('ordena por data mais antiga, maior nota e menor nota', () => {
    expect(
      filterAndSortHealthReports(SAMPLE_REPORTS, { ...BASE_FILTERS, sortOrder: 'OLDEST' }).map(
        (r) => r.id
      )
    ).toEqual(['r3', 'r2', 'r1']);
    expect(
      filterAndSortHealthReports(SAMPLE_REPORTS, { ...BASE_FILTERS, sortOrder: 'SCORE_ASC' }).map(
        (r) => r.id
      )
    ).toEqual(['r3', 'r2', 'r1']);
    expect(
      filterAndSortHealthReports(SAMPLE_REPORTS, { ...BASE_FILTERS, sortOrder: 'SCORE_DESC' }).map(
        (r) => r.id
      )
    ).toEqual(['r1', 'r2', 'r3']);
  });
});

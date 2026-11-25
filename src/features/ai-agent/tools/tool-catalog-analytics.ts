import { z } from 'zod';
import type { ProviderToolDeclaration } from '@/features/ai-agent/services/agent-tool-provider-client';

export const queryOverviewToolSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const queryGoalsToolSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const queryExpensesToolSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  type: z.enum(['ALL', 'INCOME', 'EXPENSE', 'TRANSFER']).default('EXPENSE'),
  nature: z.enum(['ALL', 'STATIC', 'VARIABLE']).default('ALL'),
  categoryName: z.string().optional(),
  searchQuery: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .default(20)
    .transform((v) => Math.min(40, Math.max(1, v))),
});

export const comparePeriodsToolSchema = z.object({
  monthsCount: z.coerce
    .number()
    .int()
    .default(6)
    .transform((v) => Math.min(12, Math.max(2, v))),
  referenceMonth: z.coerce.number().int().min(1).max(12).optional(),
  referenceYear: z.coerce.number().int().min(2000).max(2100).optional(),
  monthA: z.coerce.number().int().min(1).max(12).optional(),
  yearA: z.coerce.number().int().min(2000).max(2100).optional(),
  monthB: z.coerce.number().int().min(1).max(12).optional(),
  yearB: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const queryForecastsToolSchema = z.object({
  monthsAhead: z.coerce
    .number()
    .int()
    .default(6)
    .transform((v) => Math.min(12, Math.max(1, v))),
});

export const searchHistoryToolSchema = z.object({
  query: z.string().trim().min(1),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  topK: z.coerce
    .number()
    .int()
    .default(10)
    .transform((v) => Math.min(20, Math.max(1, v))),
});

export const generateReportToolSchema = z.object({
  scope: z.enum(['monthly', 'goals', 'expenses', 'full']).default('full'),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const ANALYTICS_TOOL_DECLARATIONS: ProviderToolDeclaration[] = [
  {
    name: 'query_financial_overview',
    description:
      'Consulta dados reais do usuário no banco: patrimônio líquido, contas, cartões, receitas/despesas do mês, linha de base estática e top categorias.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'integer', description: 'Mês (1-12). Padrão: mês selecionado no dashboard.' },
        year: { type: 'integer', description: 'Ano (ex: 2026). Padrão: ano selecionado.' },
      },
    },
  },
  {
    name: 'query_portfolio_goals',
    description:
      'Consulta todas as metas financeiras reais do usuário (título, valor alvo, patrimônio atual, progresso %, valor restante, prazo, ritmo mensal e status). Use SEMPRE antes de gerar gráficos ou análises sobre metas.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'integer' },
        year: { type: 'integer' },
      },
    },
  },
  {
    name: 'query_expenses_and_transactions',
    description:
      'Consulta lançamentos reais e distribuição por categoria do período solicitado, com filtros opcionais de tipo, natureza (STATIC/VARIABLE), categoria e texto.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'integer' },
        year: { type: 'integer' },
        type: { type: 'string', enum: ['ALL', 'INCOME', 'EXPENSE', 'TRANSFER'] },
        nature: { type: 'string', enum: ['ALL', 'STATIC', 'VARIABLE'] },
        categoryName: { type: 'string' },
        searchQuery: { type: 'string' },
        limit: { type: 'integer' },
      },
    },
  },
  {
    name: 'compare_financial_periods',
    description:
      'Recupera dados reais para comparar meses (evolução dos últimos N meses ou comparativo direto mês A vs mês B) incluindo receitas, despesas, saldo líquido e variações percentuais.',
    parameters: {
      type: 'object',
      properties: {
        monthsCount: { type: 'integer', description: 'Quantidade de meses para série histórica (2 a 12). Padrão: 6.' },
        referenceMonth: { type: 'integer' },
        referenceYear: { type: 'integer' },
        monthA: { type: 'integer' },
        yearA: { type: 'integer' },
        monthB: { type: 'integer' },
        yearB: { type: 'integer' },
      },
    },
  },
  {
    name: 'query_forecasts_and_simulations',
    description:
      'Consulta previsões cadastradas (Vou Ganhar / Provável Gasto), metas de saldo futuro e projeção condicionada baseada na linha de base estática.',
    parameters: {
      type: 'object',
      properties: {
        monthsAhead: { type: 'integer', description: 'Horizonte de simulação em meses (1 a 12).' },
      },
    },
  },
  {
    name: 'search_financial_history',
    description:
      'Busca semântica no RAG financeiro do usuário (transações específicas, estabelecimentos, regras, orçamentos).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        month: { type: 'integer' },
        year: { type: 'integer' },
        topK: { type: 'integer' },
      },
      required: ['query'],
    },
  },
  {
    name: 'generate_financial_report',
    description:
      'Gera um relatório financeiro estruturado completo baseado em dados reais do usuário (score de saúde, indicadores, pontos fortes, riscos, projeções condicionadas e plano de ação).',
    parameters: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['monthly', 'goals', 'expenses', 'full'] },
        month: { type: 'integer' },
        year: { type: 'integer' },
      },
    },
  },
  {
    name: 'render_visual_content',
    description:
      'Renderiza componentes visuais nativos na conversa (pie/pizza, donut/rosca, bar/barras, line/linhas, area, progress_bars, kpi_strip, table ou report_card). OBRIGATÓRIO: consulte dados reais antes via query_*/compare_*/generate_*.',
    parameters: {
      type: 'object',
      properties: {
        blocks: {
          type: 'array',
          description: '1 a 6 blocos visuais estruturados com dados reais.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              kind: { type: 'string', enum: ['kpi_strip', 'pie', 'donut', 'bar', 'line', 'area', 'progress_bars', 'table', 'report_card'] },
              title: { type: 'string' },
              subtitle: { type: 'string' },
              periodLabel: { type: 'string' },
              isProjection: { type: 'boolean' },
              unit: { type: 'string', enum: ['BRL_CENTS', 'BRL', 'PERCENT', 'COUNT'] },
              kpis: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, valueInCents: { type: 'number' }, displayValue: { type: 'string' }, tone: { type: 'string', enum: ['neutral', 'income', 'expense', 'indigo', 'amber'] }, hint: { type: 'string' } }, required: ['label'] } },
              data: { type: 'array', description: 'Para pie, donut e progress_bars (valueInCents, targetInCents, percent 0-100, color).', items: { type: 'object', properties: { name: { type: 'string' }, valueInCents: { type: 'number' }, targetInCents: { type: 'number' }, percent: { type: 'number' }, color: { type: 'string' } }, required: ['name'] } },
              series: { type: 'array', description: 'Para bar, line e area (key, label, color).', items: { type: 'object', properties: { key: { type: 'string' }, label: { type: 'string' }, color: { type: 'string' } }, required: ['key', 'label'] } },
              points: { type: 'array', description: 'Para bar, line e area (name, values: { [seriesKey]: valorEmCentavos }).', items: { type: 'object', properties: { name: { type: 'string' }, values: { type: 'object' } }, required: ['name', 'values'] } },
              columns: { type: 'array', description: 'Para table (key, label, align, format).', items: { type: 'object', properties: { key: { type: 'string' }, label: { type: 'string' }, align: { type: 'string', enum: ['left', 'right', 'center'] }, format: { type: 'string', enum: ['text', 'currency_cents', 'percent', 'number'] } }, required: ['key', 'label'] } },
              rows: { type: 'array', items: { type: 'object' } },
              report: { type: 'object', properties: { healthScore: { type: 'number' }, summary: { type: 'string' }, strengths: { type: 'array', items: { type: 'string' } }, risks: { type: 'array', items: { type: 'string' } }, projections: { type: 'array', items: { type: 'string' } }, actionPlan: { type: 'array', items: { type: 'string' } } } },
            },
            required: ['id', 'kind', 'title'],
          },
        },
      },
      required: ['blocks'],
    },
  },
];

export const READ_ANALYTICS_TOOL_NAMES = new Set([
  'query_budgets',
  'query_static_rules',
  'query_credit_card_invoices',
  'query_categories',
  'query_health_reports',
  'query_financial_overview',
  'query_portfolio_goals',
  'query_expenses_and_transactions',
  'compare_financial_periods',
  'query_forecasts_and_simulations',
  'search_financial_history',
  'generate_financial_report',
]);

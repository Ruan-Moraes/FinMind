import { z } from 'zod';

export const kpiItemSchema = z.object({
  label: z.string().min(1),
  valueInCents: z.coerce.number().optional(),
  displayValue: z.string().optional(),
  tone: z.enum(['neutral', 'income', 'expense', 'indigo', 'amber']).default('neutral'),
  hint: z.string().optional(),
});

export const chartSliceSchema = z.object({
  name: z.string().min(1),
  valueInCents: z.coerce.number().optional(),
  value: z.coerce.number().optional(),
  targetInCents: z.coerce.number().optional(),
  percent: z.coerce.number().optional(),
  color: z.string().optional(),
});

export const seriesDefinitionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  color: z.string().default('#6366f1'),
});

export const seriesPointSchema = z.object({
  name: z.string().min(1),
  values: z.record(z.string(), z.coerce.number()),
});

export const tableColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  align: z.enum(['left', 'right', 'center']).default('left'),
  format: z.enum(['text', 'currency_cents', 'percent', 'number']).default('text'),
});

export const tableRowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));

export const dynamicContentBlockSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    'kpi_strip',
    'pie',
    'donut',
    'bar',
    'line',
    'area',
    'progress_bars',
    'table',
    'report_card',
  ]),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  periodLabel: z.string().optional(),
  isProjection: z.boolean().optional(),
  unit: z.enum(['BRL_CENTS', 'BRL', 'PERCENT', 'COUNT']).optional(),
  kpis: z.array(kpiItemSchema).optional(),
  data: z.array(chartSliceSchema).optional(),
  series: z.array(seriesDefinitionSchema).optional(),
  points: z.array(seriesPointSchema).optional(),
  columns: z.array(tableColumnSchema).optional(),
  rows: z.array(tableRowSchema).optional(),
  report: z
    .object({
      healthScore: z.coerce.number().min(0).max(100).optional(),
      summary: z.string().min(1),
      strengths: z.array(z.string()).default([]),
      risks: z.array(z.string()).default([]),
      projections: z.array(z.string()).default([]),
      actionPlan: z.array(z.string()).default([]),
    })
    .optional(),
});

export const renderVisualContentToolSchema = z.object({
  blocks: z.array(dynamicContentBlockSchema).min(1).max(6),
});

export type DynamicContentBlock = z.infer<typeof dynamicContentBlockSchema>;
export type DynamicKpiItem = z.infer<typeof kpiItemSchema>;
export type DynamicChartSlice = z.infer<typeof chartSliceSchema>;
export type DynamicSeriesDefinition = z.infer<typeof seriesDefinitionSchema>;
export type DynamicSeriesPoint = z.infer<typeof seriesPointSchema>;
export type DynamicTableColumn = z.infer<typeof tableColumnSchema>;

export const CHART_PALETTE = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#8b5cf6',
  '#f43f5e',
  '#14b8a6',
];

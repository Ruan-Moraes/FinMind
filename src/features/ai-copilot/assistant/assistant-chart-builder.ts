/** Tipos dos gráficos do chat: gerados pelo Agente (render_visual_content) e de conversas antigas do histórico. */
export interface AssistantKpiCard {
  label: string;
  valueInCents: number;
  tone: 'neutral' | 'income' | 'expense' | 'indigo';
  hint?: string;
}

export interface AssistantChartDatum {
  name: string;
  valueInCents?: number;
  incomeInCents?: number;
  expenseInCents?: number;
  targetInCents?: number;
  percent?: number;
  color?: string;
}

export interface AssistantChartSpec {
  id: string;
  kind: 'kpi_strip' | 'donut' | 'bar_comparison' | 'progress_bars';
  title: string;
  subtitle?: string;
  kpis?: AssistantKpiCard[];
  data?: AssistantChartDatum[];
}

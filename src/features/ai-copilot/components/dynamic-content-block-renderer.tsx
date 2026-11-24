'use client';

import * as React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { BarChart3, PieChart as PieIcon } from 'lucide-react';
import { formatCentsToBRL, formatPercent } from '@/shared/lib/currency';
import {
  CHART_PALETTE,
  type DynamicContentBlock,
} from '@/features/ai-agent/domain/dynamic-content-schemas';
import {
  DynamicReportBlock,
  DynamicTableBlock,
} from '@/features/ai-copilot/components/dynamic-table-and-report-blocks';
import {
  DynamicBlockHeader,
  DynamicSeriesChartBlock,
  formatDynamicTooltipValue,
} from '@/features/ai-copilot/components/dynamic-series-chart-block';

export function DynamicContentBlockRenderer({
  block,
  hideValues,
}: {
  block: DynamicContentBlock;
  hideValues: boolean;
}) {
  if (block.kind === 'table') return <DynamicTableBlock block={block} hideValues={hideValues} />;
  if (block.kind === 'report_card') return <DynamicReportBlock block={block} />;
  if (block.kind === 'bar' || block.kind === 'line' || block.kind === 'area') {
    return <DynamicSeriesChartBlock block={block} hideValues={hideValues} />;
  }

  if (block.kind === 'kpi_strip' && block.kpis && block.kpis.length > 0) {
    return (
      <div data-agent-block="kpi_strip" className="grid grid-cols-2 gap-2 tabular-nums">
        {block.kpis.map((kpi) => {
          const toneClass =
            kpi.tone === 'income'
              ? 'text-emerald-600 dark:text-emerald-400'
              : kpi.tone === 'expense'
              ? 'text-rose-600 dark:text-rose-400'
              : kpi.tone === 'indigo'
              ? 'text-indigo-600 dark:text-indigo-400'
              : kpi.tone === 'amber'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-900 dark:text-zinc-100';
          return (
            <div
              key={kpi.label}
              className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/70 p-2.5"
            >
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">{kpi.label}</span>
              <strong className={`text-xs font-bold ${toneClass}`}>
                {kpi.displayValue ||
                  (kpi.valueInCents !== undefined
                    ? formatCentsToBRL(Math.round(kpi.valueInCents), hideValues)
                    : '—')}
              </strong>
              {kpi.hint && <span className="text-[10px] text-slate-400 block mt-0.5">{kpi.hint}</span>}
            </div>
          );
        })}
      </div>
    );
  }

  if ((block.kind === 'pie' || block.kind === 'donut') && block.data && block.data.length > 0) {
    const isCents = block.unit !== 'BRL' && block.unit !== 'PERCENT' && block.unit !== 'COUNT';
    const rawSlices = block.data.map((d, idx) => {
      const cents =
        d.valueInCents !== undefined
          ? Math.round(d.valueInCents)
          : d.value !== undefined
          ? isCents
            ? Math.round(d.value)
            : Math.round(d.value * 100)
          : 0;
      return {
        name: d.name,
        cents: Math.max(0, cents),
        value: Math.max(0, cents) / 100,
        percent: d.percent,
        color: d.color || CHART_PALETTE[idx % CHART_PALETTE.length],
      };
    });
    const total = rawSlices.reduce((s, x) => s + x.cents, 0);
    const pieData = rawSlices.map((s) => ({
      ...s,
      percent: s.percent !== undefined ? s.percent : total > 0 ? (s.cents / total) * 100 : 0,
    }));

    return (
      <div
        data-agent-block={block.kind}
        className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-3 space-y-2.5"
      >
        <DynamicBlockHeader block={block} icon={<PieIcon className="h-3.5 w-3.5 text-indigo-500 shrink-0" />} />
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={block.kind === 'donut' ? 38 : 0}
                outerRadius={70}
                paddingAngle={block.kind === 'donut' ? 2 : 1}
              >
                {pieData.map((entry, idx) => (
                  <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: unknown) => formatDynamicTooltipValue(value, block.unit, hideValues)}
                contentStyle={{ borderRadius: '10px', fontSize: '11px', borderColor: 'rgba(148,163,184,0.3)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-1 gap-1 text-[11px] tabular-nums">
          {pieData.map((entry, idx) => (
            <div key={`${entry.name}-${idx}`} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="truncate text-slate-700 dark:text-zinc-300">{entry.name}</span>
              </div>
              <span className="font-medium text-slate-900 dark:text-zinc-100 shrink-0">
                {formatCentsToBRL(entry.cents, hideValues)} ({formatPercent(entry.percent)})
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.kind === 'progress_bars' && block.data && block.data.length > 0) {
    return (
      <div
        data-agent-block="progress_bars"
        className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-3 space-y-2.5"
      >
        <DynamicBlockHeader block={block} icon={<BarChart3 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />} />
        <div className="space-y-2.5 tabular-nums">
          {block.data.map((row, idx) => {
            const pct = Math.min(100, Math.max(0, row.percent || 0));
            return (
              <div key={`${row.name}-${idx}`} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium text-slate-700 dark:text-zinc-300 truncate">{row.name}</span>
                  <span className="font-semibold text-slate-900 dark:text-zinc-100 shrink-0">
                    {formatPercent(pct)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: row.color || CHART_PALETTE[idx % CHART_PALETTE.length] }}
                  />
                </div>
                {row.targetInCents != null && row.valueInCents != null && (
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                    {formatCentsToBRL(Math.round(row.valueInCents), hideValues)} de{' '}
                    {formatCentsToBRL(Math.round(row.targetInCents), hideValues)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

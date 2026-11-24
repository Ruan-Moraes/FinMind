'use client';

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { formatCentsToBRL, formatPercent } from '@/shared/lib/currency';
import type { AssistantChartSpec } from '@/features/ai-copilot/assistant/assistant-chart-builder';

export function AssistantDynamicChart({
  chart,
  hideValues,
}: {
  chart: AssistantChartSpec;
  hideValues: boolean;
}) {
  if (chart.kind === 'kpi_strip' && chart.kpis && chart.kpis.length > 0) {
    return (
      <div className="grid grid-cols-2 gap-2 tabular-nums">
        {chart.kpis.map((kpi) => {
          const toneClass =
            kpi.tone === 'income'
              ? 'text-emerald-600 dark:text-emerald-400'
              : kpi.tone === 'expense'
              ? 'text-rose-600 dark:text-rose-400'
              : kpi.tone === 'indigo'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-900 dark:text-zinc-100';
          return (
            <div
              key={kpi.label}
              className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/70 p-2.5"
            >
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">
                {kpi.label}
              </span>
              <strong className={`text-xs font-bold ${toneClass}`}>
                {formatCentsToBRL(kpi.valueInCents, hideValues)}
              </strong>
            </div>
          );
        })}
      </div>
    );
  }

  if (chart.kind === 'donut' && chart.data && chart.data.length > 0) {
    const pieData = chart.data.map((d) => ({
      name: d.name,
      value: (d.valueInCents || 0) / 100,
      cents: d.valueInCents || 0,
      percent: d.percent || 0,
      color: d.color || '#6366f1',
    }));

    return (
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-100">
          <BarChart3 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span>{chart.title}</span>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={38}
                outerRadius={66}
                paddingAngle={2}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: unknown) =>
                  formatCentsToBRL(Math.round(Number(value || 0) * 100), hideValues)
                }
                contentStyle={{
                  borderRadius: '10px',
                  fontSize: '11px',
                  borderColor: 'rgba(148,163,184,0.3)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-1 gap-1 text-[11px] tabular-nums">
          {pieData.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
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

  if (chart.kind === 'bar_comparison' && chart.data && chart.data.length > 0) {
    const barData = chart.data.map((d) => ({
      name: d.name,
      Receitas: (d.incomeInCents || 0) / 100,
      Despesas: (d.expenseInCents || 0) / 100,
    }));

    return (
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-100">
          <BarChart3 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span>{chart.title}</span>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value: unknown) =>
                  formatCentsToBRL(Math.round(Number(value || 0) * 100), hideValues)
                }
                contentStyle={{
                  borderRadius: '10px',
                  fontSize: '11px',
                  borderColor: 'rgba(148,163,184,0.3)',
                }}
              />
              <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (chart.kind === 'progress_bars' && chart.data && chart.data.length > 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-100">
          <BarChart3 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span>{chart.title}</span>
        </div>
        <div className="space-y-2.5 tabular-nums">
          {chart.data.map((row) => {
            const pct = Math.min(100, Math.max(0, row.percent || 0));
            return (
              <div key={row.name} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium text-slate-700 dark:text-zinc-300 truncate">
                    {row.name}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-zinc-100 shrink-0">
                    {formatPercent(pct)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: row.color || '#6366f1' }}
                  />
                </div>
                {row.targetInCents != null && row.valueInCents != null && (
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                    {formatCentsToBRL(row.valueInCents, hideValues)} de{' '}
                    {formatCentsToBRL(row.targetInCents, hideValues)}
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

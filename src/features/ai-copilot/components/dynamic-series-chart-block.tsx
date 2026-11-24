'use client';

import * as React from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import { formatCentsToBRL, formatPercent } from '@/shared/lib/currency';
import {
  CHART_PALETTE,
  type DynamicContentBlock,
} from '@/features/ai-agent/domain/dynamic-content-schemas';

export function formatDynamicTooltipValue(
  val: unknown,
  unit: DynamicContentBlock['unit'],
  hideValues: boolean
): string {
  const num = Number(val || 0);
  if (unit === 'PERCENT') return formatPercent(num);
  if (unit === 'COUNT') return num.toLocaleString('pt-BR');
  return formatCentsToBRL(Math.round(num * 100), hideValues);
}

export function DynamicBlockHeader({
  block,
  icon,
}: {
  block: DynamicContentBlock;
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-100">
          {icon}
          <span>{block.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {block.periodLabel && (
            <span className="text-[10px] text-slate-400 dark:text-zinc-500">{block.periodLabel}</span>
          )}
          {block.isProjection && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
              Estimativa
            </span>
          )}
        </div>
      </div>
      {block.subtitle && (
        <p className="text-[11px] text-slate-500 dark:text-zinc-400">{block.subtitle}</p>
      )}
    </div>
  );
}

export function DynamicSeriesChartBlock({
  block,
  hideValues,
}: {
  block: DynamicContentBlock;
  hideValues: boolean;
}) {
  if (!block.points?.length || !block.series?.length) return null;

  const isCents = block.unit !== 'BRL' && block.unit !== 'PERCENT' && block.unit !== 'COUNT';
  const chartData = block.points.map((pt) => {
    const row: Record<string, string | number> = { name: pt.name };
    for (const s of block.series!) {
      const raw = Number(pt.values[s.key] ?? 0);
      row[s.key] = isCents ? raw / 100 : raw;
    }
    return row;
  });

  return (
    <div
      data-agent-block={block.kind}
      className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-3 space-y-2.5"
    >
      <DynamicBlockHeader
        block={block}
        icon={
          block.kind === 'bar' ? (
            <BarChart3 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          )
        }
      />
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {block.kind === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: unknown) => formatDynamicTooltipValue(v, block.unit, hideValues)}
                contentStyle={{ borderRadius: '10px', fontSize: '11px', borderColor: 'rgba(148,163,184,0.3)' }}
              />
              {block.series.length > 1 && <Legend wrapperStyle={{ fontSize: '10px' }} />}
              {block.series.map((s, idx) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color || CHART_PALETTE[idx % CHART_PALETTE.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          ) : block.kind === 'line' ? (
            <LineChart data={chartData} margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: unknown) => formatDynamicTooltipValue(v, block.unit, hideValues)}
                contentStyle={{ borderRadius: '10px', fontSize: '11px', borderColor: 'rgba(148,163,184,0.3)' }}
              />
              {block.series.length > 1 && <Legend wrapperStyle={{ fontSize: '10px' }} />}
              {block.series.map((s, idx) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color || CHART_PALETTE[idx % CHART_PALETTE.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: unknown) => formatDynamicTooltipValue(v, block.unit, hideValues)}
                contentStyle={{ borderRadius: '10px', fontSize: '11px', borderColor: 'rgba(148,163,184,0.3)' }}
              />
              {block.series.map((s, idx) => {
                const color = s.color || CHART_PALETTE[idx % CHART_PALETTE.length];
                return (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={color}
                    fill={color}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                );
              })}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

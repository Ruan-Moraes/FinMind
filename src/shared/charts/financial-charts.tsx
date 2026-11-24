'use client';

import * as React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatCentsToBRL, formatPercent } from '@/shared/lib/currency';

interface SixMonthPoint {
  label: string;
  receitas: number;
  despesas: number;
  estaticos: number;
  variaveis: number;
}

/**
 * Tooltip customizado de alto contraste para o gráfico de barras (Receitas vs Despesas)
 */
function CustomBarTooltip({
  active,
  payload,
  label,
  hideValues,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  hideValues: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-700/90 bg-zinc-900/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-md text-xs space-y-1.5">
      {label && (
        <div className="font-semibold text-zinc-100 border-b border-zinc-800 pb-1">
          {label}
        </div>
      )}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 tabular-nums">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-zinc-200 font-medium">
              {entry.name === 'receitas' ? 'Receitas' : 'Despesas'}:
            </span>
          </div>
          <span className="font-semibold text-white">
            {hideValues ? 'R$ ••••••' : formatCentsToBRL(Math.round(Number(entry.value) * 100))}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CashFlowBarChart({
  data,
  hideValues,
}: {
  data: SixMonthPoint[];
  hideValues: boolean;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#94a3b8' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickFormatter={(v) => (hideValues ? '•••' : `R$${v}`)}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
            content={<CustomBarTooltip hideValues={hideValues} />}
          />
          <Bar dataKey="receitas" name="receitas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
          <Bar dataKey="despesas" name="despesas" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface CategorySlice {
  categoryId: string;
  name: string;
  color: string;
  amountInCents: number;
  percent: number;
}

/**
 * Tooltip customizado de alto contraste para o gráfico de pizza/rosca (Despesas por Categoria)
 */
function CustomDonutTooltip({
  active,
  payload,
  hideValues,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: CategorySlice;
  }>;
  hideValues: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0];
  const slice = item.payload;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-md text-xs">
      <div className="flex items-center gap-2.5 tabular-nums">
        <span
          className="h-3 w-3 rounded-full shrink-0 ring-2 ring-white/20"
          style={{ backgroundColor: slice.color }}
        />
        <span className="font-semibold text-white whitespace-nowrap">{slice.name}:</span>
        <span className="font-bold text-emerald-400 whitespace-nowrap">
          {hideValues ? 'R$ ••••••' : formatCentsToBRL(Number(slice.amountInCents))}
        </span>
        {typeof slice.percent === 'number' && (
          <span className="text-zinc-300 font-medium">
            ({formatPercent(slice.percent)})
          </span>
        )}
      </div>
    </div>
  );
}

export function CategoryDonutChart({
  data,
  hideValues,
}: {
  data: CategorySlice[];
  hideValues: boolean;
}) {
  if (data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-slate-400 dark:text-zinc-500">
        Nenhuma despesa categorizada neste período.
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="amountInCents"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={82}
            paddingAngle={3}
          >
            {data.map((entry) => (
              <Cell key={entry.categoryId} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomDonutTooltip hideValues={hideValues} />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

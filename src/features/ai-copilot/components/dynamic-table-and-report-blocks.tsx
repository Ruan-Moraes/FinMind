'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, FileText, Sparkles, Table2, TrendingUp } from 'lucide-react';
import { formatCentsToBRL, formatPercent } from '@/shared/lib/currency';
import type {
  DynamicContentBlock,
  DynamicTableColumn,
} from '@/features/ai-agent/domain/dynamic-content-schemas';

function formatCellValue(
  raw: string | number | null | undefined,
  col: DynamicTableColumn,
  hideValues: boolean
): string {
  if (raw === null || raw === undefined) return '—';
  if (col.format === 'currency_cents') {
    const n = Number(raw);
    return Number.isFinite(n) ? formatCentsToBRL(Math.round(n), hideValues) : String(raw);
  }
  if (col.format === 'percent') {
    const n = Number(raw);
    return Number.isFinite(n) ? formatPercent(n) : String(raw);
  }
  if (col.format === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n.toLocaleString('pt-BR') : String(raw);
  }
  return String(raw);
}

export function DynamicTableBlock({
  block,
  hideValues,
}: {
  block: DynamicContentBlock;
  hideValues: boolean;
}) {
  if (!block.columns || block.columns.length === 0 || !block.rows || block.rows.length === 0) {
    return null;
  }

  return (
    <div
      data-agent-block="table"
      className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 p-3 space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-100">
          <Table2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span>{block.title}</span>
        </div>
        {block.isProjection && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
            Estimativa
          </span>
        )}
      </div>
      {block.subtitle && (
        <p className="text-[11px] text-slate-500 dark:text-zinc-400">{block.subtitle}</p>
      )}
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-[11px] border-collapse tabular-nums">
          <thead>
            <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
              {block.columns.map((col) => (
                <th
                  key={col.key}
                  className={`py-1.5 px-2 font-semibold whitespace-nowrap ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-zinc-800/70">
            {block.rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-100/60 dark:hover:bg-zinc-800/40">
                {block.columns!.map((col) => (
                  <td
                    key={col.key}
                    className={`py-1.5 px-2 text-slate-700 dark:text-zinc-200 whitespace-nowrap ${
                      col.align === 'right'
                        ? 'text-right font-medium'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    }`}
                  >
                    {formatCellValue(row[col.key], col, hideValues)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DynamicReportBlock({ block }: { block: DynamicContentBlock }) {
  const report = block.report;
  if (!report) return null;

  const scoreTone =
    (report.healthScore ?? 70) >= 75
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
      : (report.healthScore ?? 70) >= 50
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';

  return (
    <div
      data-agent-block="report_card"
      className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/70 p-3.5 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
          <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span>{block.title}</span>
        </div>
        {report.healthScore !== undefined && (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border tabular-nums ${scoreTone}`}>
            Score {Math.round(report.healthScore)}/100
          </span>
        )}
      </div>

      <p className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed">{report.summary}</p>

      {report.strengths.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Pontos Fortes</span>
          </div>
          <ul className="space-y-0.5 text-[11px] text-slate-600 dark:text-zinc-300 pl-4 list-disc">
            {report.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {report.risks.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Pontos de Atenção</span>
          </div>
          <ul className="space-y-0.5 text-[11px] text-slate-600 dark:text-zinc-300 pl-4 list-disc">
            {report.risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {report.projections.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Projeções (Estimativas Condicionadas)</span>
          </div>
          <ul className="space-y-0.5 text-[11px] text-slate-600 dark:text-zinc-300 pl-4 list-disc">
            {report.projections.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {report.actionPlan.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Plano de Ação Recomendado</span>
          </div>
          <ul className="space-y-0.5 text-[11px] text-slate-600 dark:text-zinc-300 pl-4 list-disc">
            {report.actionPlan.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

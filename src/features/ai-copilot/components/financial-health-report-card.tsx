'use client';

import * as React from 'react';
import { Trash2, TrendingUp, AlertTriangle, TrendingDown } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { AI_PROVIDER_META, type AiProviderId } from '@/features/ai-copilot/providers';
import { deleteAiReportAction } from '@/features/ai-copilot/actions/ai-status-reports.actions';
import {
  type AiPendingDeleteState,
  type SerializedAiReport,
} from '@/features/ai-copilot/components/ai-financial-hub';
import { getHealthScoreBand } from '@/features/ai-copilot/domain/health-reports-filter';

export function FinancialHealthReportCard(props: {
  report: SerializedAiReport;
  setPendingDelete: (d: AiPendingDeleteState | null) => void;
}) {
  const { report: rep, setPendingDelete } = props;
  const band = getHealthScoreBand(rep.healthScore);
  const providerName = AI_PROVIDER_META[rep.provider as AiProviderId]?.name || rep.provider;
  const createdDate = new Date(rep.createdAt);
  const formattedDateTime = `${createdDate.toLocaleDateString('pt-BR')} às ${createdDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`h-12 w-12 rounded-2xl flex flex-col items-center justify-center font-bold tabular-nums shrink-0 ${band.boxClass}`}
          >
            <span className="text-lg leading-none">{rep.healthScore}</span>
            <span className="text-[10px] font-medium">/100</span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-base">
                Parecer Financeiro ({providerName})
              </h3>
              <Badge variant={band.badgeVariant}>{band.label}</Badge>
              <Badge variant="neutral">{formattedDateTime}</Badge>
            </div>
            <p className="text-sm text-slate-600 dark:text-zinc-300 mt-1">{rep.summary}</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            setPendingDelete({
              title: 'Excluir Parecer Financeiro IA',
              entityName: `Parecer ${providerName} (${createdDate.toLocaleDateString('pt-BR')}) — Score ${rep.healthScore}/100`,
              description:
                'Tem certeza que deseja excluir permanentemente este diagnóstico financeiro?',
              confirmLabel: 'Excluir Parecer',
              onConfirm: () => deleteAiReportAction(rep.id),
            })
          }
          className="h-8 w-8 text-slate-400 hover:text-rose-500 shrink-0"
          title="Excluir parecer"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/50 p-3.5 space-y-2">
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Pontos Fortes
          </div>
          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-zinc-300">
            {rep.strengths.map((s, idx) => (
              <li key={idx}>• {s}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50 p-3.5 space-y-2">
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Atenção & Riscos
          </div>
          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-zinc-300">
            {rep.risks.map((r, idx) => (
              <li key={idx}>• {r}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/50 p-3.5 space-y-2">
          <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4" />
            Plano de Ação Recomendado
          </div>
          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-zinc-300">
            {rep.actionPlan.map((a, idx) => (
              <li key={idx}>• {a}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

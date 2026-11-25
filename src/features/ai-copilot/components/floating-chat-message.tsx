'use client';

import * as React from 'react';
import { BookOpen, Database, Sparkles } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { formatCentsToBRL } from '@/shared/lib/currency';
import type { AssistantStructuredResponse } from '@/features/ai-copilot/assistant';
import { AssistantDynamicChart } from '@/features/ai-copilot/components/assistant-dynamic-chart';

export function FloatingChatMessage({
  response,
  hideValues,
}: {
  response: AssistantStructuredResponse;
  hideValues: boolean;
}) {
  return (
    <div className="rounded-2xl rounded-tl-sm border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 space-y-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <Badge variant={response.executionMode === 'LIVE_LLM_RAG' ? 'income' : 'transfer'}>
          <Sparkles className="h-3 w-3 shrink-0" />
          {response.executionMode === 'LIVE_LLM_RAG'
            ? response.modelUsed
            : 'Consulta Inteligente'}
        </Badge>
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-zinc-500">
          <Database className="h-3 w-3" />
          {response.retrievedSources.length} fonte(s) do seu histórico
        </span>
      </div>

      {response.apiWarning && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-2 text-[11px] text-amber-800 dark:text-amber-300 [overflow-wrap:anywhere]">
          {response.apiWarning}
        </div>
      )}

      <p className="text-xs sm:text-[13px] text-slate-800 dark:text-zinc-100 leading-relaxed whitespace-pre-line">
        {response.directAnswer}
      </p>

      {/* Gráficos Dinâmicos gerados sobre os dados reais */}
      {response.charts && response.charts.length > 0 && (
        <div className="space-y-2.5">
          {response.charts.map((chart) => (
            <AssistantDynamicChart key={chart.id} chart={chart} hideValues={hideValues} />
          ))}
        </div>
      )}

      {/* Detalhes Estruturados: Fatos, Cálculos, Projeções e Recomendações */}
      <details className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 p-2.5 text-xs">
        <summary className="cursor-pointer font-semibold text-slate-700 dark:text-zinc-300">
          Ver Fatos Históricos, Cálculos Exatos e Projeções
        </summary>
        <div className="mt-2.5 space-y-2.5 pt-2 border-t border-slate-200 dark:border-zinc-800 text-[11px]">
          {response.historicalFacts.length > 0 && (
            <div className="space-y-1">
              <div className="font-semibold text-slate-800 dark:text-zinc-200">
                Fatos Históricos
              </div>
              <ul className="space-y-0.5 text-slate-600 dark:text-zinc-300">
                {response.historicalFacts.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
            </div>
          )}
          {response.calculatedResults.length > 0 && (
            <div className="space-y-1">
              <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                Cálculos Exatos
              </div>
              <ul className="space-y-0.5 text-slate-600 dark:text-zinc-300 tabular-nums">
                {response.calculatedResults.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
          )}
          {response.projectionsAndEstimates.length > 0 && (
            <div className="space-y-1">
              <div className="font-semibold text-amber-700 dark:text-amber-300">
                Projeções & Estimativas
              </div>
              <ul className="space-y-0.5 text-slate-600 dark:text-zinc-300">
                {response.projectionsAndEstimates.map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </div>
          )}
          {response.personalizedRecommendations.length > 0 && (
            <div className="space-y-1">
              <div className="font-semibold text-indigo-700 dark:text-indigo-300">
                Recomendações Práticas
              </div>
              <ul className="space-y-0.5 text-slate-600 dark:text-zinc-300">
                {response.personalizedRecommendations.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>

      {response.retrievedSources.length > 0 && (
        <details className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 p-2.5 text-[11px]">
          <summary className="cursor-pointer font-medium text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span>
              Fontes consultadas ({response.retrievedSources.length} registros)
            </span>
          </summary>
          <div className="mt-2 space-y-1.5 pt-2 border-t border-slate-200 dark:border-zinc-800">
            {response.retrievedSources.slice(0, 8).map((src) => (
              <div
                key={`${src.sourceType}:${src.sourceId}`}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="truncate text-slate-700 dark:text-zinc-300">{src.title}</span>
                <span className="tabular-nums text-slate-500 dark:text-zinc-400 shrink-0">
                  {src.amountInCents != null
                    ? formatCentsToBRL(src.amountInCents, hideValues)
                    : `${Math.round(src.score * 100)}%`}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

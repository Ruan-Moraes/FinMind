'use client';

import * as React from 'react';
import { Activity, BookOpen, Camera, Compass, Play, Sparkles } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import type {
  AgentTurnPayload,
  CapturedAnnotatedImage,
} from '@/features/ai-agent/domain/agent-types';
import { AssistantDynamicChart } from '@/features/ai-copilot/components/assistant-dynamic-chart';
import { DynamicContentBlockRenderer } from '@/features/ai-copilot/components/dynamic-content-block-renderer';
import {
  AgentConfirmationCard,
  type MutationUiState,
} from '@/features/ai-agent/components/agent-confirmation-card';
import { AgentScreenshotCard } from '@/features/ai-agent/components/agent-screenshot-card';
import { SafeMarkdownText } from '@/features/ai-agent/components/safe-markdown-text';

const MODALITY_LABELS: Record<AgentTurnPayload['modality'], string> = {
  ANALYTICAL: 'Análise & Gráficos',
  AUTONOMOUS: 'Execução Autônoma',
  INTERACTIVE_GUIDE: 'Orientação Interativa',
  ANNOTATED_SCREENSHOT: 'Guia por Captura Real',
  HYBRID: 'Interação Híbrida',
};

export function AgentTurnMessage(props: {
  payload: AgentTurnPayload;
  hideValues: boolean;
  capturedImage?: CapturedAnnotatedImage | null;
  mutationState?: MutationUiState;
  onConfirmMutation?: () => void;
  onCancelMutation?: () => void;
  onRollbackMutation?: () => void;
  onReplayVisual?: () => void;
  onRecaptureScreen?: () => void;
}) {
  const {
    payload, hideValues, capturedImage, mutationState,
    onConfirmMutation, onCancelMutation, onRollbackMutation,
    onReplayVisual, onRecaptureScreen,
  } = props;

  const hasVisualContent =
    (payload.contentBlocks && payload.contentBlocks.length > 0) ||
    (payload.charts && payload.charts.length > 0);

  return (
    <div className="rounded-2xl rounded-tl-sm border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 space-y-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <Badge variant={payload.modality === 'AUTONOMOUS' ? 'income' : 'transfer'}>
          <Sparkles className="h-3 w-3 shrink-0" />
          {payload.modality === 'ANALYTICAL' && !hasVisualContent
            ? 'Assistente'
            : MODALITY_LABELS[payload.modality]}
        </Badge>
        <span className="text-[10px] text-slate-400 dark:text-zinc-500 truncate max-w-[180px]">
          {payload.modelUsed}
        </span>
      </div>

      {payload.apiWarning && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-2 text-[11px] text-amber-800 dark:text-amber-300 [overflow-wrap:anywhere]">
          {payload.apiWarning}
        </div>
      )}

      <SafeMarkdownText content={payload.narrative} />

      {capturedImage && <AgentScreenshotCard image={capturedImage} />}

      {payload.pendingMutation && mutationState && onConfirmMutation && onCancelMutation && onRollbackMutation && (
        <AgentConfirmationCard
          mutation={payload.pendingMutation}
          state={mutationState}
          onConfirm={onConfirmMutation}
          onCancel={onCancelMutation}
          onRollback={onRollbackMutation}
        />
      )}

      {payload.contentBlocks && payload.contentBlocks.length > 0 && (
        <div className="space-y-2.5">
          {payload.contentBlocks.map((block) => (
            <DynamicContentBlockRenderer key={block.id} block={block} hideValues={hideValues} />
          ))}
        </div>
      )}

      {(!payload.contentBlocks || payload.contentBlocks.length === 0) &&
        payload.charts &&
        payload.charts.length > 0 && (
          <div className="space-y-2.5">
            {payload.charts.map((chart) => (
              <AssistantDynamicChart key={chart.id} chart={chart} hideValues={hideValues} />
            ))}
          </div>
        )}

      {(payload.visualSteps.length > 0 || payload.screenshotDirective) && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {payload.visualSteps.length > 0 && onReplayVisual && (
            <Button type="button" variant="secondary" size="sm" onClick={onReplayVisual}>
              {payload.dryRunGuide ? <Compass className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{payload.dryRunGuide ? 'Demonstrar na Tela' : 'Repetir Navegação'}</span>
            </Button>
          )}
          {payload.screenshotDirective && onRecaptureScreen && (
            <Button type="button" variant="secondary" size="sm" onClick={onRecaptureScreen}>
              <Camera className="h-3.5 w-3.5" />
              <span>Atualizar Captura</span>
            </Button>
          )}
        </div>
      )}

      {payload.historicalFacts && payload.historicalFacts.length > 0 && (
        <details className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 p-2.5 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-700 dark:text-zinc-300">
            Ver Fatos Históricos, Cálculos Exatos e Projeções
          </summary>
          <div className="mt-2 space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800 text-[11px]">
            <ul className="space-y-0.5 text-slate-600 dark:text-zinc-300">
              {payload.historicalFacts.map((f, i) => (
                <li key={i}>• {f}</li>
              ))}
            </ul>
            {payload.calculatedResults && payload.calculatedResults.length > 0 && (
              <ul className="space-y-0.5 text-emerald-700 dark:text-emerald-300 tabular-nums">
                {payload.calculatedResults.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}

      {payload.executionTrace && payload.executionTrace.steps.length > 0 && (
        <details className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 p-2 text-[11px]">
          <summary className="cursor-pointer font-medium text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>
              Trilha de execução ({payload.executionTrace.steps.length}{' '}
              {payload.executionTrace.steps.length === 1 ? 'etapa' : 'etapas'}
              {payload.executionTrace.retriedForAlignment ? ' • autocorrigido' : ''})
            </span>
          </summary>
          <div className="mt-1.5 space-y-1 pt-1.5 border-t border-slate-200 dark:border-zinc-800 tabular-nums">
            {payload.executionTrace.steps.map((s, idx) => (
              <div key={`${s.toolName}-${idx}`} className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-700 dark:text-zinc-300">
                  {s.toolName}
                  {s.note ? ` — ${s.note}` : ''}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {s.status} {s.durationMs > 0 ? `(${s.durationMs}ms)` : ''}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {payload.systemSources.length > 0 && (
        <details className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 p-2 text-[11px]">
          <summary className="cursor-pointer font-medium text-slate-600 dark:text-zinc-400 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span>Base de conhecimento consultada ({payload.systemSources.length})</span>
          </summary>
          <div className="mt-1.5 space-y-1 pt-1.5 border-t border-slate-200 dark:border-zinc-800">
            {payload.systemSources.map((src, idx) => (
              <div key={`${src.docId}-${idx}`} className="flex justify-between gap-2">
                <span className="truncate text-slate-700 dark:text-zinc-300">{src.sectionPath}</span>
                <span className="tabular-nums text-slate-400 shrink-0">
                  {Math.round(src.score * 100)}%
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

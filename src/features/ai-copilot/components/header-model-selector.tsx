'use client';

import * as React from 'react';
import { AlertTriangle, Cpu, KeyRound, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  PROVIDER_STATIC_META,
  PROVIDER_STATUS_LABELS,
} from '@/features/ai-copilot/domain/ai-provider-types';
import { useAiProviders } from '@/features/ai-copilot/context/ai-providers-context';
import { AiModelSelector } from '@/features/ai-copilot/components/ai-model-selector';
import { SanityCheckConsoleModal } from '@/features/ai-copilot/components/sanity-check-console-modal';

export function HeaderModelSelector() {
  const { state, activeProviderState, isTestingModel, selectModel } = useAiProviders();
  const [isInspectorOpen, setIsInspectorOpen] = React.useState(false);

  const meta = PROVIDER_STATIC_META[state.activeProvider];
  const statusInfo = PROVIDER_STATUS_LABELS[activeProviderState.status];
  const isLoading = isTestingModel || activeProviderState.status === 'VERIFYING';

  const statusToneClasses =
    statusInfo.tone === 'emerald'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25'
      : statusInfo.tone === 'indigo'
      ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
      : statusInfo.tone === 'amber'
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25'
      : statusInfo.tone === 'rose'
      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25'
      : 'bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700';

  return (
    <>
      <div
        data-ai-provider-status={activeProviderState.status}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-900/90 p-1 pl-2.5 h-10 shadow-sm shrink-0"
      >
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: meta.badgeColor }}
          title={meta.name}
        />
        <Cpu className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 shrink-0 hidden md:inline" />

        <div className="w-[155px] sm:w-[195px]">
          <AiModelSelector
            mode="global"
            activeProvider={state.activeProvider}
            activeModelId={state.activeModelId}
            providers={state.providers}
            onSelect={(prov, modelId) => void selectModel(prov, modelId)}
            ariaLabel="Selecionar Modelo de IA no Header"
            className="!h-8 !border-0 !bg-transparent !shadow-none !pl-1 !pr-2 !text-xs !font-semibold !rounded-lg hover:!bg-slate-200/50 dark:hover:!bg-zinc-800/60"
          />
        </div>

        <span className="h-4 w-px bg-slate-200 dark:bg-zinc-800" />

        <button
          type="button"
          onClick={() => setIsInspectorOpen(true)}
          title={`Central de Provedores IA (${meta.name}: ${statusInfo.label})`}
          className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${statusToneClasses}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              <span className="hidden xl:inline">Verificando...</span>
            </>
          ) : statusInfo.tone === 'emerald' ? (
            <>
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xl:inline">{statusInfo.label}</span>
            </>
          ) : statusInfo.tone === 'neutral' ? (
            <>
              <KeyRound className="h-3 w-3 shrink-0" />
              <span className="hidden xl:inline">{statusInfo.label}</span>
            </>
          ) : statusInfo.tone === 'amber' ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xl:inline">{statusInfo.label}</span>
            </>
          ) : (
            <>
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xl:inline">{statusInfo.label}</span>
            </>
          )}
        </button>
      </div>

      <SanityCheckConsoleModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />
    </>
  );
}

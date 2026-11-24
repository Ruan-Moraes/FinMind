'use client';

import * as React from 'react';
import { Activity, CheckCircle2, Cpu, MessageSquare, RefreshCw, Send, XCircle } from 'lucide-react';
import {
  PROVIDER_STATIC_META,
  type AiProviderId,
} from '@/features/ai-copilot/domain/ai-provider-types';
import { SANITY_CHECK_PROMPT } from '@/features/ai-copilot/models';
import { useAiProviders } from '@/features/ai-copilot/context/ai-providers-context';
import { AiModelSelector } from '@/features/ai-copilot/components/ai-model-selector';
import { AiProvidersStatusCards } from '@/features/ai-copilot/components/ai-providers-status-cards';
import {
  AiDiagnosticErrorCard,
  getFriendlyDiagnosticBadge,
} from '@/features/ai-copilot/components/ai-diagnostic-error-card';
import { Modal } from '@/shared/ui/modal';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';

const QUICK_PROMPTS = [
  SANITY_CHECK_PROMPT,
  'Quanto é 15% de R$ 4.800,00?',
  'Se eu guardar R$ 850 por mês, em quantos meses junto R$ 10.200?',
];

export function SanityCheckConsoleModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    state, activeProviderState, isTestingModel, lastSanityResult, lastSanityError,
    saveProviderKey, removeProviderKey, selectModel, refreshProviderModels, runOperationalTest,
  } = useAiProviders();

  const [editingProvider, setEditingProvider] = React.useState<AiProviderId | null>(null);
  const [customPrompt, setCustomPrompt] = React.useState(SANITY_CHECK_PROMPT);

  const activeMeta = PROVIDER_STATIC_META[state.activeProvider];
  const canRunTest =
    Boolean(state.activeModelId) &&
    activeProviderState.status !== 'NOT_CONFIGURED' &&
    activeProviderState.status !== 'INVALID_CREDENTIALS';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title="Central de Provedores e Teste de IA"
      subtitle="Gerencie suas chaves de API oficiais (OpenAI, Gemini e Claude), atualize modelos reais e execute testes sob demanda"
      footer={
        <div className="w-full flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!canRunTest || isTestingModel}
            isLoading={isTestingModel}
            onClick={() => void runOperationalTest(state.activeProvider, state.activeModelId, SANITY_CHECK_PROMPT)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Testar Modelo Agora
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <AiProvidersStatusCards
          state={state}
          editingProvider={editingProvider}
          setEditingProvider={setEditingProvider}
          onSaveKey={(p, k) => saveProviderKey(p, k, { activateProvider: true })}
          onRemoveKey={removeProviderKey}
        />

        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/80 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-900 dark:text-zinc-100">
              <Cpu className="h-4 w-4 text-indigo-500" />
              Modelo Ativo ({activeMeta.name})
            </span>
            <button
              type="button"
              disabled={activeProviderState.modelsLoading}
              onClick={() => void refreshProviderModels(state.activeProvider, true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${activeProviderState.modelsLoading ? 'animate-spin' : ''}`} />
              Atualizar {activeMeta.shortName}
            </button>
          </div>
          <AiModelSelector
            mode="global"
            activeProvider={state.activeProvider}
            activeModelId={state.activeModelId}
            providers={state.providers}
            onSelect={(prov, modelId) => void selectModel(prov, modelId)}
            ariaLabel="Selecionar Modelo de IA no Console"
            className="h-10 text-xs"
          />
          {activeProviderState.error && (
            <AiDiagnosticErrorCard
              diagnosticCode={activeProviderState.error.code}
              rawError={activeProviderState.error.message}
              providerName={activeMeta.shortName}
              onConfigureKey={() => setEditingProvider(state.activeProvider)}
            />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/80 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-900 dark:text-zinc-100">
              <MessageSquare className="h-4 w-4 text-amber-500" />
              Teste Operacional Sob Demanda
            </span>
            {lastSanityResult && (
              <Badge variant={lastSanityResult.passed ? 'income' : 'expense'}>
                {lastSanityResult.passed ? (
                  <><CheckCircle2 className="h-3 w-3" /> {lastSanityResult.latencyMs}ms</>
                ) : (
                  <><XCircle className="h-3 w-3" /> {getFriendlyDiagnosticBadge(lastSanityResult.diagnosticCode)}</>
                )}
              </Badge>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canRunTest) void runOperationalTest(state.activeProvider, state.activeModelId, customPrompt);
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Pergunta de teste para o modelo ativo..."
              className="flex-1 h-9 text-xs"
            />
            <Button type="submit" variant="primary" size="sm" disabled={!canRunTest} isLoading={isTestingModel}>
              <Send className="h-3.5 w-3.5" />
              Enviar
            </Button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={!canRunTest || isTestingModel}
                onClick={() => {
                  setCustomPrompt(q);
                  void runOperationalTest(state.activeProvider, state.activeModelId, q);
                }}
                className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-500/60 text-slate-600 dark:text-zinc-300 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {(lastSanityError || lastSanityResult?.error) && (
            <AiDiagnosticErrorCard
              diagnosticCode={lastSanityResult?.diagnosticCode}
              rawError={lastSanityResult?.error || lastSanityError || ''}
              providerName={activeMeta.shortName}
              onConfigureKey={() => setEditingProvider(state.activeProvider)}
            />
          )}

          {lastSanityResult?.rawResponse && (
            <div className="rounded-xl bg-white dark:bg-zinc-900 border border-emerald-500/30 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5 text-emerald-500" />
                  Resposta real de <strong>{lastSanityResult.selectedModelName}</strong>
                </span>
                <span className="font-mono">{lastSanityResult.latencyMs}ms</span>
              </div>
              <p className="text-slate-800 dark:text-zinc-100 whitespace-pre-wrap leading-relaxed">
                {lastSanityResult.rawResponse}
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

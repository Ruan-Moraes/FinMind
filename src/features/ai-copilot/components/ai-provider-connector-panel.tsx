'use client';

import * as React from 'react';
import { AlertTriangle, Check, ExternalLink, KeyRound, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import {
  AI_PROVIDER_IDS,
  PROVIDER_STATIC_META,
  PROVIDER_STATUS_LABELS,
  type AiProviderId,
} from '@/features/ai-copilot/domain/ai-provider-types';
import { useAiProviders } from '@/features/ai-copilot/context/ai-providers-context';
import { AiModelSelector } from '@/features/ai-copilot/components/ai-model-selector';
import { AiDiagnosticErrorCard } from '@/features/ai-copilot/components/ai-diagnostic-error-card';
import { Button } from '@/shared/ui/button';
import { FormField, Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';

export function AiProviderConnectorPanel() {
  const {
    state, saveProviderKey, removeProviderKey, selectModel, refreshProviderModels,
  } = useAiProviders();

  const [selectedTab, setSelectedTab] = React.useState<AiProviderId>(state.activeProvider);
  const [keyInput, setKeyInput] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [savedBanner, setSavedBanner] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const bannerTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
  }, []);

  const pState = state.providers[selectedTab];
  const meta = PROVIDER_STATIC_META[selectedTab];
  const statusInfo = PROVIDER_STATUS_LABELS[pState.status];
  const selectedModelMeta = pState.models.find((m) => m.id === pState.selectedModelId);

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return;
    setIsSaving(true);
    setActionError(null);
    setSavedBanner(false);
    try {
      const res = await saveProviderKey(selectedTab, keyInput, { activateProvider: true });
      if (!res.ok) {
        setActionError(res.error || 'Falha ao validar a chave de API.');
      } else {
        setKeyInput('');
        setSavedBanner(true);
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => setSavedBanner(false), 3500);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveKey = async () => {
    setIsRemoving(true);
    setActionError(null);
    try {
      const res = await removeProviderKey(selectedTab);
      if (!res.ok) setActionError(res.error || 'Não foi possível remover a chave.');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div
      data-agent-id="ai.panel.providers"
      data-agent-sensitive="true"
      className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/70 p-6 space-y-5"
    >
      <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500 shrink-0" />
            <h2 className="text-lg font-semibold">
              Provedores de Inteligência Artificial (Chave de API)
            </h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Configure suas chaves oficiais da OpenAI, Google Gemini e Anthropic Claude. O estado e os modelos ficam sincronizados em tempo real com toda a aplicação.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {savedBanner && (
            <Badge variant="income">
              <Check className="h-3.5 w-3.5" /> Validado e Sincronizado
            </Badge>
          )}
          <a
            href={meta.consoleUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {meta.consoleLabel}
          </a>
        </div>
      </div>

      {/* Cards independentes dos 3 provedores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {AI_PROVIDER_IDS.map((id) => {
          const cardMeta = PROVIDER_STATIC_META[id];
          const cardState = state.providers[id];
          const cardStatus = PROVIDER_STATUS_LABELS[cardState.status];
          const isSelected = selectedTab === id;
          const isActiveGlobal = state.activeProvider === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => { setSelectedTab(id); setKeyInput(''); setActionError(null); }}
              className={`rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-indigo-500 bg-white dark:bg-zinc-950 shadow-md ring-1 ring-indigo-500'
                  : 'border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/50 hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cardMeta.badgeColor }} />
                  {cardMeta.name}
                </span>
                <Badge variant={cardStatus.tone === 'emerald' ? 'income' : cardStatus.tone === 'rose' ? 'expense' : 'transfer'}>
                  {cardStatus.label}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 truncate">
                {cardState.models.length > 0 ? `${cardState.models.length} modelos oficiais` : cardState.keyPreview ? `Chave ${cardState.keyPreview}` : 'Nenhuma chave configurada'}
                {isActiveGlobal ? ' • Ativo' : ''}
              </p>
            </button>
          );
        })}
      </div>

      {/* Configuração de Chave API + Seletor Padronizado de Modelos */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-end">
        <FormField
          label={meta.keyLabel}
          hint={
            pState.hasStoredKey
              ? `Chave salva com criptografia: ${pState.keyPreview} (${statusInfo.label})`
              : pState.hasEnvKey
              ? `Usando variável de ambiente (${meta.envVarName})`
              : `Cole sua chave oficial (${meta.keyPlaceholder}) para validar e listar modelos`
          }
        >
          <div className="flex items-center gap-2">
            <Input
              type="password"
              placeholder={pState.hasStoredKey ? 'Cole uma nova chave para substituir...' : meta.keyPlaceholder}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="flex-1"
            />
            <Button type="button" variant="primary" size="md" disabled={!keyInput.trim()} isLoading={isSaving} onClick={() => void handleSaveKey()}>
              <KeyRound className="h-4 w-4" />
              Validar
            </Button>
            {pState.hasStoredKey && (
              <Button type="button" variant="destructive" size="md" isLoading={isRemoving} title={`Remover chave ${meta.shortName}`} aria-label={`Remover chave ${meta.shortName}`} onClick={() => void handleRemoveKey()}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </FormField>

        <FormField
          label={`Modelo ${meta.name}`}
          hint={
            pState.modelsLoading
              ? `Consultando endpoint oficial da ${meta.company}...`
              : pState.models.length > 0
              ? `${pState.models.length} modelos retornados pela API oficial da ${meta.company}`
              : `Cadastre uma chave válida para carregar modelos oficiais da ${meta.company}`
          }
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <AiModelSelector
                mode="provider"
                activeProvider={selectedTab}
                activeModelId={pState.selectedModelId}
                providers={state.providers}
                onSelect={(prov, modelId) => void selectModel(prov, modelId)}
                ariaLabel={`Selecionar modelo ${meta.name}`}
              />
            </div>
            <button
              type="button"
              onClick={() => void refreshProviderModels(selectedTab, true)}
              disabled={pState.modelsLoading || pState.status === 'NOT_CONFIGURED'}
              title={`Atualizar lista de modelos direto da ${meta.company}`}
              className="h-11 px-4 shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-semibold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${pState.modelsLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </FormField>
      </div>

      {selectedModelMeta && !selectedModelMeta.compatibleWithApp && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Modelo incompatível com chat/agente:</strong> {selectedModelMeta.incompatibilityReason}
          </span>
        </div>
      )}

      {pState.selectedModelId && pState.models.length > 0 && !pState.selectedModelAvailable && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            O modelo salvo (<code>{pState.selectedModelId}</code>) não foi encontrado na lista atual da {meta.company}. Escolha um modelo disponível acima (nenhuma substituição automática foi feita).
          </span>
        </div>
      )}

      {(actionError || pState.error) && (
        <AiDiagnosticErrorCard
          diagnosticCode={pState.error?.code}
          rawError={actionError || pState.error?.message || ''}
          providerName={meta.shortName}
        />
      )}
    </div>
  );
}

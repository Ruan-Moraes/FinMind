'use client';
import * as React from 'react';
import { Cpu, ShieldCheck, ShieldAlert, ChevronDown, Loader2, LogIn } from 'lucide-react';
import { type AiModelId, type SanityCheckValidationResult } from '@/features/ai-copilot/models';
import { type SsoSessionPayload } from '@/features/auth/sso';
import { SanityCheckConsoleModal } from '@/features/ai-copilot/components/sanity-check-console-modal';
import { useHeaderModelSelector } from '@/features/ai-copilot/hooks/use-header-model-selector';

interface HeaderModelSelectorProps {
  initialModelId: string;
  initialSsoAuthenticated: boolean;
  initialSsoSession: SsoSessionPayload | null;
  onModelConfirmed?: (modelId: AiModelId, sanity: SanityCheckValidationResult) => void;
}

export function HeaderModelSelector(props: HeaderModelSelectorProps) {
  const {
    selectedModelId, currentModel, providersAuth, customQuestionInput, setCustomQuestionInput,
    isTesting, isSsoLoading, sanityResult, sanityError, isInspectorOpen, setIsInspectorOpen,
    openaiModels, geminiModels, geminiModelsSource, isLoadingGeminiModels, refreshLiveGeminiModels,
    claudeModels, isCurrentProviderLogged, isModelReallyVerified,
    runSanityCheckForModel, handleOpenProviderLoginPopup, handleSelectModelChange,
    handleSendCustomQuestion, handleRevokeProvider,
  } = useHeaderModelSelector(props);
  return (
    <>
      <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-900/90 p-1 pl-2.5 h-10 shadow-sm shrink-0">
        {/* Indicador de Provedor + Seletor de Modelo no Header */}
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: currentModel.badgeColor }}
          title={currentModel.providerGroupLabel}
        />
        <Cpu className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 shrink-0 hidden md:inline" />

        <div className="relative flex items-center">
          <select
            aria-label="Selecionar Modelo de IA no Header"
            value={selectedModelId}
            onChange={handleSelectModelChange}
            className="appearance-none bg-transparent text-xs font-semibold text-slate-900 dark:text-zinc-100 focus:outline-none cursor-pointer pl-1 pr-5 whitespace-nowrap"
          >
            <optgroup
              label="OpenAI / ChatGPT"
              className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            >
              {openaiModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </optgroup>
            <optgroup
              label="Google Gemini"
              className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            >
              {geminiModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </optgroup>
            <optgroup
              label="Anthropic Claude"
              className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            >
              {claudeModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </optgroup>
          </select>
          <ChevronDown className="pointer-events-none absolute right-0.5 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
        </div>

        <span className="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-0.5" />

        {/* Se não estiver logado no provedor selecionado, botão abre o Pop-up direto */}
        {!isCurrentProviderLogged && !isTesting && (
          <button
            type="button"
            onClick={() => handleOpenProviderLoginPopup(currentModel.provider, currentModel.id)}
            title={`Abrir Pop-up de Login do ${currentModel.shortProviderName}`}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
          >
            <LogIn className="h-3 w-3 shrink-0" />
            <span>Entrar {currentModel.shortProviderName}</span>
          </button>
        )}

        {/* Botão de Status Real SSO + Sanity Check (Abre o Modal Inspetor) */}
        <button
          type="button"
          onClick={() => setIsInspectorOpen(true)}
          title="Abrir Central de Conexões e Teste das IAs"
          className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all ${
            isTesting
              ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
              : isModelReallyVerified
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25'
              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25'
          }`}
        >
          {isTesting ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              <span className="hidden 2xl:inline">Consultando...</span>
            </>
          ) : isModelReallyVerified ? (
            <>
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xl:inline">IA Ativa</span>
            </>
          ) : (
            <>
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden 2xl:inline">Sem Login</span>
            </>
          )}
        </button>
      </div>

      <SanityCheckConsoleModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        selectedModelId={selectedModelId}
        currentModel={currentModel}
        geminiModels={geminiModels}
        geminiModelsSource={geminiModelsSource}
        isLoadingGeminiModels={isLoadingGeminiModels}
        onRefreshGeminiModels={refreshLiveGeminiModels}
        providersAuth={providersAuth}
        isCurrentProviderLogged={isCurrentProviderLogged}
        isSsoLoading={isSsoLoading}
        isTesting={isTesting}
        customQuestionInput={customQuestionInput}
        setCustomQuestionInput={setCustomQuestionInput}
        sanityResult={sanityResult}
        sanityError={sanityError}
        onSelectModelChange={handleSelectModelChange}
        onOpenPopup={handleOpenProviderLoginPopup}
        onRevokeProvider={handleRevokeProvider}
        onRunSanityCheck={runSanityCheckForModel}
        onSendCustomQuestion={handleSendCustomQuestion}
      />
    </>
  );
}
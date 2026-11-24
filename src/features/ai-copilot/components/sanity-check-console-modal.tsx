'use client';
import * as React from 'react';
import { Cpu, CheckCircle2, XCircle, Activity, RefreshCw, LogOut, ExternalLink, Send, MessageSquare } from 'lucide-react';
import { AI_MODELS_CATALOG, SANITY_CHECK_PROMPT, type AiModelDescriptor, type AiModelId, type AiProviderId, type SanityCheckValidationResult } from '@/features/ai-copilot/models';
import { Modal } from '@/shared/ui/modal';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Select } from '@/shared/ui/input';
import { ProviderAccountsStrip, type ProviderAuthState } from '@/features/ai-copilot/components/provider-accounts-strip';
import { AiDiagnosticErrorCard, getFriendlyDiagnosticBadge } from '@/features/ai-copilot/components/ai-diagnostic-error-card';
const SUGGESTED_TEST_QUESTIONS = [
  'Qual é o seu modelo?', 'Quanto é 15% de R$ 4.800,00 e quanto sobra?',
  'Qual a diferença prática entre custo fixo estático e gasto variável?',
  'Se eu guardar R$ 850 por mês, em quantos meses junto R$ 10.200?', ];
export function SanityCheckConsoleModal({
  isOpen, onClose, selectedModelId, currentModel, geminiModels, geminiModelsSource,
  isLoadingGeminiModels, onRefreshGeminiModels, providersAuth, isCurrentProviderLogged,
  isSsoLoading, isTesting, customQuestionInput, setCustomQuestionInput, sanityResult, sanityError,
  onSelectModelChange, onOpenPopup, onRevokeProvider, onRunSanityCheck, onSendCustomQuestion, }: {
  isOpen: boolean;
  onClose: () => void;
  selectedModelId: AiModelId;
  currentModel: AiModelDescriptor;
  geminiModels: AiModelDescriptor[];
  geminiModelsSource: 'LIVE_GOOGLE_API' | 'FALLBACK_CATALOG';
  isLoadingGeminiModels: boolean;
  onRefreshGeminiModels: () => void;
  providersAuth: Record<AiProviderId, ProviderAuthState>;
  isCurrentProviderLogged: boolean;
  isSsoLoading: boolean;
  isTesting: boolean;
  customQuestionInput: string;
  setCustomQuestionInput: (val: string) => void;
  sanityResult: SanityCheckValidationResult | null;
  sanityError: string | null;
  onSelectModelChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onOpenPopup: (provider: AiProviderId, targetModelId?: string) => void;
  onRevokeProvider: (provider: AiProviderId) => void;
  onRunSanityCheck: (modelId: AiModelId, persist: boolean, prompt: string) => void;
  onSendCustomQuestion: (e: React.FormEvent) => void;
}) {
  const openaiModels = AI_MODELS_CATALOG.filter((m) => m.provider === 'OPENAI');
  const claudeModels = AI_MODELS_CATALOG.filter((m) => m.provider === 'CLAUDE');
  return ( <Modal isOpen={isOpen} onClose={onClose}
      maxWidth="2xl" title="Central de Conexões e Teste de IA"
      subtitle="Gerencie suas contas conectadas via Pop-up (ChatGPT, Gemini e Claude) e envie perguntas reais ao modelo selecionado"
      footer={
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!isCurrentProviderLogged ? ( <Button
                variant="primary"
                size="sm" onClick={() => onOpenPopup(currentModel.provider, currentModel.id)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Entrar no {currentModel.shortProviderName} (Abrir Pop-up) </Button>
            ) : ( <Button
                variant="destructive"
                size="sm" onClick={() => onRevokeProvider(currentModel.provider)} isLoading={isSsoLoading}
              >
                <LogOut className="h-3.5 w-3.5" />
                Desconectar {currentModel.shortProviderName} </Button>
            )} </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <Button variant="secondary"
              size="sm"
              onClick={() => { setCustomQuestionInput(SANITY_CHECK_PROMPT);
                onRunSanityCheck(selectedModelId, true, SANITY_CHECK_PROMPT);
              }} isLoading={isTesting}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Testar Conexão Agora </Button>
            <Button variant="primary" size="sm" onClick={onClose}>
              Fechar </Button>
          </div> </div>
      }
    >
      <div className="space-y-4">
        <ProviderAccountsStrip
          currentModel={currentModel}
          geminiModels={geminiModels}
          providersAuth={providersAuth}
          isCurrentProviderLogged={isCurrentProviderLogged}
          isSsoLoading={isSsoLoading}
          onOpenPopup={onOpenPopup}
          onRevokeProvider={onRevokeProvider}
        />
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/80 p-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-500 shrink-0" />
              <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                2. Modelo Selecionado no Header & Rota Injetada
              </h4> </div>
            <Badge variant="transfer">{currentModel.providerGroupLabel}</Badge> </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-slate-500 dark:text-zinc-400 text-[11px]">
                  Modelo Ativo ({geminiModelsSource === 'LIVE_GOOGLE_API' ? `${geminiModels.length} Gemini da Google` : 'Troca Instantânea'})
                </span>
                <button
                  type="button"
                  onClick={onRefreshGeminiModels}
                  disabled={isLoadingGeminiModels}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingGeminiModels ? 'animate-spin' : ''}`} />
                  <span>Atualizar Google</span>
                </button>
              </div>
              <Select value={selectedModelId} onChange={onSelectModelChange} className="h-9 text-xs font-semibold">
                <optgroup label="OpenAI / ChatGPT">
                  {openaiModels.map((m) => ( <option key={m.id} value={m.id}>
                      {m.displayName} ({m.id}) </option>
                  ))}
                </optgroup>
                <optgroup label="Google Gemini">
                  {geminiModels.map((m) => ( <option key={m.id} value={m.id}>
                      {m.displayName} ({m.id}) </option>
                  ))}
                </optgroup>
                <optgroup label="Anthropic Claude">
                  {claudeModels.map((m) => ( <option key={m.id} value={m.id}>
                      {m.displayName} ({m.id}) </option>
                  ))}
                </optgroup>
              </Select> </div>
            <div className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3 flex flex-col justify-center">
              <span className="text-slate-500 dark:text-zinc-400 block text-[11px]">
                Sessão Vinculada ao Modelo </span>
              <strong
                className={`text-xs font-mono mt-1 block truncate ${
                  isCurrentProviderLogged
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isCurrentProviderLogged
                  ? providersAuth[currentModel.provider]?.email
                    ? `Conectado (${providersAuth[currentModel.provider]?.email})`
                    : `${currentModel.envVarName} (Chave API)`
                  : `Desconectado (${currentModel.shortProviderName} requer login)`}
              </strong>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                POST {currentModel.endpointUrl} </span>
            </div> </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/80 p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-amber-500 shrink-0" />
              <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                3. Teste Interativo da IA em Tempo Real
              </h4> </div>
            {sanityResult && ( <Badge variant={sanityResult.passed ? 'income' : 'expense'}>
                {sanityResult.passed ? ( <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Respondido em{' '}
                    {sanityResult.latencyMs}ms
                  </>
                ) : ( <>
                    <XCircle className="h-3.5 w-3.5" />{' '}
                    {getFriendlyDiagnosticBadge(sanityResult.diagnosticCode)}
                  </>
                )}
              </Badge>
            )} </div>
          <form onSubmit={onSendCustomQuestion} className="space-y-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400">
              Faça qualquer pergunta ao modelo <strong>{currentModel.displayName}</strong> para testar a resposta ao vivo:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text" value={customQuestionInput} onChange={(e) => setCustomQuestionInput(e.target.value)}
                placeholder="Digite sua pergunta para a IA..."
                className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <Button type="submit" variant="primary" size="md" isLoading={isTesting} className="shrink-0">
                <Send className="h-3.5 w-3.5" />
                <span>Perguntar à IA</span> </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 mr-1">Testes rápidos:</span>
              {SUGGESTED_TEST_QUESTIONS.map((q) => ( <button key={q}
                  type="button" disabled={isTesting}
                  onClick={() => { setCustomQuestionInput(q);
                    onRunSanityCheck(selectedModelId, false, q);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-500/60 text-slate-600 dark:text-zinc-300 transition-colors"
                >
                  {q}
                </button>
              ))} </div>
          </form>
          {(sanityError || sanityResult?.error) && (
            <AiDiagnosticErrorCard
              diagnosticCode={sanityResult?.diagnosticCode}
              rawError={sanityResult?.error || sanityError || ''}
              currentModel={currentModel}
              isCurrentProviderLogged={isCurrentProviderLogged}
              onOpenPopup={onOpenPopup}
            />
          )}
          {sanityResult && sanityResult.rawResponse ? ( <div className="space-y-2.5 text-xs">
              <div className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-100 dark:border-zinc-800 pb-1.5">
                  <span>
                    Pergunta enviada: <strong className="text-slate-700 dark:text-zinc-200">&ldquo;{sanityResult.promptSent}&rdquo;</strong>
                  </span>
                  <span className="font-mono">{sanityResult.latencyMs}ms</span> </div>
                <div className="space-y-1 pt-0.5">
                  <span className="text-[11px] text-slate-400 font-medium block">
                    Resposta gerada ao vivo por {sanityResult.selectedModelName}: </span>
                  <div className="text-xs text-slate-900 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap font-medium bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                    {sanityResult.rawResponse} </div>
                </div> </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-emerald-500" />
                  Identidade confirmada:{' '}
                  <strong className="text-slate-900 dark:text-zinc-100">
                    {sanityResult.matchedKeyword || sanityResult.selectedModelName}
                  </strong> </span>
                <span>
                  Conta ativa:{' '}
                  <strong className="text-slate-900 dark:text-zinc-100">
                    {sanityResult.authenticatedAccountEmail || 'Chave API Direta'}
                  </strong> </span>
              </div> </div>
          ) : ( !sanityError && (
              <div className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3.5 text-xs text-slate-500 dark:text-zinc-400">
                {isTesting
                  ? `Aguardando resposta em tempo real do modelo ${currentModel.displayName}...`
                  : `Faça login no pop-up do ${currentModel.shortProviderName} e envie uma pergunta acima para receber a resposta em tempo real.`}
              </div> )
          )} </div>
      </div>
    </Modal> );
}

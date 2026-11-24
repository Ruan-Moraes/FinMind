'use client';

import * as React from 'react';
import { Sparkles, Check, Zap, KeyRound, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { FormField, Input, Select } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import {
  AI_PROVIDER_META,
  type AiProviderId,
  type AiConnectionMode,
} from '@/features/ai-copilot/providers';
import { updateAiSettingsAction } from '@/features/ai-copilot/actions/ai-governance.actions';
import {
  PROVIDER_CONNECTOR_UI,
  useLiveProviderModels,
} from '@/features/ai-copilot/hooks/use-live-provider-models';

export function AiProviderConnectorPanel(props: {
  provider: AiProviderId; setProvider: (p: AiProviderId) => void;
  connectionMode: AiConnectionMode; setConnectionMode: (m: AiConnectionMode) => void;
  openaiKey: string; setOpenaiKey: (k: string) => void;
  geminiKey: string; setGeminiKey: (k: string) => void;
  claudeKey: string; setClaudeKey: (k: string) => void;
  openaiModel: string; setOpenaiModel: (m: string) => void;
  geminiModel: string; setGeminiModel: (m: string) => void;
  claudeModel: string; setClaudeModel: (m: string) => void;
  configSavedBanner: boolean; isSavingConfig: boolean; handleSaveAiConfig: () => void;
}) {
  const {
    provider, setProvider, connectionMode, setConnectionMode,
    openaiKey, setOpenaiKey, geminiKey, setGeminiKey, claudeKey, setClaudeKey,
    openaiModel, setOpenaiModel, geminiModel, setGeminiModel, claudeModel, setClaudeModel,
    configSavedBanner, isSavingConfig, handleSaveAiConfig,
  } = props;

  const activeModel =
    provider === 'OPENAI' ? openaiModel : provider === 'GEMINI' ? geminiModel : claudeModel;
  const activeKey =
    provider === 'OPENAI' ? openaiKey : provider === 'GEMINI' ? geminiKey : claudeKey;
  const setActiveKey =
    provider === 'OPENAI' ? setOpenaiKey : provider === 'GEMINI' ? setGeminiKey : setClaudeKey;

  const { models, source, isLoading: isRefreshingModels, refresh } = useLiveProviderModels(
    provider,
    activeModel
  );
  const ui = PROVIDER_CONNECTOR_UI[provider];

  const handleModelChange = async (next: string) => {
    const nextOpenai = provider === 'OPENAI' ? next : openaiModel;
    const nextGemini = provider === 'GEMINI' ? next : geminiModel;
    const nextClaude = provider === 'CLAUDE' ? next : claudeModel;
    if (provider === 'OPENAI') setOpenaiModel(next);
    if (provider === 'GEMINI') setGeminiModel(next);
    if (provider === 'CLAUDE') setClaudeModel(next);

    await updateAiSettingsAction({
      aiProvider: provider,
      aiConnectionMode: connectionMode,
      openaiApiKey: openaiKey,
      geminiApiKey: geminiKey,
      claudeApiKey: claudeKey,
      openaiModel: nextOpenai,
      geminiModel: nextGemini,
      claudeModel: nextClaude,
    });
  };

  const openSsoPopup = () => {
    const w = 480;
    const h = 680;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
    window.open(
      `/sso-popup?provider=${provider}&modelId=${encodeURIComponent(activeModel)}`,
      `FinMind_SSO_${provider}`,
      `width=${w},height=${h},left=${left},top=${top}`
    );
  };

  return (
    <div data-agent-id="ai.panel.providers" data-agent-sensitive="true" className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/70 p-6 space-y-5">
      <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500 shrink-0" />
            <h2 className="text-lg font-semibold">
              Central de Inteligência Artificial (ChatGPT, Gemini & Claude)
            </h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Utilize seu <strong>Plano de Assinatura</strong> nos 3 provedores ou conecte via{' '}
            <strong>Chave de Acesso</strong>. Suas preferências ficam salvas automaticamente.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2.5 shrink-0 md:ml-auto">
          {configSavedBanner && (
            <Badge variant="income">
              <Check className="h-3.5 w-3.5" /> Salvo
            </Badge>
          )}
          <Button variant="primary" size="md" onClick={handleSaveAiConfig} isLoading={isSavingConfig}>
            Salvar Conexão
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['OPENAI', 'GEMINI', 'CLAUDE'] as AiProviderId[]).map((id) => {
          const meta = AI_PROVIDER_META[id];
          const isSelected = provider === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setProvider(id)}
              className={`rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-indigo-500 bg-white dark:bg-zinc-950 shadow-md ring-1 ring-indigo-500'
                  : 'border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/50 hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.badgeColor }} />
                  {meta.name}
                </span>
                {isSelected && <Badge variant="transfer">Ativo</Badge>}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5">
                Assinatura: <strong>{meta.subscriptionName}</strong>
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <button
          type="button"
          onClick={() => setConnectionMode('SUBSCRIPTION')}
          className={`rounded-xl border p-4 text-left transition-all ${
            connectionMode === 'SUBSCRIPTION'
              ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10'
              : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              Modo 1: Usar Meu Plano de Assinatura (Custo Zero)
            </span>
            {connectionMode === 'SUBSCRIPTION' && <Badge variant="income">Selecionado</Badge>}
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Use sua assinatura do <strong>ChatGPT Plus</strong>, <strong>Gemini Advanced</strong> ou{' '}
            <strong>Claude Pro</strong> sem precisar de chave paga.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setConnectionMode('API_QUOTA')}
          className={`rounded-xl border p-4 text-left transition-all ${
            connectionMode === 'API_QUOTA'
              ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10'
              : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-indigo-500" />
              Modo 2: Conexão via Chave de Acesso
            </span>
            {connectionMode === 'API_QUOTA' && <Badge variant="transfer">Selecionado</Badge>}
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Executa diretamente usando sua chave da OpenAI Platform, Google AI Studio (com cota gratuita) ou Anthropic Console.
          </p>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
        <FormField
          label={ui.modelLabel}
          hint={
            source === 'LIVE_API'
              ? `${models.length} modelos liberados pela ${ui.company}`
              : `Conecte sua chave para listar todos os modelos da ${ui.company}`
          }
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Select value={activeModel} onChange={(e) => void handleModelChange(e.target.value)}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} ({m.id})
                  </option>
                ))}
              </Select>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isRefreshingModels}
              title={`Atualizar lista de modelos direto da ${ui.company}`}
              className="h-11 px-4 shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-semibold transition-all shadow-sm disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isRefreshingModels ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </FormField>

        {connectionMode === 'API_QUOTA' ? (
          <FormField
            label={ui.keyLabel}
            hint="Se mascarada, mantém a chave já salva com segurança"
          >
            <Input
              type="password"
              placeholder={ui.placeholder}
              value={activeKey}
              onChange={(e) => setActiveKey(e.target.value)}
            />
          </FormField>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              {ui.ssoLabel}
            </span>
            <Button variant="primary" size="md" className="w-full h-11" onClick={openSsoPopup}>
              <ExternalLink className="h-4 w-4" />
              {ui.ssoButton}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

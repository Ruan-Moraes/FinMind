'use client';

import * as React from 'react';
import { KeyRound, UserCheck, ExternalLink, LogOut } from 'lucide-react';
import { type AiModelDescriptor, type AiProviderId } from '@/features/ai-copilot/models';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';

export interface ProviderAuthState {
  authenticated: boolean;
  method: 'POPUP_OAUTH' | 'API_KEY' | 'NONE';
  email: string | null;
  maskedKey?: string;
}

const PROVIDER_ROWS: Array<{
  id: AiProviderId;
  title: string;
  shortName: string;
  modelsText: string;
  accentColor: string;
}> = [
  {
    id: 'OPENAI',
    title: 'ChatGPT (OpenAI)',
    shortName: 'ChatGPT',
    modelsText: 'GPT-4o Mini • GPT-4o • OpenAI o3-mini',
    accentColor: '#10b981',
  },
  {
    id: 'GEMINI',
    title: 'Google Gemini',
    shortName: 'Gemini',
    modelsText: 'Carregado dinamicamente da sua conta Google',
    accentColor: '#3b82f6',
  },
  {
    id: 'CLAUDE',
    title: 'Anthropic Claude',
    shortName: 'Claude',
    modelsText: 'Claude 3.5 Haiku • Claude 3.5 Sonnet • Claude 3.7 Sonnet',
    accentColor: '#d97706',
  },
];

export function ProviderAccountsStrip({
  currentModel,
  geminiModels,
  providersAuth,
  isCurrentProviderLogged,
  isSsoLoading,
  onOpenPopup,
  onRevokeProvider,
}: {
  currentModel: AiModelDescriptor;
  geminiModels?: AiModelDescriptor[];
  providersAuth: Record<AiProviderId, ProviderAuthState>;
  isCurrentProviderLogged: boolean;
  isSsoLoading: boolean;
  onOpenPopup: (provider: AiProviderId, targetModelId?: string) => void;
  onRevokeProvider: (provider: AiProviderId) => void;
}) {
  const geminiSummary =
    geminiModels && geminiModels.length > 0
      ? `${geminiModels.slice(0, 3).map((m) => m.displayName).join(' • ')}${
          geminiModels.length > 3 ? ` (+${geminiModels.length - 3} modelos)` : ''
        }`
      : 'Carregado dinamicamente da sua conta Google';
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/80 p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-indigo-500 shrink-0" />
          <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            1. Contas Conectadas (Isoladas por IA)
          </h4>
        </div>
        <Badge variant={isCurrentProviderLogged ? 'income' : 'expense'}>
          {isCurrentProviderLogged
            ? `${currentModel.shortProviderName} Conectado`
            : `${currentModel.shortProviderName} Desconectado`}
        </Badge>
      </div>

      <div className="space-y-2.5">
        {PROVIDER_ROWS.map((pRow) => {
          const state = providersAuth[pRow.id];
          const isSelectedProvider = currentModel.provider === pRow.id;
          const isLogged = Boolean(state?.authenticated);

          return (
            <div
              key={pRow.id}
              className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                isSelectedProvider
                  ? 'border-indigo-500/80 bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-zinc-800/90 bg-white/70 dark:bg-zinc-900/50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: `${pRow.accentColor}15`,
                    borderColor: `${pRow.accentColor}40`,
                  }}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: pRow.accentColor }}
                  />
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      {pRow.title}
                    </span>
                    <Badge variant={isLogged ? 'income' : 'neutral'}>
                      {isLogged ? 'Sessão Ativa' : 'Desconectado'}
                    </Badge>
                    {isLogged && state?.email && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 truncate max-w-[220px]">
                        <UserCheck className="h-3 w-3 shrink-0" />
                        {state.email}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                    {pRow.id === 'GEMINI' ? geminiSummary : pRow.modelsText}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 shrink-0 sm:ml-auto">
                <Button
                  variant={isLogged ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => onOpenPopup(pRow.id)}
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span>{isLogged ? 'Trocar Conta' : `Entrar no ${pRow.shortName}`}</span>
                </Button>

                {isLogged && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onRevokeProvider(pRow.id)}
                    isLoading={isSsoLoading}
                  >
                    <LogOut className="h-3.5 w-3.5 shrink-0" />
                    <span>Sair</span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

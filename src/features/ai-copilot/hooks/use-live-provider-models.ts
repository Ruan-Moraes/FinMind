'use client';

import * as React from 'react';
import { AI_MODELS_CATALOG, type AiProviderId } from '@/features/ai-copilot/models';

export interface LiveProviderModelItem {
  id: string;
  displayName: string;
  description: string;
}

export const PROVIDER_CONNECTOR_UI: Record<
  AiProviderId,
  { modelLabel: string; keyLabel: string; placeholder: string; ssoLabel: string; ssoButton: string; company: string }
> = {
  OPENAI: {
    modelLabel: 'Modelo OpenAI / ChatGPT Ativo', keyLabel: 'Chave de API OpenAI / ChatGPT',
    placeholder: 'sk-proj-...', ssoLabel: 'Autenticação Oficial de Chave (ChatGPT)',
    ssoButton: 'Configurar Credencial Oficial ChatGPT', company: 'OpenAI',
  },
  GEMINI: {
    modelLabel: 'Modelo Google Gemini Ativo', keyLabel: 'Chave de API Google Gemini (AI Studio)',
    placeholder: 'AIzaSy...', ssoLabel: 'Autenticação Oficial de Chave (Google Gemini)',
    ssoButton: 'Configurar Credencial Oficial Google Gemini', company: 'Google',
  },
  CLAUDE: {
    modelLabel: 'Modelo Anthropic Claude Ativo', keyLabel: 'Chave de API Anthropic Claude',
    placeholder: 'sk-ant-api03-...', ssoLabel: 'Autenticação Oficial de Chave (Anthropic Claude)',
    ssoButton: 'Configurar Credencial Oficial Anthropic Claude', company: 'Anthropic',
  },
};

function getCatalogFallback(provider: AiProviderId): LiveProviderModelItem[] {
  return AI_MODELS_CATALOG.filter((m) => m.provider === provider).map((m) => ({
    id: m.id,
    displayName: m.displayName,
    description: m.description,
  }));
}

export function useLiveProviderModels(provider: AiProviderId, currentSelectedId?: string) {
  const [models, setModels] = React.useState<LiveProviderModelItem[]>(() =>
    getCatalogFallback(provider)
  );
  const [source, setSource] = React.useState<'LIVE_API' | 'FALLBACK_CATALOG'>('FALLBACK_CATALOG');
  const [isLoading, setIsLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ai/models?provider=${provider}`, { cache: 'no-store' });
      const data = (await res.json()) as {
        source?: string;
        models?: LiveProviderModelItem[];
      };
      if (Array.isArray(data.models) && data.models.length > 0) {
        setModels(data.models);
        setSource(
          data.source === 'LIVE_PROVIDER_API' || data.source === 'LIVE_GOOGLE_API'
            ? 'LIVE_API'
            : 'FALLBACK_CATALOG'
        );
      }
    } catch {
      // mantém catálogo fallback
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  React.useEffect(() => {
    setModels(getCatalogFallback(provider));
    void refresh();
  }, [provider, refresh]);

  const effectiveModels = React.useMemo(() => {
    if (!currentSelectedId || models.some((m) => m.id === currentSelectedId)) return models;
    return [
      { id: currentSelectedId, displayName: currentSelectedId, description: 'Modelo selecionado' },
      ...models,
    ];
  }, [models, currentSelectedId]);

  return { models: effectiveModels, source, isLoading, refresh };
}

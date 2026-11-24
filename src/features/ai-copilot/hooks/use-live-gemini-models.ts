'use client';

import * as React from 'react';
import {
  AI_MODELS_CATALOG,
  getAiModelDescriptor,
  type AiModelDescriptor,
} from '@/features/ai-copilot/models';

const FALLBACK_GEMINI = AI_MODELS_CATALOG.filter((m) => m.provider === 'GEMINI');

export function useLiveGeminiModels(activeModelId?: string) {
  const [models, setModels] = React.useState<AiModelDescriptor[]>(FALLBACK_GEMINI);
  const [source, setSource] = React.useState<'LIVE_GOOGLE_API' | 'FALLBACK_CATALOG'>(
    'FALLBACK_CATALOG'
  );
  const [isLoading, setIsLoading] = React.useState(false);

  const refreshLiveGeminiModels = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/models', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data.models) && data.models.length > 0) {
        setModels(data.models);
        setSource(data.source === 'LIVE_GOOGLE_API' ? 'LIVE_GOOGLE_API' : 'FALLBACK_CATALOG');
      }
    } catch {
      // mantém catálogo padrão em caso de falha de rede
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshLiveGeminiModels();
  }, [refreshLiveGeminiModels]);

  const resolvedModels = React.useMemo(() => {
    if (!activeModelId) return models;
    const descriptor = getAiModelDescriptor(activeModelId);
    if (descriptor.provider !== 'GEMINI') return models;
    if (models.some((m) => m.id === descriptor.id)) return models;
    return [descriptor, ...models];
  }, [models, activeModelId]);

  return {
    geminiModels: resolvedModels,
    geminiModelsSource: source,
    isLoadingGeminiModels: isLoading,
    refreshLiveGeminiModels,
  };
}

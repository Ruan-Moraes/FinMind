'use client';

import * as React from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { AiModelDescriptor } from '@/features/ai-copilot/models';

interface GeminiPopupModelPickerProps {
  apiKey: string;
  selectedModelId: string;
  fallbackModels: AiModelDescriptor[];
  onSelectModel: (modelId: string) => void;
}

export function GeminiPopupModelPicker({
  apiKey,
  selectedModelId,
  fallbackModels,
  onSelectModel,
}: GeminiPopupModelPickerProps) {
  const [models, setModels] = React.useState<AiModelDescriptor[]>(fallbackModels);
  const [source, setSource] = React.useState<'FALLBACK_CATALOG' | 'LIVE_GOOGLE_API'>(
    'FALLBACK_CATALOG'
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);

  const handleDiscoverModels = React.useCallback(async () => {
    const trimmed = apiKey.trim();
    if (trimmed.length <= 8) {
      setStatusMsg('Cole sua chave Google Gemini primeiro para listar os modelos liberados.');
      return;
    }
    setIsLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatusMsg(data.error || 'Não foi possível consultar os modelos na Google.');
        return;
      }
      const live: AiModelDescriptor[] = Array.isArray(data.models) ? data.models : fallbackModels;
      setModels(live);
      setSource(data.source === 'LIVE_GOOGLE_API' ? 'LIVE_GOOGLE_API' : 'FALLBACK_CATALOG');
      if (live.length > 0 && !live.some((m) => m.id === selectedModelId)) {
        onSelectModel(live[0].id);
      }
      setStatusMsg(`${live.length} modelo(s) ativo(s) encontrado(s) na sua conta Google.`);
    } catch {
      setStatusMsg('Falha de comunicação ao buscar modelos da Google.');
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, fallbackModels, selectedModelId, onSelectModel]);

  const lastAutoFetchedKeyRef = React.useRef('');
  React.useEffect(() => {
    const trimmed = apiKey.trim();
    if (trimmed.length < 30 || trimmed === lastAutoFetchedKeyRef.current) return;
    const timer = setTimeout(() => {
      lastAutoFetchedKeyRef.current = trimmed;
      void handleDiscoverModels();
    }, 500);
    return () => clearTimeout(timer);
  }, [apiKey, handleDiscoverModels]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          {source === 'LIVE_GOOGLE_API'
            ? `Modelos liberados pela Google (${models.length})`
            : 'Modelo Google Gemini'}
        </span>
        <button
          type="button"
          onClick={handleDiscoverModels}
          disabled={isLoading}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          <span>Buscar da Google</span>
        </button>
      </div>

      <select
        aria-label="Modelo Google Gemini"
        value={selectedModelId}
        onChange={(e) => onSelectModel(e.target.value)}
        className="w-full h-9 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 text-xs font-medium text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.displayName} ({m.id})
          </option>
        ))}
      </select>

      {statusMsg && (
        <p className="text-[11px] text-slate-500 dark:text-zinc-400">{statusMsg}</p>
      )}
    </div>
  );
}

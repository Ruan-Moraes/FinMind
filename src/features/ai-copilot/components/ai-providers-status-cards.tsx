'use client';

import * as React from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import {
  AI_PROVIDER_IDS,
  PROVIDER_STATIC_META,
  PROVIDER_STATUS_LABELS,
  type AiProviderId,
  type GlobalAiState,
} from '@/features/ai-copilot/domain/ai-provider-types';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';

export function AiProvidersStatusCards(props: {
  state: GlobalAiState;
  editingProvider: AiProviderId | null;
  setEditingProvider: (p: AiProviderId | null) => void;
  onSaveKey: (provider: AiProviderId, apiKey: string) => Promise<{ ok: boolean; error?: string }>;
  onRemoveKey: (provider: AiProviderId) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { state, editingProvider, setEditingProvider, onSaveKey, onRemoveKey } = props;
  const [keyDraft, setKeyDraft] = React.useState('');
  const [keySaving, setKeySaving] = React.useState(false);
  const [keyActionError, setKeyActionError] = React.useState<string | null>(null);

  const handleSaveInlineKey = async (provider: AiProviderId) => {
    setKeySaving(true);
    setKeyActionError(null);
    try {
      const res = await onSaveKey(provider, keyDraft);
      if (!res.ok) setKeyActionError(res.error || 'Chave inválida.');
      else {
        setKeyDraft('');
        setEditingProvider(null);
      }
    } finally {
      setKeySaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {AI_PROVIDER_IDS.map((provId) => {
          const pState = state.providers[provId];
          const meta = PROVIDER_STATIC_META[provId];
          const statusInfo = PROVIDER_STATUS_LABELS[pState.status];
          const isEditing = editingProvider === provId;
          return (
            <div
              key={provId}
              className={`rounded-xl border p-3 space-y-2 ${
                state.activeProvider === provId
                  ? 'border-indigo-500/60 bg-indigo-500/5'
                  : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-900 dark:text-zinc-100">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.badgeColor }} />
                  {meta.shortName}
                </span>
                <Badge
                  variant={
                    statusInfo.tone === 'emerald'
                      ? 'income'
                      : statusInfo.tone === 'rose'
                      ? 'expense'
                      : 'transfer'
                  }
                >
                  {statusInfo.label}
                </Badge>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {pState.keyPreview ? <span className="font-mono">{pState.keyPreview}</span> : 'Sem chave cadastrada'}
                {pState.models.length > 0 && ` • ${pState.models.length} modelos`}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="flex-1 !h-7 !text-[11px]"
                  onClick={() => {
                    setEditingProvider(isEditing ? null : provId);
                    setKeyDraft('');
                    setKeyActionError(null);
                  }}
                >
                  <KeyRound className="h-3 w-3" />
                  {pState.hasStoredKey ? 'Trocar chave' : 'Configurar'}
                </Button>
                {pState.hasStoredKey && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="!h-7 !px-2"
                    aria-label={`Remover chave ${meta.shortName}`}
                    onClick={() => void onRemoveKey(provId)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editingProvider && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-100">
              {PROVIDER_STATIC_META[editingProvider].keyLabel}
            </span>
            <a
              href={PROVIDER_STATIC_META[editingProvider].consoleUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Obter em {PROVIDER_STATIC_META[editingProvider].consoleLabel}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder={PROVIDER_STATIC_META[editingProvider].keyPlaceholder}
              className="flex-1 h-9 text-xs"
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={keySaving}
              disabled={!keyDraft.trim()}
              onClick={() => void handleSaveInlineKey(editingProvider)}
            >
              Salvar e Validar
            </Button>
          </div>
          {keyActionError && <p className="text-[11px] text-rose-600 dark:text-rose-400">{keyActionError}</p>}
        </div>
      )}
    </div>
  );
}

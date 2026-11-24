'use client';

import * as React from 'react';
import {
  AI_PROVIDER_IDS,
  PROVIDER_STATIC_META,
  type AiProviderId,
  type DiscoveredAiModel,
  type ProviderIntegrationState,
} from '@/features/ai-copilot/domain/ai-provider-types';
import { SearchableSelect } from '@/shared/ui/searchable-select';

function formatOptionLabel(m: DiscoveredAiModel, includeId: boolean): string {
  const tags: string[] = [];
  if (m.isDeprecated) tags.push('Descontinuado');
  if (!m.compatibleWithApp) tags.push('Incompatível');
  const suffix = tags.length > 0 ? ` [${tags.join(' • ')}]` : '';
  return includeId && m.displayName.toLowerCase() !== m.id.toLowerCase()
    ? `${m.displayName} (${m.id})${suffix}`
    : `${m.displayName}${suffix}`;
}

export function AiModelSelector(props: {
  mode: 'global' | 'provider';
  activeProvider: AiProviderId;
  activeModelId: string;
  providers: Record<AiProviderId, ProviderIntegrationState>;
  onSelect: (provider: AiProviderId, modelId: string) => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const {
    mode, activeProvider, activeModelId, providers, onSelect,
    ariaLabel = 'Selecionar modelo de IA', className = '', disabled = false,
  } = props;

  const targetProviders: AiProviderId[] = mode === 'global' ? AI_PROVIDER_IDS : [activeProvider];

  // Valor composto no modo global ("PROVIDER::modelId") evita colisões e preserva o provedor exato
  const currentValue =
    mode === 'global'
      ? activeModelId
        ? `${activeProvider}::${activeModelId}`
        : '__empty__'
      : activeModelId || '__empty__';

  const anyLoading = targetProviders.some((p) => providers[p].modelsLoading);
  const totalModels = targetProviders.reduce((acc, p) => acc + providers[p].models.length, 0);

  const selectedProviderState = providers[activeProvider];
  const selectedExistsInList = Boolean(
    activeModelId && selectedProviderState.models.some((m) => m.id === activeModelId)
  );

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const raw = e.target.value;
    if (!raw || raw === '__empty__') return;
    if (mode === 'global') {
      const sepIdx = raw.indexOf('::');
      if (sepIdx === -1) return;
      const prov = raw.slice(0, sepIdx) as AiProviderId;
      const modelId = raw.slice(sepIdx + 2);
      if (modelId) onSelect(prov, modelId);
    } else {
      onSelect(activeProvider, raw);
    }
  };

  return (
    <SearchableSelect
      aria-label={ariaLabel}
      value={currentValue}
      onChange={handleChange}
      disabled={disabled || (anyLoading && totalModels === 0)}
      className={className}
    >
      {totalModels === 0 && !activeModelId && (
        <option value="__empty__" disabled>
          {anyLoading
            ? 'Carregando modelos oficiais...'
            : 'Configure uma chave de API para carregar modelos'}
        </option>
      )}

      {activeModelId && !selectedExistsInList && (
        <option value={currentValue}>
          {activeModelId} —{' '}
          {selectedProviderState.status === 'NOT_CONFIGURED'
            ? `${PROVIDER_STATIC_META[activeProvider].shortName} não configurado`
            : selectedProviderState.modelsLoading
            ? 'Validando modelo...'
            : 'Indisponível na API'}
        </option>
      )}

      {mode === 'global'
        ? targetProviders.map((provId) => {
            const pState = providers[provId];
            const meta = PROVIDER_STATIC_META[provId];
            if (pState.models.length === 0) return null;
            return (
              <optgroup key={provId} label={`${meta.name} (${pState.models.length})`}>
                {pState.models.map((m) => (
                  <option key={`${provId}::${m.id}`} value={`${provId}::${m.id}`}>
                    {formatOptionLabel(m, true)}
                  </option>
                ))}
              </optgroup>
            );
          })
        : selectedProviderState.models.map((m) => (
            <option key={m.id} value={m.id}>
              {formatOptionLabel(m, true)}
            </option>
          ))}
    </SearchableSelect>
  );
}

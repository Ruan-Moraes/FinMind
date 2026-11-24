import {
  AI_PROVIDER_IDS,
  mapDiagnosticCodeToProviderStatus,
  type AiProviderId,
  type GlobalAiState,
  type IntegrationDiagnosticCode,
  type ProviderIntegrationState,
} from '@/features/ai-copilot/domain/ai-provider-types';

export function makeEmptyProviderState(provider: AiProviderId): ProviderIntegrationState {
  return {
    provider,
    hasStoredKey: false,
    hasEnvKey: false,
    keyPreview: '',
    credentialSource: 'NONE',
    status: 'NOT_CONFIGURED',
    selectedModelId: '',
    selectedModelAvailable: false,
    models: [],
    modelsLoading: false,
    modelsFetchedAt: null,
    lastVerifiedAt: null,
    error: null,
  };
}

export function createInitialGlobalAiState(initial?: Partial<GlobalAiState>): GlobalAiState {
  const activeProvider = initial?.activeProvider || 'OPENAI';
  const providers: Record<AiProviderId, ProviderIntegrationState> = {
    OPENAI: initial?.providers?.OPENAI || makeEmptyProviderState('OPENAI'),
    GEMINI: initial?.providers?.GEMINI || makeEmptyProviderState('GEMINI'),
    CLAUDE: initial?.providers?.CLAUDE || makeEmptyProviderState('CLAUDE'),
  };
  return {
    activeProvider,
    activeModelId: initial?.activeModelId || providers[activeProvider].selectedModelId || '',
    providers,
  };
}

export function markConfiguredProvidersVerifying(prev: GlobalAiState): GlobalAiState {
  const nextProviders = { ...prev.providers };
  for (const p of AI_PROVIDER_IDS) {
    if (nextProviders[p].hasStoredKey || nextProviders[p].hasEnvKey) {
      nextProviders[p] = { ...nextProviders[p], status: 'VERIFYING', modelsLoading: true };
    }
  }
  return { ...prev, providers: nextProviders };
}

export function patchSingleProvider(
  prev: GlobalAiState,
  provider: AiProviderId,
  patch: Partial<ProviderIntegrationState>
): GlobalAiState {
  return {
    ...prev,
    providers: {
      ...prev.providers,
      [provider]: { ...prev.providers[provider], ...patch },
    },
  };
}

export function applyProviderSelectionState(
  prev: GlobalAiState,
  provider: AiProviderId,
  cleanModel: string
): GlobalAiState {
  const currentProv = prev.providers[provider];
  const available = currentProv.models.some((m) => m.id === cleanModel);
  return {
    activeProvider: provider,
    activeModelId: cleanModel,
    providers: {
      ...prev.providers,
      [provider]: {
        ...currentProv,
        selectedModelId: cleanModel,
        selectedModelAvailable: available,
        status: currentProv.status === 'OPERATIONAL' ? 'CONNECTED' : currentProv.status,
      },
    },
  };
}

export function applyProviderRuntimeError(
  prev: GlobalAiState,
  provider: AiProviderId,
  code: IntegrationDiagnosticCode,
  message: string,
  httpStatus?: number
): GlobalAiState {
  return patchSingleProvider(prev, provider, {
    status: mapDiagnosticCodeToProviderStatus(code),
    error: { code, message, httpStatus },
  });
}

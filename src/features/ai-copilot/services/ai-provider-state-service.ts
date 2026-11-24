import {
  AI_PROVIDER_IDS,
  mapDiagnosticCodeToProviderStatus,
  type AiProviderId,
  type GlobalAiState,
  type ProviderIntegrationState,
} from '@/features/ai-copilot/domain/ai-provider-types';
import {
  resolveUserProviderCredentials,
  type ResolvedProviderCredential,
} from '@/features/ai-copilot/services/ai-credentials-service';
import { discoverOfficialProviderModels } from '@/features/ai-copilot/services/official-models-discovery';

export async function buildProviderIntegrationState(params: {
  userId: string;
  cred: ResolvedProviderCredential;
  validateLive?: boolean;
  forceRefresh?: boolean;
}): Promise<ProviderIntegrationState> {
  const { userId, cred, validateLive = true, forceRefresh = false } = params;

  if (!cred.effectiveKey) {
    return {
      provider: cred.provider,
      hasStoredKey: cred.hasStoredKey,
      hasEnvKey: cred.hasEnvKey,
      keyPreview: '',
      credentialSource: 'NONE',
      status: 'NOT_CONFIGURED',
      selectedModelId: cred.selectedModelId,
      selectedModelAvailable: false,
      models: [],
      modelsLoading: false,
      modelsFetchedAt: null,
      lastVerifiedAt: null,
      error: null,
    };
  }

  if (!validateLive) {
    return {
      provider: cred.provider,
      hasStoredKey: cred.hasStoredKey,
      hasEnvKey: cred.hasEnvKey,
      keyPreview: cred.keyPreview,
      credentialSource: cred.credentialSource,
      status: 'UNVERIFIED',
      selectedModelId: cred.selectedModelId,
      selectedModelAvailable: false,
      models: [],
      modelsLoading: false,
      modelsFetchedAt: null,
      lastVerifiedAt: null,
      error: null,
    };
  }

  const discovery = await discoverOfficialProviderModels({
    userId,
    provider: cred.provider,
    apiKey: cred.effectiveKey,
    forceRefresh,
  });

  const selectedAvailable = Boolean(
    cred.selectedModelId && discovery.models.some((m) => m.id === cred.selectedModelId)
  );

  if (!discovery.ok) {
    return {
      provider: cred.provider,
      hasStoredKey: cred.hasStoredKey,
      hasEnvKey: cred.hasEnvKey,
      keyPreview: cred.keyPreview,
      credentialSource: cred.credentialSource,
      status: mapDiagnosticCodeToProviderStatus(discovery.diagnosticCode),
      selectedModelId: cred.selectedModelId,
      selectedModelAvailable: false,
      models: [],
      modelsLoading: false,
      modelsFetchedAt: null,
      lastVerifiedAt: discovery.fetchedAt,
      error: {
        code: discovery.diagnosticCode || 'NETWORK_ERROR',
        message: discovery.error || 'Falha ao validar credencial no provedor.',
        httpStatus: discovery.httpStatus,
      },
    };
  }

  return {
    provider: cred.provider,
    hasStoredKey: cred.hasStoredKey,
    hasEnvKey: cred.hasEnvKey,
    keyPreview: cred.keyPreview,
    credentialSource: cred.credentialSource,
    status: 'CONNECTED',
    selectedModelId: cred.selectedModelId,
    selectedModelAvailable: selectedAvailable,
    models: discovery.models,
    modelsLoading: false,
    modelsFetchedAt: discovery.fetchedAt,
    lastVerifiedAt: discovery.fetchedAt,
    error: null,
  };
}

/**
 * Monta o estado global autoritativo dos 3 provedores para o usuário autenticado.
 * Por padrão valida credenciais existentes via endpoints oficiais de listagem de modelos
 * (custo zero de tokens, com cache de 5 min por userId + hash da chave).
 */
export async function buildAuthoritativeGlobalAiState(
  userId: string,
  options?: {
    validateLive?: boolean;
    forceRefreshProviders?: AiProviderId[];
  }
): Promise<GlobalAiState> {
  const bundle = await resolveUserProviderCredentials(userId);
  const validateLive = options?.validateLive ?? true;
  const forceSet = new Set(options?.forceRefreshProviders || []);

  const entries = await Promise.all(
    AI_PROVIDER_IDS.map(async (provider) => {
      const state = await buildProviderIntegrationState({
        userId,
        cred: bundle.providers[provider],
        validateLive,
        forceRefresh: forceSet.has(provider),
      });
      return [provider, state] as const;
    })
  );

  const providers = Object.fromEntries(entries) as Record<AiProviderId, ProviderIntegrationState>;
  return {
    activeProvider: bundle.activeProvider,
    activeModelId: providers[bundle.activeProvider].selectedModelId,
    providers,
  };
}

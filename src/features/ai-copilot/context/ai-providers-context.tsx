'use client';

import * as React from 'react';
import {
  mapDiagnosticCodeToProviderStatus,
  type AiProviderId,
  type GlobalAiState,
  type IntegrationDiagnosticCode,
  type ProviderIntegrationState,
} from '@/features/ai-copilot/domain/ai-provider-types';
import type { SanityCheckValidationResult } from '@/features/ai-copilot/models';
import {
  removeProviderCredentialsAction,
  saveProviderCredentialsAction,
  selectActiveAiModelAction,
} from '@/features/ai-copilot/actions/ai-governance.actions';
import {
  applyProviderRuntimeError,
  applyProviderSelectionState,
  createInitialGlobalAiState,
  markConfiguredProvidersVerifying,
  patchSingleProvider,
} from '@/features/ai-copilot/context/ai-providers-state-helpers';

export interface AiProvidersContextValue {
  state: GlobalAiState;
  activeProviderState: ProviderIntegrationState;
  isHydrating: boolean;
  isTestingModel: boolean;
  lastSanityResult: SanityCheckValidationResult | null;
  lastSanityError: string | null;
  saveProviderKey: (
    provider: AiProviderId,
    apiKey: string,
    options?: { activateProvider?: boolean; modelId?: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  removeProviderKey: (provider: AiProviderId) => Promise<{ ok: boolean; error?: string }>;
  selectModel: (provider: AiProviderId, modelId: string) => Promise<{ ok: boolean; error?: string }>;
  refreshProviderModels: (provider: AiProviderId, force?: boolean) => Promise<void>;
  refreshAllProviders: (force?: boolean) => Promise<void>;
  runOperationalTest: (
    provider: AiProviderId,
    modelId: string,
    customPrompt?: string
  ) => Promise<SanityCheckValidationResult | null>;
  reportRuntimeError: (
    provider: AiProviderId,
    code: IntegrationDiagnosticCode,
    message: string,
    httpStatus?: number
  ) => void;
}

const AiProvidersContext = React.createContext<AiProvidersContextValue | null>(null);

export function AiProvidersProvider({
  initialState,
  children,
}: {
  initialState?: GlobalAiState;
  children: React.ReactNode;
}) {
  const [state, setState] = React.useState<GlobalAiState>(() => createInitialGlobalAiState(initialState));
  const [isHydrating, setIsHydrating] = React.useState(false);
  const [isTestingModel, setIsTestingModel] = React.useState(false);
  const [lastSanityResult, setLastSanityResult] = React.useState<SanityCheckValidationResult | null>(null);
  const [lastSanityError, setLastSanityError] = React.useState<string | null>(null);
  const seqRef = React.useRef<Record<AiProviderId | 'ALL', number>>({ OPENAI: 0, GEMINI: 0, CLAUDE: 0, ALL: 0 });

  const refreshAllProviders = React.useCallback(async (force = false) => {
    const reqId = ++seqRef.current.ALL;
    setIsHydrating(true);
    setState((prev) => markConfiguredProvidersVerifying(prev));
    try {
      const res = await fetch(force ? '/api/ai/providers/state?refresh=ALL' : '/api/ai/providers/state', { cache: 'no-store' });
      const data = (await res.json()) as { ok?: boolean; state?: GlobalAiState };
      if (seqRef.current.ALL === reqId && res.ok && data.ok && data.state) setState(data.state);
    } finally {
      if (seqRef.current.ALL === reqId) setIsHydrating(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshAllProviders(false);
  }, [refreshAllProviders]);

  const refreshProviderModels = React.useCallback(async (provider: AiProviderId, force = true) => {
    const reqId = ++seqRef.current[provider];
    setState((prev) => patchSingleProvider(prev, provider, { status: 'VERIFYING', modelsLoading: true, error: null }));
    try {
      const res = await fetch(`/api/ai/providers/state?refresh=${force ? provider : ''}`, { cache: 'no-store' });
      const data = (await res.json()) as { ok?: boolean; state?: GlobalAiState };
      if (seqRef.current[provider] === reqId && res.ok && data.ok && data.state) {
        setState((prev) => patchSingleProvider(prev, provider, data.state!.providers[provider]));
      }
    } catch {
      if (seqRef.current[provider] !== reqId) return;
      setState((prev) =>
        patchSingleProvider(prev, provider, {
          modelsLoading: false,
          status: 'UNAVAILABLE',
          error: { code: 'NETWORK_ERROR', message: 'Falha de rede ao atualizar lista de modelos.' },
        })
      );
    }
  }, []);

  const saveProviderKey = React.useCallback(
    async (provider: AiProviderId, apiKey: string, options?: { activateProvider?: boolean; modelId?: string }) => {
      const reqId = ++seqRef.current[provider];
      setState((prev) => patchSingleProvider(prev, provider, { status: 'VERIFYING', modelsLoading: true, error: null }));
      const res = await saveProviderCredentialsAction({
        provider, apiKey, modelId: options?.modelId, activateProvider: options?.activateProvider,
      });
      if (seqRef.current[provider] !== reqId) return { ok: res.ok, error: !res.ok ? res.error : undefined };
      if (!res.ok) {
        setState((prev) =>
          patchSingleProvider(prev, provider, {
            modelsLoading: false,
            status: prev.providers[provider].hasStoredKey ? prev.providers[provider].status : 'NOT_CONFIGURED',
            error: { code: 'INVALID_CREDENTIALS', message: res.error },
          })
        );
        return { ok: false, error: res.error };
      }
      setState((prev) => {
        const nextActive = res.activeProvider || prev.activeProvider;
        const nextProviders = { ...prev.providers, [provider]: res.state };
        return { activeProvider: nextActive, activeModelId: nextProviders[nextActive].selectedModelId, providers: nextProviders };
      });
      return { ok: true };
    },
    []
  );

  const removeProviderKey = React.useCallback(async (provider: AiProviderId) => {
    const reqId = ++seqRef.current[provider];
    const res = await removeProviderCredentialsAction({ provider });
    if (seqRef.current[provider] !== reqId) return { ok: res.ok, error: !res.ok ? res.error : undefined };
    if (!res.ok) return { ok: false, error: res.error };
    setState((prev) => {
      const nextProviders = { ...prev.providers, [provider]: res.state };
      return { ...prev, activeModelId: nextProviders[prev.activeProvider].selectedModelId, providers: nextProviders };
    });
    setLastSanityResult(null);
    setLastSanityError(null);
    return { ok: true };
  }, []);

  const selectModel = React.useCallback(async (provider: AiProviderId, modelId: string) => {
    const cleanModel = modelId.trim();
    setState((prev) => applyProviderSelectionState(prev, provider, cleanModel));
    const res = await selectActiveAiModelAction({ provider, modelId: cleanModel });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  }, []);

  const runOperationalTest = React.useCallback(async (provider: AiProviderId, modelId: string, customPrompt?: string) => {
    setIsTestingModel(true);
    setLastSanityError(null);
    try {
      const res = await fetch('/api/ai/sanity-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, modelId, persistSelection: false, customPrompt }),
      });
      const data = (await res.json()) as { ok?: boolean; sanityCheck?: SanityCheckValidationResult; error?: string };
      const sanity = data.sanityCheck || null;
      setLastSanityResult(sanity);
      if (res.ok && sanity?.passed) {
        setState((prev) => patchSingleProvider(prev, provider, { status: 'OPERATIONAL', lastVerifiedAt: sanity.checkedAt, error: null }));
        return sanity;
      }
      const errMsg = sanity?.error || data.error || 'Falha no teste operacional do modelo.';
      setLastSanityError(errMsg);
      if (sanity) {
        setState((prev) =>
          patchSingleProvider(prev, provider, {
            status: mapDiagnosticCodeToProviderStatus(sanity.diagnosticCode),
            lastVerifiedAt: sanity.checkedAt,
            error: { code: sanity.diagnosticCode, message: errMsg, httpStatus: sanity.httpStatus },
          })
        );
      }
      return sanity;
    } catch {
      setLastSanityError('Falha de rede ao testar o modelo selecionado.');
      return null;
    } finally {
      setIsTestingModel(false);
    }
  }, []);

  const reportRuntimeError = React.useCallback(
    (provider: AiProviderId, code: IntegrationDiagnosticCode, message: string, httpStatus?: number) => {
      setState((prev) => applyProviderRuntimeError(prev, provider, code, message, httpStatus));
    },
    []
  );

  const value = React.useMemo<AiProvidersContextValue>(
    () => ({
      state, activeProviderState: state.providers[state.activeProvider], isHydrating, isTestingModel,
      lastSanityResult, lastSanityError, saveProviderKey, removeProviderKey, selectModel,
      refreshProviderModels, refreshAllProviders, runOperationalTest, reportRuntimeError,
    }),
    [state, isHydrating, isTestingModel, lastSanityResult, lastSanityError, saveProviderKey, removeProviderKey, selectModel, refreshProviderModels, refreshAllProviders, runOperationalTest, reportRuntimeError]
  );

  return <AiProvidersContext.Provider value={value}>{children}</AiProvidersContext.Provider>;
}

export function useAiProviders(): AiProvidersContextValue {
  const ctx = React.useContext(AiProvidersContext);
  if (!ctx) throw new Error('useAiProviders deve ser usado dentro de <AiProvidersProvider>.');
  return ctx;
}

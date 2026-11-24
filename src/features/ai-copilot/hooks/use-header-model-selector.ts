'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AI_MODELS_CATALOG,
  SANITY_CHECK_PROMPT,
  getAiModelDescriptor,
  type AiModelId,
  type AiProviderId,
  type SanityCheckValidationResult,
} from '@/features/ai-copilot/models';
import type { SsoSessionPayload } from '@/features/auth/sso';
import { useSsoPopupBridge } from '@/features/ai-copilot/hooks/use-sso-popup-bridge';
import { useLiveGeminiModels } from '@/features/ai-copilot/hooks/use-live-gemini-models';

export function useHeaderModelSelector(params: {
  initialModelId: string;
  initialSsoAuthenticated: boolean;
  initialSsoSession: SsoSessionPayload | null;
  onModelConfirmed?: (modelId: AiModelId, sanity: SanityCheckValidationResult) => void;
}) {
  const { initialModelId, initialSsoAuthenticated, onModelConfirmed } = params;
  const router = useRouter();
  const [selectedModelId, setSelectedModelId] = React.useState<AiModelId>(
    getAiModelDescriptor(initialModelId).id
  );
  const [customQuestionInput, setCustomQuestionInput] = React.useState<string>(
    SANITY_CHECK_PROMPT
  );
  const [isTesting, setIsTesting] = React.useState(false);
  const [sanityResult, setSanityResult] = React.useState<SanityCheckValidationResult | null>(
    null
  );
  const [sanityError, setSanityError] = React.useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = React.useState(false);

  const currentModel = getAiModelDescriptor(selectedModelId);
  const runCheckRef = React.useRef<
    (targetId: AiModelId, persist?: boolean, question?: string) => Promise<void>
  >(async () => {});

  const {
    geminiModels,
    geminiModelsSource,
    isLoadingGeminiModels,
    refreshLiveGeminiModels,
  } = useLiveGeminiModels(selectedModelId);

  React.useEffect(() => {
    if (isInspectorOpen) {
      void refreshLiveGeminiModels();
    }
  }, [isInspectorOpen, refreshLiveGeminiModels]);

  const handlePopupSuccess = React.useCallback(
    (targetId: AiModelId) => {
      setSelectedModelId(targetId);
      void refreshLiveGeminiModels();
      void runCheckRef.current(targetId, true, customQuestionInput);
    },
    [customQuestionInput, refreshLiveGeminiModels]
  );

  const sso = useSsoPopupBridge({
    initialSsoAuthenticated,
    selectedModelId,
    onPopupSuccess: handlePopupSuccess,
  });
  const { fetchProvidersStatus, setSsoAuthenticated } = sso;

  const runSanityCheckForModel = React.useCallback(
    async (
      targetModelId: AiModelId,
      persistSelection = true,
      questionOverride?: string
    ) => {
      setIsTesting(true);
      setSanityError(null);
      const promptToUse =
        questionOverride && questionOverride.trim().length > 0
          ? questionOverride.trim()
          : SANITY_CHECK_PROMPT;

      try {
        await fetchProvidersStatus();
        const res = await fetch('/api/ai/sanity-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: targetModelId,
            persistSelection,
            customPrompt: promptToUse,
          }),
        });
        const data = await res.json();

        if (data.sanityCheck) {
          setSanityResult(data.sanityCheck);
          setSelectedModelId(getAiModelDescriptor(data.sanityCheck.selectedModelId).id);
        } else {
          setSanityResult(null);
        }

        if (!res.ok || !data.ssoAuthenticated || !data.sanityCheck?.passed) {
          setSsoAuthenticated(Boolean(data.ssoAuthenticated));
          setSanityError(
            data.sanityCheck?.error ||
              data.error ||
              'Provedor não autenticado. Faça login no pop-up do provedor para usar este modelo.'
          );
          if (persistSelection) router.refresh();
          return;
        }

        setSsoAuthenticated(true);
        if (data.sanityCheck && onModelConfirmed) {
          onModelConfirmed(targetModelId, data.sanityCheck);
        }
        if (persistSelection) router.refresh();
      } catch {
        setSanityError('Falha de rede ao consultar o modelo selecionado.');
      } finally {
        setIsTesting(false);
      }
    },
    [fetchProvidersStatus, setSsoAuthenticated, onModelConfirmed, router]
  );

  runCheckRef.current = runSanityCheckForModel;

  React.useEffect(() => {
    const normalized = getAiModelDescriptor(initialModelId).id;
    setSelectedModelId((prev) => {
      if (prev !== normalized) {
        void runSanityCheckForModel(normalized, false, SANITY_CHECK_PROMPT);
      }
      return normalized;
    });
  }, [initialModelId, runSanityCheckForModel]);

  React.useEffect(() => {
    const targetId = getAiModelDescriptor(initialModelId).id;
    void runSanityCheckForModel(targetId, false, SANITY_CHECK_PROMPT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextModelId = getAiModelDescriptor(e.target.value).id;
    setSelectedModelId(nextModelId);
    await runSanityCheckForModel(nextModelId, true, customQuestionInput);
  };

  const handleSendCustomQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = customQuestionInput.trim() || SANITY_CHECK_PROMPT;
    setCustomQuestionInput(q);
    await runSanityCheckForModel(selectedModelId, false, q);
  };

  const handleRevokeProvider = async (provider: AiProviderId) => {
    await sso.revokeProviderSession(provider);
    if (currentModel.provider === provider) {
      sso.setSsoAuthenticated(false);
      setSanityResult(null);
      setSanityError(
        `Sessão de ${currentModel.providerGroupLabel} desconectada. Faça login no pop-up para usar ${currentModel.displayName}.`
      );
    }
    await runSanityCheckForModel(selectedModelId, false, customQuestionInput);
    router.refresh();
  };

  const openaiModels = AI_MODELS_CATALOG.filter((m) => m.provider === 'OPENAI');
  const claudeModels = AI_MODELS_CATALOG.filter((m) => m.provider === 'CLAUDE');
  const isCurrentProviderLogged = Boolean(sso.providersAuth[currentModel.provider]?.authenticated);
  const isModelReallyVerified = Boolean(
    isCurrentProviderLogged && sso.ssoAuthenticated && sanityResult?.passed
  );

  return {
    selectedModelId,
    currentModel,
    providersAuth: sso.providersAuth,
    customQuestionInput,
    setCustomQuestionInput,
    isTesting,
    isSsoLoading: sso.isSsoLoading,
    sanityResult,
    sanityError,
    isInspectorOpen,
    setIsInspectorOpen,
    openaiModels,
    geminiModels,
    geminiModelsSource,
    isLoadingGeminiModels,
    refreshLiveGeminiModels,
    claudeModels,
    isCurrentProviderLogged,
    isModelReallyVerified,
    runSanityCheckForModel,
    handleOpenProviderLoginPopup: sso.handleOpenProviderLoginPopup,
    handleSelectModelChange,
    handleSendCustomQuestion,
    handleRevokeProvider,
  };
}

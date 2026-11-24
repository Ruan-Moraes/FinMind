'use client';

import * as React from 'react';
import { getAiModelDescriptor, type AiModelId, type AiProviderId } from '@/features/ai-copilot/models';
import type { ProviderAuthState } from '@/features/ai-copilot/components/provider-accounts-strip';

interface UseSsoPopupBridgeParams {
  initialSsoAuthenticated: boolean;
  selectedModelId: AiModelId;
  onPopupSuccess: (targetModelId: AiModelId) => void;
}

export function useSsoPopupBridge(params: UseSsoPopupBridgeParams) {
  const { initialSsoAuthenticated, selectedModelId, onPopupSuccess } = params;
  const [ssoAuthenticated, setSsoAuthenticated] = React.useState(initialSsoAuthenticated);
  const [isSsoLoading, setIsSsoLoading] = React.useState(false);
  const [providersAuth, setProvidersAuth] = React.useState<
    Record<AiProviderId, ProviderAuthState>
  >({
    OPENAI: { authenticated: false, method: 'NONE', email: null },
    GEMINI: { authenticated: false, method: 'NONE', email: null },
    CLAUDE: { authenticated: false, method: 'NONE', email: null },
  });

  const fetchProvidersStatus = React.useCallback(async () => {
    try {
      const res = await fetch('/api/sso');
      const data = await res.json();
      if (data.configuredProviders) {
        setProvidersAuth(data.configuredProviders);
      }
    } catch {
      // ignore network error
    }
  }, []);

  const handleOpenProviderLoginPopup = React.useCallback(
    (provider: AiProviderId, targetModelId?: string) => {
      if (typeof window === 'undefined') return;
      const width = 480;
      const height = 700;
      const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
      const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
      const modelParam = targetModelId || selectedModelId;
      const popupUrl = `/sso-popup?provider=${provider}&modelId=${encodeURIComponent(modelParam)}`;

      const popup = window.open(
        popupUrl,
        `FinMind_SSO_${provider}`,
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes`
      );
      if (popup) popup.focus();
    },
    [selectedModelId]
  );

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'FINMIND_SSO_POPUP_SUCCESS') {
        const targetId = getAiModelDescriptor(event.data.modelId || selectedModelId).id;
        onPopupSuccess(targetId);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedModelId, onPopupSuccess]);

  const revokeProviderSession = React.useCallback(
    async (provider: AiProviderId) => {
      setIsSsoLoading(true);
      try {
        await fetch('/api/sso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'revoke', provider }),
        });
        await fetchProvidersStatus();
      } finally {
        setIsSsoLoading(false);
      }
    },
    [fetchProvidersStatus]
  );

  return {
    ssoAuthenticated,
    setSsoAuthenticated,
    isSsoLoading,
    providersAuth,
    fetchProvidersStatus,
    handleOpenProviderLoginPopup,
    revokeProviderSession,
  };
}

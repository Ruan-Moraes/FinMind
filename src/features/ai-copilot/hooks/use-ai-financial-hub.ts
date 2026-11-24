'use client';

import * as React from 'react';
import { buildSubscriptionStatusPrompt } from '@/features/ai-copilot/providers';
import type { AiFinancialHubProps } from '@/features/ai-copilot/components/ai-financial-hub';
import { useAiProviderConfig } from '@/features/ai-copilot/hooks/use-ai-provider-config';
import { useFinancialStatusDiagnosis } from '@/features/ai-copilot/hooks/use-assistant-and-diagnosis';

export function useAiFinancialHub(props: AiFinancialHubProps) {
  const { aiSettings, financialContext } = props;

  const config = useAiProviderConfig(aiSettings);
  const diagnosis = useFinancialStatusDiagnosis({
    connectionMode: config.connectionMode,
    financialContext,
  });

  const [pendingDelete, setPendingDelete] = React.useState<{
    title: string;
    entityName: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => Promise<unknown> | void;
  } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleConfirmPendingDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await pendingDelete.onConfirm();
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopySubscriptionPrompt = async (
    _kind: 'statement' | 'status',
    openWebTab = false
  ) => {
    const promptText = buildSubscriptionStatusPrompt(financialContext);
    await navigator.clipboard.writeText(promptText);
    if (openWebTab) {
      window.open(config.currentProviderMeta.webUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return {
    ...config,
    ...diagnosis,
    pendingDelete,
    setPendingDelete,
    isDeleting,
    handleConfirmPendingDelete,
    handleCopySubscriptionPrompt,
  };
}

'use client';

import * as React from 'react';
import { useAiProviders } from '@/features/ai-copilot/context/ai-providers-context';
import type { AiFinancialHubProps } from '@/features/ai-copilot/components/ai-financial-hub';
import { useFinancialStatusDiagnosis } from '@/features/ai-copilot/hooks/use-assistant-and-diagnosis';

export function useAiFinancialHub(props: AiFinancialHubProps) {
  const { financialContext } = props;
  const { state, activeProviderState } = useAiProviders();

  const hasConfiguredProvider =
    activeProviderState.status === 'CONNECTED' || activeProviderState.status === 'OPERATIONAL';

  const diagnosis = useFinancialStatusDiagnosis({
    financialContext,
    hasConfiguredProvider,
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

  return {
    provider: state.activeProvider,
    ...diagnosis,
    pendingDelete,
    setPendingDelete,
    isDeleting,
    handleConfirmPendingDelete,
  };
}

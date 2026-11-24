'use client';

import * as React from 'react';
import { runAiFinancialStatusAnalysisAction } from '@/features/ai-copilot/actions/ai-status-reports.actions';
import type { AiConnectionMode } from '@/features/ai-copilot/providers';
import type { AiFinancialHubProps } from '@/features/ai-copilot/components/ai-financial-hub';

export function useFinancialStatusDiagnosis(params: {
  connectionMode: AiConnectionMode;
  financialContext: AiFinancialHubProps['financialContext'];
}) {
  const { connectionMode, financialContext } = params;
  const [pastedStatusResponse, setPastedStatusResponse] = React.useState('');
  const [isRunningAnalysis, setIsRunningAnalysis] = React.useState(false);
  const [statusAnalysisError, setStatusAnalysisError] = React.useState<string | null>(null);

  const handleGenerateStatusReport = async () => {
    setIsRunningAnalysis(true);
    setStatusAnalysisError(null);
    try {
      const res = await runAiFinancialStatusAnalysisAction({
        pastedSubscriptionResponse: pastedStatusResponse,
        context: financialContext,
        allowLocalFallback: connectionMode === 'SUBSCRIPTION',
      });
      if (!res.ok) {
        setStatusAnalysisError(
          res.error ||
            'Falha ao consultar a IA para gerar o diagnóstico. Verifique a chave de API do provedor selecionado.'
        );
      } else {
        setPastedStatusResponse('');
      }
    } finally {
      setIsRunningAnalysis(false);
    }
  };

  return {
    pastedStatusResponse,
    setPastedStatusResponse,
    isRunningAnalysis,
    statusAnalysisError,
    handleGenerateStatusReport,
  };
}

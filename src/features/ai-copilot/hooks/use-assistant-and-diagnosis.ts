'use client';

import * as React from 'react';
import { runAiFinancialStatusAnalysisAction } from '@/features/ai-copilot/actions/ai-status-reports.actions';
import type { AiFinancialHubProps } from '@/features/ai-copilot/components/ai-financial-hub';

export function useFinancialStatusDiagnosis(params: {
  financialContext: AiFinancialHubProps['financialContext'];
  hasConfiguredProvider: boolean;
}) {
  const { financialContext, hasConfiguredProvider } = params;
  const [isRunningAnalysis, setIsRunningAnalysis] = React.useState(false);
  const [statusAnalysisError, setStatusAnalysisError] = React.useState<string | null>(null);

  const handleGenerateStatusReport = async () => {
    setIsRunningAnalysis(true);
    setStatusAnalysisError(null);
    try {
      const res = await runAiFinancialStatusAnalysisAction({
        context: financialContext,
        allowLocalFallback: !hasConfiguredProvider,
      });
      if (!res.ok) {
        setStatusAnalysisError(
          res.error ||
            'Falha ao consultar a IA para gerar o diagnóstico. Verifique a chave de API do provedor selecionado.'
        );
      }
    } finally {
      setIsRunningAnalysis(false);
    }
  };

  return {
    isRunningAnalysis,
    statusAnalysisError,
    handleGenerateStatusReport,
  };
}
